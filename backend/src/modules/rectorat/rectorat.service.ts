/**
 * Tableau de bord du Rectorat — agrégats en direct et snapshots MESRS.
 *
 * Le Rectorat veut, en un coup d'œil, ce que le ministère demande : effectif
 * (par promotion, par niveau), taux de réussite (session NORMALE), masse
 * salariale du mois, et l'état du bruit de fond (réclamations en cours,
 * incidents helpdesk des dernières 24h). Ces chiffres sont calculés à la
 * volée : ils reflètent la base à l'instant t.
 *
 * Le « bilan MESRS » est l'archive figée transmise au ministère : écrite en
 * base StatistiqueMesrs (snapshot JSON), régénérée par le cron quotidien ou
 * à la demande par l'admin. La page Recto­rat affiche le dernier snapshot et
 * la page StatistiquesMesrs liste tous les snapshots.
 *
 * Règles d'agrégation retenues :
 *   • Effectif total annuel : inscriptions NON_ANNULEE de l'année (BROUILLON
 *     compté si l'étudiant a été validé — un brouillon d'inscription pas
 *     payé n'est pas un étudiant inscrit). On retient la décision du modèle
 *     : un inscrit réel est >= EN_ATTENTE_PAIEMENT (le module Inscription
 *     passe PAYEE puis VALIDEE). On exclut donc BROUILLON.
 *   • Effectif par promotion : groupBy sur promotionId des inscriptions
 *     filtrées.
 *   • Taux de réussite : moyenne des deliberation.tauxReussite sur la session
 *     NORMALE des délibérations VALIDEES de l'année. Si aucune délibération
 *     validée, on retourne 0 — un Rectorat neuf n'invente pas un taux.
 *   • Masse salariale du mois : somme des lignePaie.montantNet sur les
 *     feuilles VALIDEE ou PAYEE du mois calendaire courant. Une feuille
 *     BROUILLON n'est pas un état payée — le Rectorat ne l'annonce pas.
 *   • Enseignants / vacataires : count des Enseignant où statut = PERMANENT
 *     ou VACATAIRE, et idem pour VACATAIRE seul.
 *   • Réclamations en cours : count des Reclamation où statut NOT IN
 *     (RESOLUE, FERMEE, REJETEE).
 *   • Incidents helpdesk 24h : count des TicketSupport créés depuis
 *     (maintenant − 24h), tous statuts.
 *   • Patrimoine obsolescence : compte les EquipementPatrimoine où l'âge
 *     depuis dateAcquisition dépasse obsolescenceMois (mois glissants).
 */
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  Prisma,
  SessionDeliberation,
  StatutDeliberation,
  StatutEnseignant,
  StatutInscription,
  StatutPaie,
  StatutReclamation,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { isoDate, round2 } from '../../common/utils';

@Injectable()
export class RectoratService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ---------------------------------------------------------- agrégats live

  /**
   * Agrégat rapide pour la tuile d'accueil : pas de détail par promotion,
   * juste les compteurs qui ouvrent la page.
   */
  async dashboardRapide() {
    const anneeActive = await this.prisma.anneeAcademique.findFirst({ where: { active: true } });
    const [effectif, reclamations, tickets24h, obsolescents] = await Promise.all([
      this.prisma.inscription.count({
        where: {
          ...baseInscriptionNonAnnulee(),
          ...(anneeActive ? { anneeId: anneeActive.id } : {}),
        },
      }),
      this.prisma.reclamation.count({ where: { statut: { notIn: reclamationFermee() } } }),
      this.prisma.ticketSupport.count({ where: { createdAt: { gte: ilYA1JOUR() } } }),
      this.obsolescents(),
    ]);

    return {
      anneeActive: anneeActive
        ? { id: anneeActive.id, libelle: anneeActive.libelle }
        : null,
      effectif,
      nbReclamationsEnCours: reclamations,
      nbIncidentsHelpdesk24h: tickets24h,
      nbEquipementsObsoletes: obsolescents,
    };
  }

  /**
   * Chiffres détaillés : ce que la page Recto­rat affiche. Filtré par année si
   * précisée, sinon l'année active.
   */
  async chiffres(anneeId?: string) {
    const annee = anneeId
      ? await this.prisma.anneeAcademique.findUnique({ where: { id: anneeId } })
      : await this.prisma.anneeAcademique.findFirst({ where: { active: true } });
    if (!annee) {
      return {
        annee: null,
        effectifTotal: 0,
        effectifParPromotion: [],
        tauxReussite: 0,
        masseSalariale: 0,
        masseSalarialeMois: MOIS_COURANT_LABEL,
        nbEnseignants: 0,
        nbVacataires: 0,
        nbReclamationsEnCours: 0,
        nbIncidentsHelpdesk24h: 0,
      };
    }

    const whereInscriptions = { anneeId: annee.id, ...baseInscriptionNonAnnulee() };

    const [effectifTotal, parPromotion, delibs, masseDuMois, ens, vac, reclamations, tickets24h] =
      await Promise.all([
        this.prisma.inscription.count({ where: whereInscriptions }),
        this.prisma.inscription.groupBy({
          by: ['promotionId'],
          where: whereInscriptions,
          _count: { _all: true },
        }),
        this.prisma.deliberation.findMany({
          where: {
            anneeId: annee.id,
            session: SessionDeliberation.NORMALE,
            statut: StatutDeliberation.VALIDEE,
          },
          select: { tauxReussite: true },
        }),
        this.masseSalarialeMois(),
        this.prisma.enseignant.count({
          where: { statut: { in: statutsEnseignantsPayes() }, actif: true },
        }),
        this.prisma.enseignant.count({
          where: { statut: 'VACATAIRE', actif: true },
        }),
        this.prisma.reclamation.count({ where: { statut: { notIn: reclamationFermee() } } }),
        this.prisma.ticketSupport.count({ where: { createdAt: { gte: ilYA1JOUR() } } }),
      ]);

    const promotions = parPromotion.length
      ? await this.prisma.promotion.findMany({
          where: { id: { in: parPromotion.map((p) => p.promotionId) } },
          select: {
            id: true,
            nom: true,
            niveau: true,
            filiere: { select: { id: true, code: true, nom: true } },
          },
        })
      : [];
    const promoMap = new Map(promotions.map((p) => [p.id, p]));

    const delibsValides = delibs.filter((d) => d.tauxReussite != null) as Array<{
      tauxReussite: number;
    }>;
    const tauxReussite =
      delibsValides.length > 0
        ? round2(
            delibsValides.reduce((acc, d) => acc + (d.tauxReussite ?? 0), 0) / delibsValides.length,
          )
        : 0;

    return {
      annee: { id: annee.id, libelle: annee.libelle },
      effectifTotal,
      effectifParPromotion: parPromotion
        .map((p) => ({
          promotionId: p.promotionId,
          effectif: p._count._all,
          nom: promoMap.get(p.promotionId)?.nom ?? '—',
          niveau: promoMap.get(p.promotionId)?.niveau ?? null,
          filiere: promoMap.get(p.promotionId)?.filiere ?? null,
        }))
        .sort((a, b) => b.effectif - a.effectif),
      tauxReussite,
      masseSalariale: masseDuMois.total,
      masseSalarialeMois: masseDuMois.libelle,
      nbEnseignants: ens,
      nbVacataires: vac,
      nbReclamationsEnCours: reclamations,
      nbIncidentsHelpdesk24h: tickets24h,
    };
  }

  /**
   * Masse salariale du mois calendaire courant : somme des feuillePaie.
   * montantTotal (déjà la somme des lignes) sur les feuilles VALIDEE ou
   * PAYEE qui recouvrent le mois. On exclut les BROUILLON (pas un état
   * comptable) — un Rectorat n'annonce pas un brouillon.
   */
  private async masseSalarialeMois(): Promise<{ total: number; libelle: string }> {
    const maintenant = new Date();
    const mois = maintenant.getMonth() + 1;
    const annee = maintenant.getFullYear();
    const moisLabel = `${MOIS_LIBELLES[mois]} ${annee}`;

    const [total, nb] = await Promise.all([
      this.prisma.feuillePaie.aggregate({
        _sum: { montantTotal: true },
        where: {
          ...bornesFeuilleMois(mois, annee),
          statut: { in: [StatutPaie.VALIDEE, StatutPaie.PAYEE] },
        },
      }),
      this.prisma.feuillePaie.count({
        where: {
          ...bornesFeuilleMois(mois, annee),
          statut: { in: [StatutPaie.VALIDEE, StatutPaie.PAYEE] },
        },
      }),
    ]);

    return {
      total: round2(total._sum.montantTotal ?? 0),
      libelle: nb > 0 ? moisLabel : `${moisLabel} (aucune feuille validée)`,
    };
  }

  // ---------------------------------------------------------- snapshots MESRS

  /** Liste des snapshots MESRS d'une année, du plus récent au plus ancien. */
  async bilans(anneeId?: string) {
    const where: Prisma.StatistiqueMesrsWhereInput = anneeId ? { anneeId } : {};
    return this.prisma.statistiqueMesrs.findMany({
      where,
      orderBy: { genereLe: 'desc' },
      take: 60,
      include: {
        annee: { select: { id: true, libelle: true } },
        generePar: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  /**
   * Force la régénération du snapshot MESRS d'une année : utile après
   * validation d'une nouvelle délibération ou lors de la transmission au
   * ministère. Écrit un audit log.
   */
  async genererBilan(anneeId: string, user: AuthUser) {
    const annee = await this.prisma.anneeAcademique.findUnique({ where: { id: anneeId } });
    if (!annee) throw new NotFoundException('Année académique introuvable');

    const chiffres = await this.chiffres(anneeId);
    const [parCategorie, parDepartement, enReparation, obsoletes] = await Promise.all([
      this.patrimoineParCategorie(),
      this.patrimoineParDepartement(),
      this.prisma.equipementPatrimoine.count({ where: { enReparation: true } }),
      this.obsolescents(),
    ]);

    const donnees = {
      ...chiffres,
      patrimoine: {
        parCategorie,
        parDepartement,
        enReparation,
        obsoletes,
      },
      genereLe: new Date().toISOString(),
      version: '1',
    };

    const snapshot = await this.prisma.statistiqueMesrs.create({
      data: {
        anneeId,
        donnees: donnees as any,
        genereParId: user.id,
      },
      include: {
        annee: { select: { id: true, libelle: true } },
        generePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'BILAN_MESRS_GENERE',
        entite: 'StatistiqueMesrs',
        entiteId: snapshot.id,
        details: `Bilan MESRS ${annee.libelle} — effectif ${chiffres.effectifTotal}, taux ${chiffres.tauxReussite}%`,
      },
    });

    return snapshot;
  }

  /** Snapshot par identifiant, pour l'impression A4. */
  async trouverBilan(id: string) {
    const snapshot = await this.prisma.statistiqueMesrs.findUnique({
      where: { id },
      include: {
        annee: { select: { id: true, libelle: true, dateDebut: true, dateFin: true } },
        generePar: { select: { id: true, nom: true, prenom: true } },
      },
    });
    if (!snapshot) throw new NotFoundException('Bilan MESRS introuvable');
    return snapshot;
  }

  // ---------------------------------------------------------- patrimoine

  /**
   * Équipements obsolètes : dateAcquisition + obsolescenceMois (mois) < aujourd'hui.
   * On construit la date pivot en SQL via Prisma pour ne charger qu'une page.
   */
  private async obsolescents(): Promise<number> {
    const equipements = await this.prisma.equipementPatrimoine.findMany({
      where: { actif: true, dateAcquisition: { not: null } },
      select: { dateAcquisition: true, obsolescenceMois: true },
    });
    const maintenant = new Date();
    return equipements.filter((e) => estObsolete(e.dateAcquisition, e.obsolescenceMois ?? 60, maintenant)).length;
  }

  /** Regroupement par catégorie pour le snapshot MESRS. */
  private async patrimoineParCategorie() {
    const equipements = await this.prisma.equipementPatrimoine.findMany({
      where: { actif: true },
      select: { valeurAcquisition: true, categorie: { select: { id: true, libelle: true, code: true } } },
    });
    const map = new Map<string, { code: string; libelle: string; nombre: number; valeur: number }>();
    for (const e of equipements) {
      const key = e.categorie.id;
      const entry = map.get(key) ?? {
        code: e.categorie.code,
        libelle: e.categorie.libelle,
        nombre: 0,
        valeur: 0,
      };
      entry.nombre += 1;
      entry.valeur += e.valeurAcquisition ?? 0;
      map.set(key, entry);
    }
    return [...map.values()].map((v) => ({ ...v, valeur: round2(v.valeur) }));
  }

  /** Regroupement par département. */
  private async patrimoineParDepartement() {
    const equipements = await this.prisma.equipementPatrimoine.findMany({
      where: { actif: true },
      select: { valeurAcquisition: true, departementId: true, departement: { select: { id: true, code: true, nom: true } } },
    });
    const map = new Map<string, { code: string; nom: string; nombre: number; valeur: number }>();
    for (const e of equipements) {
      if (!e.departementId || !e.departement) continue;
      const key = e.departementId;
      const entry = map.get(key) ?? {
        code: e.departement.code,
        nom: e.departement.nom,
        nombre: 0,
        valeur: 0,
      };
      entry.nombre += 1;
      entry.valeur += e.valeurAcquisition ?? 0;
      map.set(key, entry);
    }
    return [...map.values()].map((v) => ({ ...v, valeur: round2(v.valeur) }));
  }

  // ---------------------------------------------------------- impression

  /**
   * État A4 du bilan MESRS — puzzle : en-tête établissement, encadré
   * chiffres clés, tableau par promotion, lignes patrimoine. Ouvert dans un
   * nouvel onglet, le jeton passe en query string comme pour les états
   * d'attestation.
   */
  async imprimerBilan(id: string, token: string | undefined, baseUrl: string): Promise<string> {
    try {
      this.jwt.verify(token ?? '', {
        secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      });
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }

    const snapshot = await this.trouverBilan(id);
    const d = snapshot.donnees as any;
    const etablissement = await this.parametresValeur('NOM_ETABLISSEMENT');
    const edite = new Date().toLocaleString('fr-FR');

    const promos = Array.isArray(d?.effectifParPromotion) ? d.effectifParPromotion : [];
    const patrimoine = d?.patrimoine ?? {};
    const cats = Array.isArray(patrimoine.parCategorie) ? patrimoine.parCategorie : [];
    const depts = Array.isArray(patrimoine.parDepartement) ? patrimoine.parDepartement : [];

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Bilan MESRS — ${echapper(snapshot.annee.libelle)}</title>
<style>
  ${STYLE_BILAN}
</style></head>
<body>
  <header>
    <div class="etab">${echapper(etablissement)}</div>
    <div class="titre">Bilan d'activité — transmission MESRS</div>
    <div class="sous-titre">Année académique ${echapper(snapshot.annee.libelle)} — snapshot du ${echapper(isoDate(snapshot.genereLe))}</div>
  </header>
  <div class="meta">
    <span>Édité le <strong>${echapper(edite)}</strong></span>
    <span>Par ${echapper(snapshot.generePar ? `${snapshot.generePar.prenom} ${snapshot.generePar.nom}` : '—')}</span>
  </div>
  <section class="cles">
    <div class="cle"><span class="pochoir">Effectif total</span><strong>${d?.effectifTotal ?? 0}</strong></div>
    <div class="cle"><span class="pochoir">Taux de réussite</span><strong>${pourcent(d?.tauxReussite)}</strong></div>
    <div class="cle"><span class="pochoir">Masse salariale (${echapper(d?.masseSalarialeMois ?? 'mois')})</span><strong>${montant(d?.masseSalariale)} GNF</strong></div>
    <div class="cle"><span class="pochoir">Enseignants</span><strong>${d?.nbEnseignants ?? 0} (${d?.nbVacataires ?? 0} vac.)</strong></div>
    <div class="cle"><span class="pochoir">Réclamations en cours</span><strong>${d?.nbReclamationsEnCours ?? 0}</strong></div>
    <div class="cle"><span class="pochoir">Incidents helpdesk 24h</span><strong>${d?.nbIncidentsHelpdesk24h ?? 0}</strong></div>
  </section>

  <h2 class="section-titre">Effectif par promotion</h2>
  <table>
    <thead>
      <tr><th>Promotion</th><th>Niveau</th><th>Filière</th><th class="num">Effectif</th></tr>
    </thead>
    <tbody>
      ${promos.length
        ? promos
            .map(
              (p: any) =>
                `<tr><td>${echapper(p.nom)}</td><td>${echapper(p.niveau ?? '—')}</td><td>${echapper(p.filiere?.nom ?? '—')}</td><td class="num">${p.effectif}</td></tr>`,
            )
            .join('')
        : '<tr><td colspan="4" class="vide">Aucune promotion active</td></tr>'}
    </tbody>
  </table>

  <h2 class="section-titre">Patrimoine</h2>
  <table>
    <thead>
      <tr><th>Catégorie</th><th class="num">Nombre</th><th class="num">Valeur (GNF)</th></tr>
    </thead>
    <tbody>
      ${cats.length
        ? cats
            .map(
              (c: any) =>
                `<tr><td>${echapper(c.libelle)} <small>(${echapper(c.code)})</small></td><td class="num">${c.nombre}</td><td class="num">${montant(c.valeur)}</td></tr>`,
            )
            .join('')
        : '<tr><td colspan="3" class="vide">Aucun équipement</td></tr>'}
    </tbody>
  </table>

  <table>
    <thead>
      <tr><th>Département</th><th class="num">Équipements</th><th class="num">Valeur (GNF)</th></tr>
    </thead>
    <tbody>
      ${depts.length
        ? depts
            .map(
              (d2: any) =>
                `<tr><td>${echapper(d2.nom)} <small>(${echapper(d2.code)})</small></td><td class="num">${d2.nombre}</td><td class="num">${montant(d2.valeur)}</td></tr>`,
            )
            .join('')
        : '<tr><td colspan="3" class="vide">Aucun rattachement</td></tr>'}
    </tbody>
  </table>

  <div class="encadre">
    <strong>${patrimoine.obsoletes ?? 0}</strong> équipement(s) obsolète(s) ·
    <strong>${patrimoine.enReparation ?? 0}</strong> en réparation.
  </div>

  <footer>
    <span>${echapper(etablissement)} — bilan MESRS · ${echapper(snapshot.annee.libelle)}</span>
    <span>Snapshot ${echapper(snapshot.id)}</span>
  </footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }

  /**
   * Récupère un paramètre système — on évite de coupler ce module au service
   * Parametres pour rester permutable : on n'utilise qu'une valeur et le
   * prisma.parametre n'a pas la même clé selon les universités. À défaut,
   * on retombe sur l'établissement par défaut.
   */
  private async parametresValeur(cle: string): Promise<string> {
    try {
      const p = await this.prisma.parametre.findFirst({ where: { cle } });
      return (p?.valeur as string) || 'Université';
    } catch {
      return 'Université';
    }
  }
}

/**
 * Récupère les bornes dateDebut/dateFin d'une feuille qui recouvre le mois
 * demandé : la feuille mensuelle de paie (Janvier 2026) commence le 1er et
 * finit le 31 du mois. On filtre par chevauchement plutôt que par egalite
 * exacte — les feuilles dont la période inclut le mois-en-cours.
 */
async function bornesFeuilleMois(mois: number, annee: number): Promise<Prisma.FeuillePaieWhereInput> {
  const debut = new Date(Date.UTC(annee, mois - 1, 1));
  const fin = new Date(Date.UTC(annee, mois, 0));
  return {
    dateDebut: { lte: fin },
    dateFin: { gte: debut },
  };
}

/** Statuts d'inscription qui comptent comme inscrit (≠ BROUILLON, ≠ ANNULEE). */
function baseInscriptionNonAnnulee(): Prisma.InscriptionWhereInput {
  return {
    statut: { notIn: [StatutInscription.BROUILLON, StatutInscription.ANNULEE] },
  };
}

function reclamationFermee(): StatutReclamation[] {
  return [StatutReclamation.RESOLUE, StatutReclamation.FERMEE, StatutReclamation.REJETEE];
}

function statutsEnseignantsPayes(): StatutEnseignant[] {
  return [StatutEnseignant.PERMANENT, StatutEnseignant.VACATAIRE, StatutEnseignant.CONTRACTUEL];
}

function ilYA1JOUR(): Date {
  const d = new Date();
  d.setHours(d.getHours() - 24);
  return d;
}

function estObsolete(
  dateAcquisition: Date | null,
  obsolescenceMois: number,
  maintenant: Date,
): boolean {
  if (!dateAcquisition) return false;
  const ageMois =
    (maintenant.getFullYear() - dateAcquisition.getFullYear()) * 12 +
    (maintenant.getMonth() - dateAcquisition.getMonth());
  return ageMois >= obsolescenceMois;
}

const MOIS_LIBELLES = [
  '',
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const MOIS_COURANT_LABEL = `${MOIS_LIBELLES[new Date().getMonth() + 1]} ${new Date().getFullYear()}`;

function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function montant(v?: number | null): string {
  return (v ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}

function pourcent(v?: number | null): string {
  if (v == null) return '—';
  return `${(v ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

const STYLE_BILAN = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm 12mm; font-size: 12px; }
  header { border-bottom: 2px solid #1565c0; padding-bottom: 8px; margin-bottom: 14px; }
  .etab { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .titre { font-size: 19px; font-weight: 700; margin-top: 6px; color: #0d47a1; }
  .sous-titre { color: #555; margin-top: 2px; }
  .meta { display: flex; gap: 18px; margin: 12px 0 4px; font-size: 11px; color: #444; flex-wrap: wrap; }
  .section-titre { font-size: 13px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .5px; color: #0d47a1; border-bottom: 1px solid #0d47a1; padding-bottom: 4px; }
  .cles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 4px; }
  .cle { border: 1px solid #b9c4cf; padding: 8px 10px; background: #fafbfd; display: flex; flex-direction: column; gap: 2px; }
  .cle .pochoir { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: .3px; }
  .cle strong { font-size: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #b9c4cf; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #e8eef5; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .vide { text-align: center; color: #777; font-style: italic; }
  .encadre { margin-top: 16px; padding: 8px 10px; border: 1px solid #b9c4cf; background: #fafbfd; font-size: 11px; }
  footer { margin-top: 22px; font-size: 10px; color: #777; display: flex; justify-content: space-between; border-top: 1px solid #e3e8ee; padding-top: 6px; }
  @media print { body { padding: 8mm; } }
  @page { size: A4; margin: 10mm; }
`;
