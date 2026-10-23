/**
 * Module 1 — Inscriptions en ligne & paiement Mobile Money.
 *
 * Le candidat dépose son dossier sans compte (page publique), l'inscription
 * naît en EN_ATTENTE_PAIEMENT avec le montant de la table Frais pour sa
 * promotion, un paiement Mobile Money lui est demandé, la confirmation (mode
 * pilote : l'agent comptable la simule) passe le dossier en PAYEE dès que le
 * cumul des paiements réussis couvre les frais, puis la scolarité la VALIDE.
 * Le numéro "INS-2026-00042" est l'identifiant de tous les autres modules.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, StatutInscription, StatutPaiement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { Paginated } from '../../common/dto';
import { isoDate, toDateOnly } from '../../common/utils';
import { ParametresService } from '../parametres/parametres.service';
import { EtudiantsService, prochainMatricule, prochainNumeroInscription } from './etudiants.service';
import { whereInscriptions } from './filtres';
import { deviseDossier } from './paiements.service';
import { chargerEtablissement, echapper, pageA4, PALETTE_IMPRESSION as P } from '../../common/impression';
import { t } from '../../common/i18n';
import { exigerAnneeOuverte } from '../../common/annee';
import { SERIES_NUMERO, millesimeSerie } from '../../common/numero';
import { CreateInscriptionDto, InscriptionPubliqueDto, InscriptionQueryDto } from './inscription.dto';

export const INSCRIPTION_INCLUDE = {
  etudiant: {
    select: {
      id: true,
      matricule: true,
      nom: true,
      prenom: true,
      sexe: true,
      telephone: true,
      email: true,
    },
  },
  annee: { select: { id: true, libelle: true } },
  promotion: { include: { filiere: true } },
  valideePar: { select: { id: true, nom: true, prenom: true } },
  paiements: {
    orderBy: { horodatage: 'desc' },
    select: {
      id: true,
      reference: true,
      montant: true,
      devise: true,
      mode: true,
      operateur: true,
      statut: true,
      horodatage: true,
      completeLe: true,
      annuleLe: true,
      demandeDocument: { select: { id: true } },
    },
  },
} satisfies Prisma.InscriptionInclude;

const LIBELLE_STATUT_INSCRIPTION: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_PAIEMENT: 'En attente de paiement',
  PAYEE: 'Frais payés',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

/** Instantanés limités aux données de gestion, sans coordonnées ou motif libre. */
function instantaneInscription(inscription: any) {
  if (!inscription) return null;
  return {
    id: inscription.id,
    numero: inscription.numero,
    etudiantId: inscription.etudiantId,
    anneeId: inscription.anneeId,
    promotionId: inscription.promotionId,
    statut: inscription.statut,
    montantFrais: inscription.montantFrais,
  };
}

@Injectable()
export class InscriptionService {
  constructor(
    private prisma: PrismaService,
    private etudiants: EtudiantsService,
    private parametres: ParametresService,
  ) {}

  // ----------------------------------------------------------- consultation

  private async anneeRetenue(anneeId?: string) {
    if (anneeId) {
      const annee = await this.prisma.anneeAcademique.findUnique({ where: { id: anneeId } });
      if (!annee) throw new BadRequestException(t('inscription.annee_academique_introuvable'));
      if (annee.cloturee) {
        throw new BadRequestException(t('inscription.aucune_annee_academique_n_est_ouverte_aux_inscriptions'));
      }
      return annee;
    }
    return (
      (await this.prisma.anneeAcademique.findFirst({
        where: { active: true, cloturee: false },
      })) ?? null
    );
  }

  /** Années ouvertes à la préinscription (page publique). */
  async anneesOuvertes() {
    const annees = await this.prisma.anneeAcademique.findMany({
      where: { cloturee: false },
      orderBy: { dateDebut: 'desc' },
      select: { id: true, libelle: true, dateDebut: true, dateFin: true, active: true },
    });
    return annees;
  }

  /** Promotions d'une année, avec le tarif officiel quand il existe. */
  async promotionsOuvertes(anneeId: string) {
    const annee = await this.prisma.anneeAcademique.findUnique({
      where: { id: anneeId },
      select: { id: true, cloturee: true },
    });
    if (!annee || annee.cloturee) {
      throw new NotFoundException(t('inscription.annee_academique_introuvable'));
    }
    const [promotions, frais] = await Promise.all([
      this.prisma.promotion.findMany({
        where: { anneeId },
        orderBy: [{ niveau: 'asc' }, { nom: 'asc' }],
        include: { filiere: { select: { code: true, nom: true } } },
      }),
      this.prisma.frais.findMany({
        where: { anneeId },
        select: { promotionId: true, montant: true, devise: true },
      }),
    ]);
    const fraisParPromotion = new Map(frais.map((f) => [f.promotionId, f]));
    return promotions.map((p) => ({
      id: p.id,
      nom: p.nom,
      niveau: p.niveau,
      filiere: p.filiere,
      frais: fraisParPromotion.get(p.id)
        ? { montant: fraisParPromotion.get(p.id)!.montant, devise: fraisParPromotion.get(p.id)!.devise }
        : null,
    }));
  }

  async listeInscriptions(query: InscriptionQueryDto, user?: AuthUser): Promise<Paginated<any>> {
    if (user?.role === Role.ETUDIANT) query = { ...query, etudiantId: user.etudiantId ?? '__aucun__' };
    const page = Number(query.page ?? 1);
    const all = query.all === 'true' || query.all === '1';
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (all ? 1000 : 50))));

    const where: Prisma.InscriptionWhereInput = {
      ...(user?.role === Role.CHEF_DEPARTEMENT
        ? { promotion: { filiere: { departementId: user.departementId ?? '__aucun__' } } }
        : {}),
      ...whereInscriptions(query),
    };

    const [data, total] = await Promise.all([
      this.prisma.inscription.findMany({
        where,
        include: INSCRIPTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...(all ? { skip: 0, take: pageSize } : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.inscription.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  async trouverInscription(id: string, user?: AuthUser) {
    const where: Prisma.InscriptionWhereInput = {
      id,
      ...(user?.role === Role.ETUDIANT ? { etudiantId: user.etudiantId ?? '__aucun__' } : {}),
      ...(user?.role === Role.CHEF_DEPARTEMENT
        ? { promotion: { filiere: { departementId: user.departementId ?? '__aucun__' } } }
        : {}),
    };
    const inscription = user
      ? await this.prisma.inscription.findFirst({ where, include: INSCRIPTION_INCLUDE })
      : await this.prisma.inscription.findUnique({ where: { id }, include: INSCRIPTION_INCLUDE });
    if (!inscription) throw new NotFoundException(t('inscription.inscription_introuvable'));
    return inscription;
  }

  // ------------------------------------------------------ dépôt en ligne

  /**
   * Dossier public : crée l'étudiant (matricule + QR resto) — une adresse déjà
   * connue est refusée, faute de preuve de possession — puis le dossier EN_ATTENTE_PAIEMENT au
   * tarif officiel, ou 0 avec un avertissement si aucun tarif n'est paramétré.
   */
  async depotPublic(dto: InscriptionPubliqueDto, ip?: string) {
    const annee = await this.anneeRetenue(dto.anneeId);
    if (!annee) {
      throw new BadRequestException(t('inscription.aucune_annee_academique_n_est_ouverte_aux_inscriptions'));
    }

    const promotion = await this.prisma.promotion.findUnique({
      where: { id: dto.promotionId },
    });
    if (!promotion) throw new BadRequestException(t('inscription.promotion_introuvable'));
    if (promotion.anneeId !== annee.id) {
      throw new BadRequestException(t('inscription.la_promotion_choisie_n_appartient_pas_a_l_annee_retenue'));
    }

    const frais = await this.prisma.frais.findUnique({
      where: { anneeId_promotionId: { anneeId: annee.id, promotionId: promotion.id } },
      select: { montant: true, devise: true },
    });
    const avertissement = frais
      ? undefined
      : `Aucun tarif n'est paramétré pour ${promotion.nom} sur ${annee.libelle} : le montant est laissé à 0 en attendant.`;

    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        const resultat = await this.prisma.$transaction(async (tx) => {
          await exigerAnneeOuverte(tx, annee.id);
          // Route publique, sans authentification : connaître une adresse
          // e-mail ne prouve pas qu'on la possède. Une fiche existante ne se
          // rattache donc jamais ici (portail authentifié ou guichet).
          const existant = dto.email
            ? await tx.etudiant.findUnique({
                where: { email: dto.email },
                select: { id: true },
              })
            : null;
          if (existant) {
            throw new ConflictException(t('inscription.fiche_existante_connexion_requise'));
          }

          const etudiant = await tx.etudiant.create({
            data: {
              nom: dto.nom,
              prenom: dto.prenom,
              sexe: dto.sexe ?? null,
              dateNaissance: dto.dateNaissance ? toDateOnly(dto.dateNaissance) : null,
              lieuNaissance: dto.lieuNaissance ?? null,
              telephone: dto.telephone,
              email: dto.email ?? null,
              adresse: dto.adresse ?? null,
              matricule: await prochainMatricule(tx, millesimeSerie(SERIES_NUMERO.MATRICULE, annee.libelle)),
              qrRestoToken: this.etudiants.nouveauQrResto(),
            },
            select: { id: true },
          });
          await tx.auditLog.create({
            data: {
              action: 'ETUDIANT_CREE',
              entite: 'Etudiant',
              entiteId: etudiant.id,
              details: 'Fiche étudiante créée par préinscription en ligne',
              ip: ip ?? null,
            },
          });

          const deja = await tx.inscription.findUnique({
            where: { etudiantId_anneeId: { etudiantId: etudiant.id, anneeId: annee.id } },
            select: { numero: true },
          });
          if (deja) {
            throw new ConflictException(
              t('inscription.un_dossier_deja_numero_existe_deja_pour_dto_prenom_dto_nom_s', {
                'deja.numero': deja.numero,
                'dto.prenom': dto.prenom,
                'dto.nom': dto.nom,
                'annee.libelle': annee.libelle,
              }),
            );
          }

          const inscription = await tx.inscription.create({
            data: {
              numero: await prochainNumeroInscription(tx, millesimeSerie(SERIES_NUMERO.INSCRIPTION, annee.libelle)),
              etudiantId: etudiant.id,
              anneeId: annee.id,
              promotionId: promotion.id,
              statut: StatutInscription.EN_ATTENTE_PAIEMENT,
              montantFrais: frais?.montant ?? 0,
            },
            select: { id: true, numero: true, montantFrais: true },
          });
          await tx.auditLog.create({
            data: {
              action: 'INSCRIPTION_CREE',
              entite: 'Inscription',
              entiteId: inscription.id,
              details: `${inscription.numero} — préinscription enregistrée · ${promotion.nom} (${annee.libelle})`,
              ip: ip ?? null,
            },
          });

          return {
            etudiantId: etudiant.id,
            inscriptionId: inscription.id,
            numero: inscription.numero,
            montantFrais: inscription.montantFrais,
            devise: frais?.devise ?? 'GNF',
          };
        });

        return {
          ...resultat,
          avertissement: avertissement ?? null,
          message:
            `Dossier ${resultat.numero} déposé. Réglez ${resultat.montantFrais.toLocaleString('fr-FR')} ` +
            `${resultat.devise} via Mobile Money pour finaliser votre inscription.`,
        };
      } catch (e: any) {
        if (e instanceof ConflictException) throw e;
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(t('inscription.numero_de_dossier_temporairement_indisponible_reessayez'));
  }

  /** Inscription au guichet (agent comptable / scolarité). */
  async creerInscription(dto: CreateInscriptionDto, user: AuthUser) {
    const etudiant = await this.prisma.etudiant.findUnique({
      where: { id: dto.etudiantId },
      select: { id: true, nom: true, prenom: true },
    });
    if (!etudiant) throw new NotFoundException(t('inscription.etudiant_introuvable'));

    const annee = await this.anneeRetenue(dto.anneeId);
    if (!annee) throw new BadRequestException(t('inscription.aucune_annee_academique_n_est_active'));

    const promotion = await this.prisma.promotion.findUnique({ where: { id: dto.promotionId } });
    if (!promotion) throw new BadRequestException(t('inscription.promotion_introuvable'));
    if (promotion.anneeId !== annee.id) {
      throw new BadRequestException(t('inscription.la_promotion_choisie_n_appartient_pas_a_l_annee_retenue'));
    }

    const existante = await this.prisma.inscription.findUnique({
      where: { etudiantId_anneeId: { etudiantId: dto.etudiantId, anneeId: annee.id } },
      select: { id: true, numero: true, statut: true },
    });
    if (existante && existante.statut !== StatutInscription.ANNULEE) {
      throw new ConflictException(
        t('inscription.un_dossier_existante_numero_existe_deja_pour_etudiant_prenom', {
          'existante.numero': existante.numero,
          'etudiant.prenom': etudiant.prenom,
          'etudiant.nom': etudiant.nom,
          'annee.libelle': annee.libelle,
        }),
      );
    }

    const frais = await this.prisma.frais.findUnique({
      where: { anneeId_promotionId: { anneeId: annee.id, promotionId: promotion.id } },
      select: { montant: true, devise: true },
    });

    // Un dossier ANNULE occupe toujours le couple (étudiant, année) : il est
    // rouvert explicitement plutôt que recréé, ce que l'unicité interdirait.
    if (existante) {
      return this.prisma.$transaction(async (tx) => {
        await exigerAnneeOuverte(tx, annee.id);
        const avant = await tx.inscription.findUnique({ where: { id: existante.id }, include: INSCRIPTION_INCLUDE });
        const reouverture = await tx.inscription.updateMany({
          where: { id: existante.id, statut: StatutInscription.ANNULEE },
          data: {
            promotionId: promotion.id,
            statut: StatutInscription.EN_ATTENTE_PAIEMENT,
            montantFrais: dto.montantFrais ?? frais?.montant ?? 0,
            dateInscription: null,
            valideeParId: null,
            valideeLe: null,
          },
        });
        if (reouverture.count !== 1) {
          throw new ConflictException(t('inscription.statut_modifie_entre_temps'));
        }
        const rouverte = await tx.inscription.findUnique({ where: { id: existante.id }, include: INSCRIPTION_INCLUDE });
        if (!rouverte) throw new NotFoundException(t('inscription.inscription_introuvable'));
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'INSCRIPTION_REOUVERTE',
            entite: 'Inscription',
            entiteId: rouverte.id,
            details: JSON.stringify({ avant: instantaneInscription(avant), apres: instantaneInscription(rouverte) }),
          },
        });
        return rouverte;
      });
    }

    for (let tentative = 0; tentative < 10; tentative++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await exigerAnneeOuverte(tx, annee.id);
          const cree = await tx.inscription.create({
            data: {
              numero: await prochainNumeroInscription(tx, millesimeSerie(SERIES_NUMERO.INSCRIPTION, annee.libelle)),
              etudiantId: dto.etudiantId,
              anneeId: annee.id,
              promotionId: promotion.id,
              statut: StatutInscription.EN_ATTENTE_PAIEMENT,
              montantFrais: dto.montantFrais ?? frais?.montant ?? 0,
            },
            include: INSCRIPTION_INCLUDE,
          });
          await tx.auditLog.create({
            data: {
              userId: user.id,
              action: 'INSCRIPTION_CREE',
              entite: 'Inscription',
              entiteId: cree.id,
              details: JSON.stringify({ avant: null, apres: instantaneInscription(cree) }),
            },
          });
          return cree;
        });
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(t('inscription.numero_de_dossier_temporairement_indisponible_reessayez'));
  }

  // ---------------------------------------------------------- cycle de vie

  /** PAYEE → VALIDEE : la scolarité clôt le dossier, frais réglés et justifiés. */
  async validerInscription(id: string, user: AuthUser) {
    const inscription = await this.trouverInscription(id);
    if (inscription.statut === StatutInscription.ANNULEE) {
      throw new BadRequestException(t('inscription.ce_dossier_est_annule_impossible_de_le_valider'));
    }
    if (inscription.statut !== StatutInscription.PAYEE && inscription.statut !== StatutInscription.VALIDEE) {
      throw new BadRequestException(
        t('inscription.inscription_numero_frais_non_regles_statut_libelle_statut_in', {
          'inscription.numero': inscription.numero,
          'LIBELLE_STATUT_INSCRIPTION[inscription.statut] ?? inscription.statut':
            LIBELLE_STATUT_INSCRIPTION[inscription.statut] ?? inscription.statut,
        }),
      );
    }
    if (inscription.statut === StatutInscription.VALIDEE) return inscription;

    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, inscription.anneeId);
      // Transition conditionnée au statut lu : une annulation concurrente
      // ne peut pas être écrasée par une validation (et inversement).
      const transition = await tx.inscription.updateMany({
        where: { id, statut: StatutInscription.PAYEE },
        data: {
          statut: StatutInscription.VALIDEE,
          dateInscription: new Date(),
          valideeParId: user.id,
          valideeLe: new Date(),
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException(t('inscription.statut_modifie_entre_temps'));
      }
      const maj = await tx.inscription.findUnique({ where: { id }, include: INSCRIPTION_INCLUDE });
      if (!maj) throw new NotFoundException(t('inscription.inscription_introuvable'));
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'INSCRIPTION_VALIDEE',
          entite: 'Inscription',
          entiteId: id,
          details: JSON.stringify({ avant: instantaneInscription(inscription), apres: instantaneInscription(maj) }),
        },
      });
      return maj;
    });
  }

  /** Annulation par la direction ; une inscription validée se garde. */
  async annulerInscription(id: string, user: AuthUser) {
    const inscription = await this.trouverInscription(id);
    if (inscription.statut === StatutInscription.ANNULEE) {
      throw new BadRequestException(t('inscription.ce_dossier_est_deja_annule'));
    }
    if (inscription.statut === StatutInscription.VALIDEE) {
      throw new BadRequestException(
        t('inscription.inscription_numero_est_valide_son_annulation_doit_passer_par', {
          'inscription.numero': inscription.numero,
        }),
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await exigerAnneeOuverte(tx, inscription.anneeId);
      const transition = await tx.inscription.updateMany({
        where: { id, statut: inscription.statut },
        data: { statut: StatutInscription.ANNULEE },
      });
      if (transition.count !== 1) {
        throw new ConflictException(t('inscription.statut_modifie_entre_temps'));
      }
      const maj = await tx.inscription.findUnique({ where: { id }, include: INSCRIPTION_INCLUDE });
      if (!maj) throw new NotFoundException(t('inscription.inscription_introuvable'));
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'INSCRIPTION_ANNULEE',
          entite: 'Inscription',
          entiteId: id,
          details: JSON.stringify({ avant: instantaneInscription(inscription), apres: instantaneInscription(maj) }),
        },
      });
      return maj;
    });
  }

  // ---------------------------------------------------------- impression

  /**
   * Certificat provisoire d'inscription, A4, imprimé en nouvel onglet (jeton
   * vérifié côté contrôleur, comme /feuilles-paie/:id/imprimer).
   */
  async attestationInscription(id: string): Promise<string> {
    const inscription = await this.trouverInscription(id);
    const etablissement = await chargerEtablissement(this.prisma);
    const edite = new Date().toLocaleString('fr-FR');

    // Mêmes règles que le passage en PAYEE : scolarité seule, devise du tarif.
    const devise = await deviseDossier(this.prisma, inscription);
    const paye = (inscription.paiements ?? [])
      .filter((p) => p.statut === StatutPaiement.REUSSI && !p.demandeDocument && p.devise === devise)
      .reduce((t, p) => t + p.montant, 0);
    const restant = Math.max(0, inscription.montantFrais - paye);
    const statut = inscription.statut;

    return pageA4({
      titre: `Certificat d'inscription — ${inscription.numero}`,
      lang: 'fr',
      etablissement,
      styles: STYLE_CERTIFICAT_INSCRIPTION,
      entete: `<div class="etab">${echapper(etablissement.nom)}</div>
    <div class="titre">Certificat d'inscription (provisoire)</div>
    <div class="sous-titre">Document délivré en attendant la validation définitive de la scolarité</div>`,
      corps: `<div class="meta">
    <span>N° dossier : <strong>${echapper(inscription.numero)}</strong></span>
    <span>Statut : <span class="badge ${statut}">${LIBELLE_STATUT_INSCRIPTION[statut] ?? echapper(statut)}</span></span>
    <span>Année académique : ${echapper(inscription.annee.libelle)}</span>
    <span>Édité le ${edite}</span>
  </div>
  <table>
    <tbody>
      <tr><th>Nom &amp; prénom</th><td>${echapper(inscription.etudiant.nom)} ${echapper(inscription.etudiant.prenom)}</td></tr>
      <tr><th>Matricule (INE)</th><td>${echapper(inscription.etudiant.matricule)}</td></tr>
      <tr><th>Filière</th><td>${echapper(inscription.promotion.filiere?.nom ?? '—')}</td></tr>
      <tr><th>Promotion</th><td>${echapper(inscription.promotion.nom)}</td></tr>
      <tr><th>Frais d'inscription</th><td>${inscription.montantFrais.toLocaleString('fr-FR')} ${echapper(devise)}</td></tr>
      <tr><th>Montant réglé</th><td>${paye.toLocaleString('fr-FR')} ${echapper(devise)} (${paye >= inscription.montantFrais ? 'frais soldés' : `reste ${restant.toLocaleString('fr-FR')} ${echapper(devise)}`})</td></tr>
      <tr><th>Date de validation</th><td>${inscription.valideeLe ? echapper(isoDate(inscription.valideeLe)) : '—'}</td></tr>
    </tbody>
  </table>
  <div class="mention">
    Ce certificat atteste le dépôt du dossier de l'étudiant ci-dessus et le règlement
    de ses frais d'inscription pour l'année universitaire indiquée. Il ne vaut
    inscription définitive qu'après validation par le service de la scolarité.
  </div>
  <div class="signatures">
    <div class="signature">L'agent comptable</div>
    <div class="signature">La scolarité</div>
    <div class="signature">Le Directeur des études</div>
  </div>`,
      piedDePage: `<span>UniPrésence — registre des inscriptions</span><span>Édité le ${edite}</span>`,
    });
  }
}

/** Règles propres au certificat d'inscription ; le reste vient de `pageA4`. */
const STYLE_CERTIFICAT_INSCRIPTION = `
  .badge { padding: 2px 8px; font-weight: 700; text-transform: uppercase; }
  .BROUILLON { background: ${P.grisInerte}; color: ${P.encreDouce}; }
  .EN_ATTENTE_PAIEMENT { background: ${P.jauneFond}; color: ${P.jauneTexte}; }
  .PAYEE, .VALIDEE { background: ${P.vertFond}; color: ${P.vert}; }
  .ANNULEE { background: ${P.rougeFond}; color: ${P.rouge}; }
  th { width: 32%; }
  .mention { margin-top: 14px; padding: 8px 10px; border: 1px solid ${P.grisFilet}; background: ${P.grisFond}; font-size: 11px; color: ${P.encreDouce}; }
  .signatures { margin-top: 46px; }
`;
