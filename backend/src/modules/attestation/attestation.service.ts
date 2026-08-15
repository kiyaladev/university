/**
 * Attestation de présence donnée par l'enseignant DEVANT le contrôleur, sur
 * l'appareil de celui-ci. L'enseignant ne s'atteste jamais lui-même, ni à
 * distance, ni depuis son propre téléphone : le contrôleur relève tout, puis
 * fait signer, composer le code ou poser le doigt.
 *
 * Trois modalités, une seule suffit — de la plus forte à la plus faible :
 *   EMPREINTE lecteur d'empreintes relié au poste de contrôle
 *   CODE_PIN  code personnel composé sur l'écran du contrôleur
 *   SIGNATURE signature manuscrite tracée sur l'écran du contrôleur
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AttestationMode, Role } from '@prisma/client';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametresService } from '../parametres/parametres.module';
import { AuthUser } from '../../common/decorators';
import { chiffrer, dechiffrer } from '../../common/coffre';
import {
  DefinirCodePinDto,
  EnrolerEmpreinteDto,
  PreuveEmpreinteDto,
} from './attestation.dto';

/** Fenêtre d'acceptation d'un résultat signé par la passerelle biométrique. */
const FRAICHEUR_EMPREINTE_MS = 5 * 60 * 1000;

export interface PreuvesAttestation {
  signatureBase64?: string;
  codePinEnseignant?: string;
  empreinte?: PreuveEmpreinteDto;
}

export interface ResultatAttestation {
  mode: AttestationMode;
  valide: boolean;
  score?: number;
}

@Injectable()
export class AttestationService {
  private readonly journal = new Logger(AttestationService.name);

  constructor(
    private prisma: PrismaService,
    private parametres: ParametresService,
  ) {}

  // ------------------------------------------------------------------ code PIN

  private async enseignantOuErreur(id: string) {
    const enseignant = await this.prisma.enseignant.findUnique({ where: { id } });
    if (!enseignant) throw new NotFoundException('Enseignant introuvable');
    return enseignant;
  }

  /**
   * Les moyens d'attestation sont administrés par l'établissement, jamais par
   * l'enseignant : c'est ce qui empêche un enseignant de se pointer lui-même.
   */
  private controlerAcces(user: AuthUser, _enseignantId: string) {
    const gestionnaire: Role[] = [
      Role.ADMIN,
      Role.SCOLARITE,
      Role.CHEF_DEPARTEMENT,
      Role.DIRECTION,
    ];
    if (gestionnaire.includes(user.role)) return;
    throw new ForbiddenException(
      'Seule la scolarité peut définir les moyens d’attestation d’un enseignant',
    );
  }

  async definirCodePin(enseignantId: string, dto: DefinirCodePinDto, user: AuthUser) {
    this.controlerAcces(user, enseignantId);
    await this.enseignantOuErreur(enseignantId);

    await this.prisma.enseignant.update({
      where: { id: enseignantId },
      data: { codePin: await bcrypt.hash(dto.code, 10), codePinDefiniLe: new Date() },
    });
    await this.journaliser(user, 'PIN_DEFINI', enseignantId);
    return { message: 'Code personnel enregistré' };
  }

  /** Réinitialisation par l'administration : le code est affiché une seule fois. */
  async reinitialiserCodePin(enseignantId: string, user: AuthUser) {
    this.controlerAcces(user, enseignantId);
    await this.enseignantOuErreur(enseignantId);

    const code = String(randomBytes(3).readUIntBE(0, 3) % 1000000).padStart(6, '0');
    await this.prisma.enseignant.update({
      where: { id: enseignantId },
      data: { codePin: await bcrypt.hash(code, 10), codePinDefiniLe: new Date() },
    });
    await this.journaliser(user, 'PIN_REINITIALISE', enseignantId);
    return { code, message: 'Communiquez ce code à l’enseignant : il ne sera plus affiché' };
  }

  async supprimerCodePin(enseignantId: string, user: AuthUser) {
    this.controlerAcces(user, enseignantId);
    await this.prisma.enseignant.update({
      where: { id: enseignantId },
      data: { codePin: null, codePinDefiniLe: null },
    });
    return { message: 'Code personnel supprimé' };
  }

  // ------------------------------------------------------------------ empreinte

  private get secretBiometrie() {
    return process.env.BIOMETRIE_SECRET ?? 'change-me-biometrie';
  }

  /**
   * Enrôle un appareil de contrôle et lui remet sa clé de signature. La clé
   * n'est renvoyée qu'ici, une seule fois : elle vit ensuite dans le coffre de
   * l'appareil. Un appareil perdu se révoque sans toucher aux autres.
   */
  async enrolerAppareil(libelle: string, user: AuthUser) {
    const secret = randomBytes(32).toString('hex');
    const appareil = await this.prisma.appareil.create({
      data: { libelle, secret, userId: user.id },
    });
    await this.journaliser(user, 'APPAREIL_ENROLE', appareil.id);
    return { appareilId: appareil.id, secret, libelle: appareil.libelle };
  }

  async revoquerAppareil(id: string, user: AuthUser) {
    const habilites: Role[] = [Role.ADMIN, Role.DIRECTION];
    if (!habilites.includes(user.role)) {
      throw new ForbiddenException('Seule l’administration peut révoquer un appareil');
    }
    await this.prisma.appareil.update({
      where: { id },
      data: { actif: false, revoqueLe: new Date() },
    });
    await this.journaliser(user, 'APPAREIL_REVOQUE', id);
    return { message: 'Appareil révoqué : ses lectures d’empreinte ne sont plus acceptées' };
  }

  listerAppareils() {
    return this.prisma.appareil.findMany({
      // Le secret ne ressort jamais d'ici.
      select: {
        id: true,
        libelle: true,
        actif: true,
        createdAt: true,
        dernierUsage: true,
        revoqueLe: true,
        user: { select: { nom: true, prenom: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Clé attendue pour signer : celle de l'appareil, ou celle de la passerelle. */
  private async secretDeSignature(appareilId?: string) {
    if (!appareilId) return this.secretBiometrie;

    const appareil = await this.prisma.appareil.findUnique({ where: { id: appareilId } });
    if (!appareil || !appareil.actif) {
      throw new BadRequestException(
        'Appareil inconnu ou révoqué : sa lecture d’empreinte n’est pas recevable',
      );
    }
    await this.prisma.appareil.update({
      where: { id: appareil.id },
      data: { dernierUsage: new Date() },
    });
    return appareil.secret;
  }

  /** La passerelle signe ses résultats : sans cette signature, un client pourrait
   *  prétendre qu'une empreinte a été reconnue. */
  private verifierSignaturePasserelle(
    charge: string,
    signature: string,
    horodatage: string,
    secret = this.secretBiometrie,
  ) {
    const attendue = createHmac('sha256', secret).update(charge).digest('hex');
    const a = Buffer.from(attendue);
    const b = Buffer.from(signature ?? '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Signature de la passerelle biométrique invalide');
    }

    const age = Date.now() - new Date(horodatage).getTime();
    if (!Number.isFinite(age) || age < -60_000 || age > FRAICHEUR_EMPREINTE_MS) {
      throw new BadRequestException('Résultat biométrique périmé — recommencez la lecture');
    }
  }

  async enrolerEmpreinte(enseignantId: string, dto: EnrolerEmpreinteDto, user: AuthUser) {
    this.controlerAcces(user, enseignantId);
    await this.enseignantOuErreur(enseignantId);

    if (!dto.consentement) {
      throw new BadRequestException(
        'L’enseignant doit consentir avant tout enrôlement d’empreinte. ' +
          'Le code personnel et la signature restent disponibles.',
      );
    }

    const secret = await this.secretDeSignature(dto.appareilId);
    this.verifierSignaturePasserelle(
      dto.appareilId
        ? `enrolement|${dto.appareilId}|${enseignantId}|${dto.template}|${dto.horodatage}`
        : `enrolement|${enseignantId}|${dto.template}|${dto.horodatage}`,
      dto.signature,
      dto.horodatage,
      secret,
    );

    await this.prisma.enseignant.update({
      where: { id: enseignantId },
      data: {
        // Chiffré au repos : la base ne contient plus de biométrie lisible.
        empreinteTemplate: chiffrer(dto.template),
        empreinteDoigt: dto.doigt ?? 'index droit',
        empreinteEnroleeLe: new Date(),
        empreinteConsentementLe: new Date(),
        empreinteConsentementPar: `${user.prenom} ${user.nom}`,
      },
    });
    await this.journaliser(user, 'EMPREINTE_ENROLEE', enseignantId);
    return { message: 'Empreinte enrôlée' };
  }

  async supprimerEmpreinte(enseignantId: string, user: AuthUser) {
    this.controlerAcces(user, enseignantId);
    await this.prisma.enseignant.update({
      where: { id: enseignantId },
      data: {
        empreinteTemplate: null,
        empreinteDoigt: null,
        empreinteEnroleeLe: null,
        empreinteConsentementLe: null,
        empreinteConsentementPar: null,
      },
    });
    await this.journaliser(user, 'EMPREINTE_SUPPRIMEE', enseignantId);
    return { message: 'Empreinte supprimée' };
  }

  /**
   * Conservation limitée. Une empreinte n'a pas à survivre au lien entre
   * l'enseignant et l'établissement : passé un délai après la désactivation de
   * la fiche, le gabarit est effacé, sans intervention de personne.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgerEmpreintesPerimees() {
    const jours = Number(process.env.BIOMETRIE_CONSERVATION_JOURS ?? 90);
    const limite = new Date(Date.now() - jours * 24 * 3600 * 1000);

    const concernes = await this.prisma.enseignant.findMany({
      where: {
        actif: false,
        updatedAt: { lt: limite },
        empreinteTemplate: { not: null },
      },
      select: { id: true },
    });
    if (!concernes.length) return { purges: 0 };

    await this.prisma.enseignant.updateMany({
      where: { id: { in: concernes.map((e) => e.id) } },
      data: {
        empreinteTemplate: null,
        empreinteDoigt: null,
        empreinteEnroleeLe: null,
        empreinteConsentementLe: null,
        empreinteConsentementPar: null,
      },
    });

    await this.prisma.auditLog.createMany({
      data: concernes.map((e) => ({
        action: 'EMPREINTE_PURGEE',
        entite: 'Enseignant',
        entiteId: e.id,
        details: `Fiche inactive depuis plus de ${jours} jours`,
      })),
    });

    this.journal.log(`${concernes.length} gabarit(s) d'empreinte purgé(s)`);
    return { purges: concernes.length };
  }

  /** Gabarit à transmettre à la passerelle pour la comparaison en salle. */
  async gabarit(enseignantId: string) {
    const e = await this.enseignantOuErreur(enseignantId);
    if (!e.empreinteTemplate) {
      throw new BadRequestException('Aucune empreinte enrôlée pour cet enseignant');
    }
    // Déchiffré uniquement ici, pour la comparaison faite par la passerelle.
    return { template: dechiffrer(e.empreinteTemplate), doigt: e.empreinteDoigt };
  }

  // ------------------------------------------------- vérification au pointage

  /** Moyens dont dispose l'enseignant — pilote l'affichage de l'écran de pointage. */
  async moyens(enseignantId: string) {
    const e = await this.prisma.enseignant.findUnique({ where: { id: enseignantId } });
    if (!e) throw new NotFoundException('Enseignant introuvable');
    return {
      codePin: !!e.codePin,
      empreinte: !!e.empreinteTemplate,
      empreinteDoigt: e.empreinteDoigt,
    };
  }

  /**
   * Valide l'attestation fournie lors d'un pointage. Retient la modalité la plus
   * forte parmi celles présentées.
   */
  async verifierPreuves(
    enseignantId: string,
    preuves: PreuvesAttestation,
  ): Promise<ResultatAttestation> {
    // 1. Empreinte lue par la passerelle
    if (preuves.empreinte) {
      const { score, horodatage, signature } = preuves.empreinte;

      // La signature couvre le gabarit comparé : le client ne peut donc pas
      // faire comparer le doigt à un gabarit de son choix.
      const enseignant = await this.enseignantOuErreur(enseignantId);
      if (!enseignant.empreinteTemplate) {
        throw new BadRequestException('Aucune empreinte n’est enrôlée pour cet enseignant');
      }
      const gabarit = createHash('sha256')
        .update(dechiffrer(enseignant.empreinteTemplate))
        .digest('hex');

      // La charge signée nomme l'appareil : un résultat volé sur un téléphone
      // ne peut pas être rejoué au nom d'un autre.
      const { appareilId } = preuves.empreinte;
      const secret = await this.secretDeSignature(appareilId);
      const charge = appareilId
        ? `verification|${appareilId}|${enseignantId}|${gabarit}|${score}|${horodatage}`
        : `verification|${enseignantId}|${gabarit}|${score}|${horodatage}`;

      this.verifierSignaturePasserelle(charge, signature, horodatage, secret);
      const seuil = await this.parametres.nombre('EMPREINTE_SCORE_MIN', 60);
      if (score < seuil) {
        throw new BadRequestException(
          `Empreinte non reconnue (score ${score} < ${seuil}) — recommencez ou utilisez un autre moyen`,
        );
      }
      return { mode: AttestationMode.EMPREINTE, valide: true, score };
    }

    // 2. Code personnel saisi sur l'écran du contrôleur
    if (preuves.codePinEnseignant) {
      const enseignant = await this.enseignantOuErreur(enseignantId);
      if (!enseignant.codePin) {
        throw new BadRequestException('Aucun code personnel n’a été défini pour cet enseignant');
      }
      if (!(await bcrypt.compare(preuves.codePinEnseignant, enseignant.codePin))) {
        throw new BadRequestException('Code personnel incorrect');
      }
      return { mode: AttestationMode.CODE_PIN, valide: true };
    }

    // 3. Signature manuscrite
    if (preuves.signatureBase64) {
      return { mode: AttestationMode.SIGNATURE, valide: true };
    }

    return { mode: AttestationMode.AUCUNE, valide: false };
  }

  private journaliser(user: AuthUser, action: string, enseignantId: string) {
    return this.prisma.auditLog.create({
      data: { userId: user.id, action, entite: 'Enseignant', entiteId: enseignantId },
    });
  }
}
