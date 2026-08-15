import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Role, StatutDeliberation, StatutPaiement, type Etudiant } from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpClient, numerique } from './otp.client';

/**
 * Portail étudiant : connexion par SMS (code OTP), profil complet et
 * résultats. Le portail ne manipule jamais de mot de passe : à la première
 * connexion valide, un compte `User` de rôle ETUDIANT est créé — avec une
 * empreinte de mot de passe infalsifiable (haché d'un UUID, jamais connu de
 * personne) — uniquement pour porter un jeton JWT et ses traces d'audit.
 */
@Injectable()
export class PortailService {
  private readonly journal = new Logger(PortailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpClient,
    private readonly jwt: JwtService,
  ) {}

  /** Variantes de saisie du même numéro, pour la requête exacte en base. */
  private variantes(telephone: string): string[] {
    const cible = numerique(telephone);
    return [...new Set([telephone.trim(), cible, `224${cible}`, `0${cible}`, `+224${cible}`])];
  }

  /**
   * Retrouve l'étudiant dont la fiche porte ce numéro. D'abord par égalité
   * (nombreuses variantes de saisie), puis, si rien ne correspond, par
   * comparaison normalisée de l'ensemble des numéros enregistrés — ainsi
   * « +224 62 200 0001 » au registre trouve « 622000001 » au clavier.
   */
  async trouverEtudiantParTelephone(telephone: string): Promise<Etudiant | null> {
    if (!numerique(telephone)) return null;

    const direct = await this.prisma.etudiant.findFirst({
      where: { actif: true, telephone: { in: this.variantes(telephone) } },
    });
    if (direct) return direct;

    const cibles = await this.prisma.etudiant.findMany({
      where: { actif: true, telephone: { not: null } },
      select: { id: true, telephone: true },
    });
    const retenue = cibles.find((c) => numerique(c.telephone) === numerique(telephone));
    if (!retenue) return null;
    return this.prisma.etudiant.findUnique({ where: { id: retenue.id } });
  }

  /**
   * Étape 1 — demande de code.
   *
   * Choix de sécurité : la route répond toujours 202 `{ok:true}`, que le
   * numéro soit connu ou non. Un numéro inconnu ne déclenche simplement aucun
   * SMS ; rien dans la réponse ne permet d'énumérer le registre étudiant
   * (ce qu'un 404 distinct autoriserait parfaitement). L'échec d'émission
   * (passerelle injoignable) est tracé côté serveur, jamais exposé.
   */
  async demanderCode(telephone: string): Promise<{ envoye: boolean }> {
    const etudiant = await this.trouverEtudiantParTelephone(telephone);
    if (!etudiant) {
      this.journal.warn(`OTP demandé pour un numéro inconnu du registre (${numerique(telephone)})`);
      return { envoye: false };
    }

    const reponse = await this.otp.envoyer(numerique(etudiant.telephone ?? telephone), {
      but: 'portail',
    });
    if (!reponse.ok) {
      this.journal.warn(`OTP non émis pour ${etudiant.matricule} : ${reponse.raison ?? 'inconnue'}`);
    }
    return { envoye: reponse.ok };
  }

  /**
   * Étape 2 — vérification du code et remise du jeton.
     * Un code valide prouve la possession du numéro : à partir de là seulement,
     * l'existence du compte peut être confirmée.
   */
  async verifierCode(telephone: string, code: string, ip?: string) {
    const reponse = await this.otp.verifier(telephone, code);
    if (!reponse.valid) {
      if (reponse.raison === 'passerelle_injoignable') {
        throw new ServiceUnavailableException(
          'Le service de vérification est momentanément indisponible, réessayez dans un instant.',
        );
      }
      const messages: Record<string, string> = {
        no_active_code: 'Aucun code en attente pour ce numéro : demandez-en un nouveau.',
        too_many_attempts: 'Trop de tentatives : demandez un nouveau code.',
      };
      throw new BadRequestException(messages[reponse.raison ?? ''] ?? 'Code incorrect ou expiré.');
    }

    const etudiant = await this.trouverEtudiantParTelephone(telephone);
    if (!etudiant) {
      // Ne se produit que pour un code valide émis sur un compte supprimé
      // depuis : on reste vague.
      throw new BadRequestException('Aucun compte étudiant pour ce numéro.');
    }

    const utilisateur = await this.assurerCompteEtudiant(etudiant);
    await this.prisma.auditLog.create({
      data: {
        userId: utilisateur.id,
        action: 'LOGIN',
        entite: 'User',
        entiteId: utilisateur.id,
        details: 'Connexion portail via code OTP',
        ip,
      },
    });

    return {
      token: await this.jwt.signAsync({ sub: utilisateur.id, role: Role.ETUDIANT }),
      etudiant: {
        id: etudiant.id,
        matricule: etudiant.matricule,
        nom: etudiant.nom,
        prenom: etudiant.prenom,
        telephone: etudiant.telephone,
        actif: etudiant.actif,
      },
    };
  }

  /**
   * Compte JWT de l'étudiant : créé à la première connexion, puis réutilisé.
   * Le mot de passe est un hachage d'un jeton aléatoire jeté : personne ne
   * peut s'y connecter par mot de passe, le portail est le seul chemin.
   */
  private async assurerCompteEtudiant(etudiant: Etudiant) {
    if (etudiant.userId) {
      const existant = await this.prisma.user.findUnique({ where: { id: etudiant.userId } });
      if (existant) return existant;
    }

    const email = `ine-${etudiant.matricule.toLowerCase()}@university.local`;
    try {
      const cree = await this.prisma.user.create({
        data: {
          email,
          password: await bcrypt.hash(randomUUID(), 10),
          nom: etudiant.nom,
          prenom: etudiant.prenom,
          telephone: etudiant.telephone ?? null,
          role: Role.ETUDIANT,
          actif: true,
        },
      });
      await this.prisma.etudiant.update({
        where: { id: etudiant.id },
        data: { userId: cree.id },
      });
      return cree;
    } catch (erreur) {
      // Adresse déjà prise par un compte pré-créé sans rattachement : on le
      // reprend au lieu de forcer un second compte.
      if ((erreur as { code?: string })?.code === 'P2002') {
        const existant = await this.prisma.user.findUnique({ where: { email } });
        if (existant) {
          await this.prisma.etudiant.update({
            where: { id: etudiant.id },
            data: { userId: existant.id },
          });
          return existant;
        }
      }
      throw erreur;
    }
  }

  /** Profil complet de l'étudiant connecté, strictement borné à sa fiche. */
  async profilPortail(utilisateur: AuthUser) {
    if (!utilisateur.etudiantId) {
      throw new NotFoundException('Aucun dossier étudiant rattaché à ce compte');
    }

    const etudiant = await this.prisma.etudiant.findUnique({
      where: { id: utilisateur.etudiantId },
      include: {
        inscriptions: {
          include: { annee: true, promotion: { include: { filiere: true } }, paiements: true },
          orderBy: { createdAt: 'desc' },
        },
        paiements: { orderBy: { horodatage: 'desc' } },
      },
    });
    if (!etudiant) throw new NotFoundException('Aucun dossier étudiant rattaché à ce compte');

    // Inscription courante : celle de l'année académique active, sinon la
    // plus récente.
    const inscription =
      etudiant.inscriptions.find((i) => i.annee?.active) ?? etudiant.inscriptions[0] ?? null;

    let montantFrais = inscription?.montantFrais ?? 0;
    let devise = 'GNF';
    let paye = 0;
    if (inscription) {
      const tarif = await this.prisma.frais.findUnique({
        where: {
          anneeId_promotionId: {
            anneeId: inscription.anneeId,
            promotionId: inscription.promotionId,
          },
        },
      });
      if (tarif) devise = tarif.devise;
      if (!inscription.montantFrais && tarif) montantFrais = tarif.montant;
      paye = etudiant.paiements
        .filter(
          (p) =>
            p.statut === StatutPaiement.REUSSI &&
            (!p.inscriptionId || p.inscriptionId === inscription.id),
        )
        .reduce((somme, p) => somme + p.montant, 0);
    }
    const solde = Math.max(0, montantFrais - paye);
    const taux = montantFrais > 0 ? Math.min(100, (paye / montantFrais) * 100) : 0;

    // Seules les délibérations VALIDÉES sont publiques : un brouillon de jury
    // n'est pas un résultat.
    const [lignes, attestations] = await Promise.all([
      this.prisma.deliberationLigne.findMany({
        where: {
          inscription: { etudiantId: etudiant.id },
          deliberation: { statut: StatutDeliberation.VALIDEE },
        },
        include: { deliberation: { include: { promotion: true, annee: true } } },
        orderBy: [{ deliberation: { session: 'asc' } }, { deliberation: { valideeLe: 'desc' } }],
      }),
      this.prisma.attestation.findMany({
        where: { etudiantId: etudiant.id },
        orderBy: { emiseLe: 'desc' },
      }),
    ]);

    return {
      etudiant: {
        id: etudiant.id,
        matricule: etudiant.matricule,
        nom: etudiant.nom,
        prenom: etudiant.prenom,
        email: etudiant.email,
        telephone: etudiant.telephone,
        adresse: etudiant.adresse,
        actif: etudiant.actif,
      },
      inscription: inscription
        ? {
            id: inscription.id,
            numero: inscription.numero,
            statut: inscription.statut,
            dateInscription: inscription.dateInscription,
            montantFrais,
            annee: { libelle: inscription.annee?.libelle },
            promotion: {
              nom: inscription.promotion?.nom,
              niveau: inscription.promotion?.niveau,
              filiere: inscription.promotion?.filiere?.nom ?? null,
            },
          }
        : null,
      frais: inscription ? { montant: montantFrais, devise, paye, solde, taux } : null,
      paiements: (etudiant.paiements ?? []).slice(0, 10).map((p) => ({
        id: p.id,
        reference: p.reference,
        montant: p.montant,
        devise: p.devise,
        mode: p.mode,
        operateur: p.operateur,
        statut: p.statut,
        horodatage: p.horodatage,
        motif: p.motif,
        inscriptionId: p.inscriptionId,
      })),
      deliberations: lignes.map((l) => this.ligneResume(l)),
      attestations: attestations.map((a) => ({
        id: a.id,
        numero: a.numero,
        type: a.type,
        motif: a.motif,
        statut: a.statut,
        emiseLe: a.emiseLe,
      })),
    };
  }

  /** Moyennes par session de délibération pour l'étudiant connecté. */
  async resultats(utilisateur: AuthUser) {
    if (!utilisateur.etudiantId) {
      throw new NotFoundException('Aucun dossier étudiant rattaché à ce compte');
    }

    const lignes = await this.prisma.deliberationLigne.findMany({
      where: {
        inscription: { etudiantId: utilisateur.etudiantId },
        deliberation: { statut: StatutDeliberation.VALIDEE },
      },
      include: { deliberation: { include: { promotion: true, annee: true } } },
      orderBy: [{ deliberation: { session: 'asc' } }, { deliberation: { valideeLe: 'desc' } }],
    });

    const deliberations = lignes.map((l) => this.ligneResume(l));
    return { deliberations, finale: deliberations[deliberations.length - 1] ?? null };
  }

  /** Forme publique d'une ligne de délibération (jamais celle d'autrui). */
  private ligneResume(l: {
    id: string;
    deliberationId: string;
    moyenne: number;
    decision: string;
    mention: string | null;
    rang: number | null;
    deliberation: {
      session: string;
      statut: string;
      valideeLe: Date | null;
      promotion: Record<string, unknown>;
      annee: { libelle: string };
    };
  }) {
    return {
      id: l.id,
      deliberationId: l.deliberationId,
      session: l.deliberation.session,
      statutDeliberation: l.deliberation.statut,
      valideeLe: l.deliberation.valideeLe,
      annee: l.deliberation.annee.libelle,
      promotion: String(l.deliberation.promotion.nom ?? ''),
      moyenne: l.moyenne,
      decision: l.decision,
      mention: l.mention,
      rang: l.rang,
    };
  }
}