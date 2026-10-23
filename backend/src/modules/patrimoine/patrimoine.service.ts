/**
 * Patrimoine & matériel pédagogique — services.
 *
 * Le service s'articule autour de trois CrudService parallèles (catégories,
 * équipements, réparations) et de méthodes spécifiques : déclaration d'une
 * réparation (ouvre EN_COURS, marque l'équipement enReparation=true),
 * résolution (statut TERMINE, libère l'équipement), génération du QR
 * d'inventaire et impression de l'étiquette A4.
 *
 * Règles d'intégrité :
 *   - Une catégorie ne se supprime pas si des équipements y restent liés.
 *   - Un équipement ne se supprime pas si une réparation a été consignée.
 *   - Le qrCode et le numeroInventaire sont générés si vides à la création.
 *   - L'impression d'étiquette est publique + jeton : la fenêtre ouverte
 *     depuis l'écran n'envoie pas l'en-tête Authorization.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, StatutReparation } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import * as QRCode from 'qrcode';
import { AuthUser } from '../../common/decorators';
import { CrudService } from '../../common/crud.service';
import { PrismaService } from '../../prisma/prisma.service';
import { t } from '../../common/i18n';
import { chargerEtablissement, echapper, pageA4, PALETTE_IMPRESSION, STYLE_ETIQUETTES } from '../../common/impression';
import {
  CreateCategorieDto,
  CreateEquipementDto,
  DeclarationReparationDto,
  EquipementQueryDto,
  ResolutionReparationDto,
  UpdateCategorieDto,
  UpdateEquipementDto,
} from './patrimoine.dto';
import { paginer, pagine } from '../../common/pagination';
import { journaliser } from '../../common/audit';

const PREFIX_INVENTAIRE = 'PAT-';
const QR_PREFIX = 'UP-PAT-';

const CATEGORIE_INCLUDE = {
  _count: { select: { equipements: true } },
} satisfies Prisma.CategoriePatrimoineInclude;

const EQUIPEMENT_INCLUDE = {
  categorie: { select: { id: true, code: true, libelle: true } },
  departement: { select: { id: true, code: true, nom: true } },
  salle: { select: { id: true, code: true, nom: true } },
  _count: { select: { reparations: true, tickets: true } },
} satisfies Prisma.EquipementPatrimoineInclude;

const REPARATION_INCLUDE = {
  equipement: { select: { id: true, libelle: true, numeroInventaire: true } },
  declarePar: { select: { id: true, nom: true, prenom: true } },
  resoluPar: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.ReparationMaterielInclude;

@Injectable()
export class PatrimoineService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ============================================================ Catégories

  private get categoriesService(): CrudService {
    return new CrudService(this.prisma, 'categoriePatrimoine', {
      orderBy: { libelle: 'asc' },
      include: CATEGORIE_INCLUDE,
      searchFields: ['code', 'libelle'],
      label: 'Catégorie',
    });
  }

  async listeCategories() {
    return this.categoriesService.findAll({ all: '1' } as any, {});
  }

  async detailCategorie(id: string) {
    return this.categoriesService.findOne(id);
  }

  /**
   * Les écritures du module passent par le client transactionnel plutôt que
   * par le CrudService : la mutation et son entrée de journal sont validées
   * ensemble, ce que le CrudService (hors transaction) ne permet pas.
   */
  async creerCategorie(dto: CreateCategorieDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const categorie = await tx.categoriePatrimoine.create({
        data: {
          code: dto.code.trim(),
          libelle: dto.libelle.trim(),
          ...(dto.dureeAmortissement ? { dureeAmortissement: dto.dureeAmortissement } : {}),
        },
        include: CATEGORIE_INCLUDE,
      });
      await journaliser(tx, user, 'PATRIMOINE_CATEGORIE_CREEE', 'CategoriePatrimoine', categorie.id, {
        avant: null,
        apres: this.instantaneCategorie(categorie),
        champsModifies: ['code', 'libelle', 'dureeAmortissement'],
      });
      return categorie;
    });
  }

  async modifierCategorie(id: string, dto: UpdateCategorieDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await this.categorieCourante(tx, id);
      const data = {
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.libelle !== undefined ? { libelle: dto.libelle.trim() } : {}),
        ...(dto.dureeAmortissement !== undefined
          ? { dureeAmortissement: dto.dureeAmortissement }
          : {}),
      };
      const apres = await tx.categoriePatrimoine.update({
        where: { id },
        data,
        include: CATEGORIE_INCLUDE,
      });
      await journaliser(tx, user, 'PATRIMOINE_CATEGORIE_MODIFIEE', 'CategoriePatrimoine', id, {
        avant: this.instantaneCategorie(avant),
        apres: this.instantaneCategorie(apres),
        champsModifies: Object.keys(data),
      });
      return apres;
    });
  }

  /**
   * Suppression d'une catégorie : refusée si elle a encore des équipements.
   * C'est la règle inscrite dans le cahier des charges — un équipement
   * orphelin de catégorie perdrait son libellé.
   */
  async supprimerCategorie(id: string, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      const cat = await this.categorieCourante(tx, id);
      if (cat._count && (cat._count as any).equipements > 0) {
        throw new ConflictException(t('patrimoine.categorie_cat_libelle_cat_count_as_any_equipements_equipemen', { 'cat.libelle': cat.libelle, '(cat._count as any).equipements': (cat._count as any).equipements }));
      }
      await tx.categoriePatrimoine.delete({ where: { id } });
      await journaliser(tx, user, 'PATRIMOINE_CATEGORIE_SUPPRIMEE', 'CategoriePatrimoine', id, {
        avant: this.instantaneCategorie(cat),
        apres: null,
        champsModifies: ['code', 'libelle', 'dureeAmortissement'],
      });
    });
    return { id };
  }

  // ============================================================ Équipements

  /**
   * Liste paginée, filtrable par texte, catégorie, département, état actif,
   * état en réparation. La fulltext « search » balaie libellé, numéro de
   * série, numéro d'inventaire et qrCode.
   */
  async listeEquipements(query: EquipementQueryDto) {
    const pagination = paginer(query);

    const where: Prisma.EquipementPatrimoineWhereInput = {
      ...(query.categorieId ? { categorieId: query.categorieId } : {}),
      ...(query.departementId ? { departementId: query.departementId } : {}),
      ...(query.actif != null ? { actif: query.actif === 'true' || query.actif === '1' } : {}),
      ...(query.enReparation != null
        ? { enReparation: query.enReparation === 'true' || query.enReparation === '1' }
        : {}),
      ...(query.search
        ? {
            OR: [
              { libelle: { contains: query.search, mode: 'insensitive' } },
              { numeroSerie: { contains: query.search, mode: 'insensitive' } },
              { numeroInventaire: { contains: query.search, mode: 'insensitive' } },
              { qrCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.equipementPatrimoine.findMany({
        where,
        include: EQUIPEMENT_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.equipementPatrimoine.count({ where }),
    ]);
    return pagine(data, total, pagination);
  }

  async detailEquipement(id: string) {
    return this.trouverEquipement(id);
  }

  /**
   * Création d'un équipement : numéro d'inventaire et qrCode générés si
   * vides. La contrainte d'unicité départage les collisions : un retry
   * recommence avec un nouveau qrCode.
   */
  async creerEquipement(dto: CreateEquipementDto, user: AuthUser) {
    const numeroInventaire = dto.numeroInventaire.trim();
    const numeroSerie = dto.numeroSerie.trim();

    for (let tentative = 0; tentative < 10; tentative++) {
      const qrCode = `${QR_PREFIX}${randomBytes(12).toString('base64url')}`;
      try {
        return await this.prisma.$transaction(async (tx) => {
          const equipement = await tx.equipementPatrimoine.create({
            data: {
              numeroSerie,
              libelle: dto.libelle.trim(),
              categorieId: dto.categorieId,
              departementId: dto.departementId ?? null,
              salleId: dto.salleId ?? null,
              dateAcquisition: dto.dateAcquisition ? new Date(dto.dateAcquisition) : null,
              valeurAcquisition: dto.valeurAcquisition ?? null,
              numeroInventaire,
              qrCode,
              obsolescenceMois: dto.obsolescenceMois ?? 60,
              actif: dto.actif !== undefined ? dto.actif === 'true' || dto.actif === '1' : true,
            },
            include: EQUIPEMENT_INCLUDE,
          });
          // Le jeton QR n'est pas recopié : l'inventaire se lit par son numéro.
          await journaliser(tx, user, 'PATRIMOINE_EQUIPEMENT_CREE', 'EquipementPatrimoine', equipement.id, {
            avant: null,
            apres: this.instantaneEquipement(equipement),
            champsModifies: ['numeroSerie', 'numeroInventaire', 'libelle', 'categorieId', 'actif'],
          });
          return equipement;
        });
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          // Conflit d'unicité : on réessaie avec un nouveau qrCode.
          const cible = (e.meta?.target as string[]) ?? [];
          if (cible.includes('qrCode')) continue;
          if (cible.includes('numeroSerie')) {
            throw new BadRequestException(
              `Un équipement porte déjà le numéro de série ${numeroSerie}`,
            );
          }
          if (cible.includes('numeroInventaire')) {
            throw new BadRequestException(
              `Un équipement porte déjà le numéro d'inventaire ${numeroInventaire}`,
            );
          }
        }
        throw e;
      }
    }
    throw new ConflictException(t('patrimoine.impossible_de_generer_un_identifiant_qr_unique_reessayez'));
  }

  async modifierEquipement(id: string, dto: UpdateEquipementDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const avant = await this.equipementCourant(tx, id);
      const data = {
        ...(dto.numeroSerie !== undefined ? { numeroSerie: dto.numeroSerie.trim() } : {}),
        ...(dto.libelle !== undefined ? { libelle: dto.libelle.trim() } : {}),
        ...(dto.categorieId !== undefined ? { categorieId: dto.categorieId } : {}),
        ...(dto.departementId !== undefined ? { departementId: dto.departementId } : {}),
        ...(dto.salleId !== undefined ? { salleId: dto.salleId } : {}),
        ...(dto.dateAcquisition !== undefined
          ? { dateAcquisition: dto.dateAcquisition ? new Date(dto.dateAcquisition) : null }
          : {}),
        ...(dto.valeurAcquisition !== undefined
          ? { valeurAcquisition: dto.valeurAcquisition }
          : {}),
        ...(dto.numeroInventaire !== undefined
          ? { numeroInventaire: dto.numeroInventaire.trim() }
          : {}),
        ...(dto.obsolescenceMois !== undefined
          ? { obsolescenceMois: dto.obsolescenceMois }
          : {}),
        ...(dto.actif !== undefined
          ? { actif: dto.actif === 'true' || dto.actif === '1' }
          : {}),
      };
      const maj = await tx.equipementPatrimoine.update({
        where: { id },
        data,
        include: EQUIPEMENT_INCLUDE,
      });
      await journaliser(tx, user, 'PATRIMOINE_EQUIPEMENT_MODIFIE', 'EquipementPatrimoine', id, {
        avant: this.instantaneEquipement(avant),
        apres: this.instantaneEquipement(maj),
        champsModifies: Object.keys(data),
      });
      return maj;
    });
  }

  /**
   * Suppression d'un équipement : refusée si une réparation a été consignée,
   * car la trace comptable est ce qui justifie l'inventaire. L'admin peut
   * désactiver (actif=false) à la place.
   */
  async supprimerEquipement(id: string, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      const equipement = await this.equipementCourant(tx, id);
      const reparations = await tx.reparationMateriel.count({ where: { equipementId: id } });
      if (reparations > 0) {
        throw new ConflictException(t('patrimoine.equipement_numeroinventaire_reparations_reparation_s_consign', { 'equipement.numeroInventaire': equipement.numeroInventaire, reparations }));
      }
      await tx.equipementPatrimoine.delete({ where: { id } });
      await journaliser(tx, user, 'PATRIMOINE_EQUIPEMENT_SUPPRIME', 'EquipementPatrimoine', id, {
        avant: this.instantaneEquipement(equipement),
        apres: null,
        nbReparations: 0,
      });
    });
    return { id };
  }

  /**
   * Régénération du QR d'équipement : utile si l'étiquette est devenue
   * illisible ou compromise. Le nouveau token est aléatoire et remplace
   * l'ancien — ni l'ancien ni le nouveau ne sont journalisés, seule la
   * régénération est tracée, avec son auteur.
   */
  async regenererQr(id: string, user: AuthUser) {
    for (let tentative = 0; tentative < 10; tentative++) {
      const qrCode = `${QR_PREFIX}${randomBytes(12).toString('base64url')}`;
      try {
        return await this.prisma.$transaction(async (tx) => {
          const equipement = await this.equipementCourant(tx, id);
          const maj = await tx.equipementPatrimoine.update({
            where: { id },
            data: { qrCode },
            include: EQUIPEMENT_INCLUDE,
          });
          await journaliser(tx, user, 'PATRIMOINE_QR_REGENERE', 'EquipementPatrimoine', id, {
            avant: this.instantaneEquipement(equipement),
            apres: this.instantaneEquipement(maj),
            champsModifies: ['qrCode'],
            jetonsConserves: false,
          });
          return maj;
        });
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException(t('patrimoine.impossible_de_generer_un_qr_unique_reessayez'));
  }

  /**
   * Résolution publique par QR : le QR imprimé appelle cette route. Comme
   * pour le helpdesk, le token est public — un QR forgé ne résout rien.
   */
  async parQr(qrCode: string) {
    const equipement = await this.prisma.equipementPatrimoine.findUnique({
      where: { qrCode },
      select: {
        id: true,
        libelle: true,
        actif: true,
        categorie: { select: { id: true, code: true, libelle: true } },
        departement: { select: { nom: true } },
        salle: { select: { id: true, code: true, nom: true } },
      },
    });
    if (!equipement || !equipement.actif) {
      throw new NotFoundException(t('patrimoine.equipement_introuvable_pour_ce_qr'));
    }
    return equipement;
  }

  // ============================================================ Réparations

  /**
   * Déclaration d'une réparation : la première intervention crée la fiche
   * et bascule l'équipement en « en réparation ». Si une fiche est déjà
   * ouverte (DECLARE ou EN_COURS), on refuse pour éviter le double
   * comptage. Le contrôle, l'ouverture de la fiche, le basculement de
   * l'équipement et le journal forment un seul écrit : deux déclarations
   * simultanées ne peuvent pas laisser deux fiches ouvertes, ni une fiche
   * sans trace.
   */
  async declarerReparation(
    equipementId: string,
    dto: DeclarationReparationDto,
    user: AuthUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const equipement = await this.equipementCourant(tx, equipementId);
      const ouverte = await tx.reparationMateriel.findFirst({
        where: {
          equipementId,
          statut: { in: [StatutReparation.DECLARE, StatutReparation.EN_COURS] },
        },
      });
      if (ouverte) {
        throw new ConflictException(t('patrimoine.equipement_numeroinventaire_a_deja_une_reparation_en_cours_o', { 'equipement.numeroInventaire': equipement.numeroInventaire, 'ouverte.statut': ouverte.statut }));
      }
      const reparation = await tx.reparationMateriel.create({
        data: {
          equipementId,
          description: dto.description.trim(),
          prestataire: dto.prestataire?.trim() ?? null,
          cout: dto.cout ?? 0,
          statut: StatutReparation.EN_COURS,
          dateResolution: dto.dateResolution ? new Date(dto.dateResolution) : null,
          declareParId: user.id,
        },
        include: REPARATION_INCLUDE,
      });
      const equipementApres = await tx.equipementPatrimoine.update({
        where: { id: equipementId },
        data: { enReparation: true },
        include: EQUIPEMENT_INCLUDE,
      });
      await journaliser(tx, user, 'PATRIMOINE_REPARATION_DECLAREE', 'ReparationMateriel', reparation.id, {
        avant: null,
        apres: this.instantaneReparation(reparation),
        equipementAvant: this.instantaneEquipement(equipement),
        equipementApres: this.instantaneEquipement(equipementApres),
        champsModifies: ['statut', 'enReparation'],
      });
      return reparation;
    });
  }

  /**
   * Résolution : la dernière fiche ouverte passe TERMINE, sa note est
   * consignée, l'équipement reprend son état normal. Clôture de la fiche et
   * libération de l'équipement partagent la transaction et leur journal.
   */
  async resoudreReparation(
    equipementId: string,
    dto: ResolutionReparationDto,
    user: AuthUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const equipement = await this.equipementCourant(tx, equipementId);
      const ouverte = await tx.reparationMateriel.findFirst({
        where: {
          equipementId,
          statut: { in: [StatutReparation.DECLARE, StatutReparation.EN_COURS] },
        },
        orderBy: { dateDeclaration: 'desc' },
      });
      if (!ouverte) {
        throw new BadRequestException(t('patrimoine.equipement_numeroinventaire_n_a_pas_de_reparation_en_cours', { 'equipement.numeroInventaire': equipement.numeroInventaire }));
      }
      const reparation = await tx.reparationMateriel.update({
        where: { id: ouverte.id },
        data: {
          statut: StatutReparation.TERMINE,
          dateResolution: ouverte.dateResolution ?? new Date(),
          resoluParId: user.id,
          notes: dto.noteResolution?.trim() ?? ouverte.notes ?? null,
        },
        include: REPARATION_INCLUDE,
      });
      const equipementApres = await tx.equipementPatrimoine.update({
        where: { id: equipementId },
        data: { enReparation: false },
        include: EQUIPEMENT_INCLUDE,
      });
      await journaliser(tx, user, 'PATRIMOINE_REPARATION_RESOLUE', 'ReparationMateriel', ouverte.id, {
        avant: this.instantaneReparation(ouverte),
        apres: this.instantaneReparation(reparation),
        equipementAvant: this.instantaneEquipement(equipement),
        equipementApres: this.instantaneEquipement(equipementApres),
        champsModifies: ['statut', 'dateResolution', 'resoluParId', 'enReparation'],
        noteResolutionFournie: Boolean(dto.noteResolution?.trim()),
      });
      return reparation;
    });
  }

  async reparations(equipementId: string) {
    await this.trouverEquipement(equipementId);
    return this.prisma.reparationMateriel.findMany({
      where: { equipementId },
      include: REPARATION_INCLUDE,
      orderBy: { dateDeclaration: 'desc' },
    });
  }

  /**
   * Registre global des réparations, tous équipements confondus. Le filtre
   * statut est optionnel : passé en query string, le front laisse le libre
   * choix (les « ouvertes » sont DECLARE + EN_COURS).
   */
  async listeReparations(filtres: { statut?: string }) {
    const where: Prisma.ReparationMaterielWhereInput = filtres.statut
      ? { statut: filtres.statut as StatutReparation }
      : {};
    return this.prisma.reparationMateriel.findMany({
      where,
      include: {
        equipement: { select: { id: true, libelle: true, numeroInventaire: true } },
        declarePar: { select: { id: true, nom: true, prenom: true } },
        resoluPar: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { dateDeclaration: 'desc' },
      take: 1000,
    });
  }

  /**
   * Toutes les réparations en cours, tous équipements confondus : pour
   * l'onglet « Réparations » du front. Triées par ancienneté, les plus
   * anciennes en premier (l'œil se pose sur ce qui traîne).
   */
  async reparationsEnCours() {
    return this.prisma.reparationMateriel.findMany({
      where: { statut: { in: [StatutReparation.DECLARE, StatutReparation.EN_COURS] } },
      include: REPARATION_INCLUDE,
      orderBy: { dateDeclaration: 'asc' },
    });
  }

  // ============================================================ Dashboard

  /**
   * Dashboard patrimoine : total, valeur, répartition par catégorie et
   * département, en réparation, obsolètes. Filtré si une année est donnée
   * (les acquisitions de l'année).
   */
  async dashboard(anneeId?: string) {
    const annee = anneeId
      ? await this.prisma.anneeAcademique.findUnique({
          where: { id: anneeId },
          select: { dateDebut: true, dateFin: true },
        })
      : null;
    if (anneeId && !annee) throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Année académique' }));

    const where: Prisma.EquipementPatrimoineWhereInput = {
      actif: true,
      ...(annee ? { dateAcquisition: { gte: annee.dateDebut, lte: annee.dateFin } } : {}),
    };
    const [totaux, categories, departements, enReparation, obsoletes] = await Promise.all([
      this.prisma.equipementPatrimoine.aggregate({
        where,
        _count: { _all: true },
        _sum: { valeurAcquisition: true },
      }),
      this.prisma.equipementPatrimoine.groupBy({
        by: ['categorieId'], where, _count: { _all: true }, _sum: { valeurAcquisition: true },
      }),
      this.prisma.equipementPatrimoine.groupBy({
        by: ['departementId'], where: { ...where, departementId: { not: null } },
        _count: { _all: true }, _sum: { valeurAcquisition: true },
      }),
      this.prisma.equipementPatrimoine.count({ where: { ...where, enReparation: true } }),
      this.obsolescenceActuelle(where),
    ]);
    // Recharger uniquement les libellés des groupes présents, jamais toutes
    // les lignes d'équipement du parc.
    const [categoriesNommees, departementsNommes] = await Promise.all([
      categories.length ? this.prisma.categoriePatrimoine.findMany({
        where: { id: { in: categories.map((g) => g.categorieId) } },
        select: { id: true, code: true, libelle: true },
      }) : Promise.resolve([]),
      departements.length ? this.prisma.departement.findMany({
        where: { id: { in: departements.map((g) => g.departementId!).filter(Boolean) } },
        select: { id: true, code: true, nom: true },
      }) : Promise.resolve([]),
    ]);
    const categoriesParId = new Map<string, { id: string; code: string; libelle: string }>(
      categoriesNommees.map((c: any) => [c.id, c] as const),
    );
    const departementsParId = new Map<string, { id: string; code: string; nom: string }>(
      departementsNommes.map((d: any) => [d.id, d] as const),
    );
    const parCategorie = categories.flatMap((g) => {
      const c = categoriesParId.get(g.categorieId);
      return c ? [{ code: c.code, libelle: c.libelle, nombre: g._count._all, valeur: g._sum.valeurAcquisition ?? 0 }] : [];
    }).sort((a, b) => b.nombre - a.nombre);
    const parDepartement = departements.flatMap((g) => {
      const d = g.departementId ? departementsParId.get(g.departementId) : undefined;
      return d ? [{ code: d.code, nom: d.nom, nombre: g._count._all, valeur: g._sum.valeurAcquisition ?? 0 }] : [];
    }).sort((a, b) => b.nombre - a.nombre);

    return {
      total: totaux._count._all,
      valeur: Math.round(totaux._sum.valeurAcquisition ?? 0),
      enReparation,
      obsoletes,
      parCategorie,
      parDepartement,
    };
  }

  private async obsolescenceActuelle(where: Prisma.EquipementPatrimoineWhereInput): Promise<number> {
    const parAnnee = where.dateAcquisition as Prisma.DateTimeFilter | undefined;
    const bornes = parAnnee?.gte && parAnnee.lte
      ? Prisma.sql`AND "dateAcquisition" >= ${parAnnee.gte} AND "dateAcquisition" <= ${parAnnee.lte}`
      : Prisma.empty;
    const lignes = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "EquipementPatrimoine"
      WHERE "actif" = true
        AND "dateAcquisition" IS NOT NULL
        AND date_trunc('month', "dateAcquisition")
          + make_interval(months => COALESCE("obsolescenceMois", 60)) <= date_trunc('month', NOW())
        ${bornes}
    `);
    return Number(lignes[0]?.count ?? 0);
  }

  // ============================================================ Étiquette A4

  /**
   * Étiquette A4 d'un équipement : ouverte dans un nouvel onglet, le jeton
   * est vérifié à la main (le navigateur n'envoie pas l'Authorization sur
   * window.open).
   */
  async imprimerEtiquette(id: string, token: string | undefined, baseUrl: string): Promise<string> {
    try {
      this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException(t('patrimoine.jeton_invalide_ou_expire'));
    }

    const equipement = await this.trouverEquipement(id);
    const urlInventaire = `${baseUrl.replace(/\/+$/, '')}/#/patrimoine?qr=${encodeURIComponent(equipement.qrCode)}`;
    const qr = await QRCode.toDataURL(urlInventaire, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    const valeur = equipement.valeurAcquisition
      ? `${equipement.valeurAcquisition.toLocaleString('fr-FR')} GNF`
      : '—';
    const dateAquis = equipement.dateAcquisition
      ? new Date(equipement.dateAcquisition).toLocaleDateString('fr-FR')
      : '—';

    const etiquettes = Array.from(
      { length: 4 },
      () => `
      <div class="etiquette">
        <img src="${qr}" alt="QR d'inventaire" />
        <div class="libelle">${echapper(equipement.libelle)}</div>
        <div class="categorie">${echapper(equipement.categorie.libelle)}</div>
        <div class="ligne"><span class="pochoir">N° inventaire</span><strong>${echapper(equipement.numeroInventaire)}</strong></div>
        <div class="ligne"><span class="pochoir">N° série</span><span>${echapper(equipement.numeroSerie)}</span></div>
        <div class="ligne"><span class="pochoir">Acquis le</span><span>${echapper(dateAquis)}</span></div>
        <div class="ligne"><span class="pochoir">Valeur</span><span>${echapper(valeur)}</span></div>
      </div>`,
    ).join('');

    const etablissement = await chargerEtablissement(this.prisma);

    return pageA4({
      titre: `Étiquette ${equipement.numeroInventaire}`,
      lang: 'fr',
      etablissement,
      marge: '8mm',
      entete: null,
      styles: STYLE_ETIQUETTE_INVENTAIRE,
      corps: `<div class="entete">
    <span class="etab">Inventaire du patrimoine</span>
    <span class="consigne">${echapper(equipement.qrCode)} · ${echapper(equipement.numeroInventaire)}</span>
  </div>
  <div class="grille">${etiquettes}</div>`,
    });
  }

  // ============================================================ utilitaires

  private async trouverEquipement(id: string) {
    const equipement = await this.prisma.equipementPatrimoine.findUnique({
      where: { id },
      include: EQUIPEMENT_INCLUDE,
    });
    if (!equipement) throw new NotFoundException(t('patrimoine.equipement_introuvable'));
    return equipement;
  }

  /** Même lecture que `trouverEquipement`, mais sur le client d'une transaction. */
  private async equipementCourant(tx: Prisma.TransactionClient, id: string) {
    // Sérialiser toutes les mutations d'un même matériel avant de lire
    // ses réparations : une transaction seule ne protège pas ce contrôle.
    await tx.$queryRaw`SELECT "id" FROM "EquipementPatrimoine" WHERE "id" = ${id} FOR UPDATE`;
    const equipement = await tx.equipementPatrimoine.findUnique({
      where: { id },
      include: EQUIPEMENT_INCLUDE,
    });
    if (!equipement) throw new NotFoundException(t('patrimoine.equipement_introuvable'));
    return equipement;
  }

  private async categorieCourante(tx: Prisma.TransactionClient, id: string) {
    const categorie = await tx.categoriePatrimoine.findUnique({
      where: { id },
      include: CATEGORIE_INCLUDE,
    });
    if (!categorie) {
      throw new NotFoundException(t('common.crud.itemNotFound', { label: 'Catégorie' }));
    }
    return categorie;
  }

  /**
   * Instantanés d'audit. Aucun jeton QR, aucune observation libre, aucune
   * donnée biométrique : ce sont les champs d'inventaire et d'état qui
   * permettent de reconstituer l'histoire d'un équipement, pas son
   * étiquette ni les commentaires de l'agent.
   */
  private instantaneCategorie(categorie: any) {
    return {
      id: categorie.id,
      code: categorie.code,
      libelle: categorie.libelle,
      dureeAmortissement: categorie.dureeAmortissement ?? null,
    };
  }

  private instantaneEquipement(equipement: any) {
    return {
      id: equipement.id,
      numeroInventaire: equipement.numeroInventaire,
      numeroSerie: equipement.numeroSerie,
      libelle: equipement.libelle,
      categorieId: equipement.categorieId,
      departementId: equipement.departementId ?? null,
      salleId: equipement.salleId ?? null,
      dateAcquisition: equipement.dateAcquisition ?? null,
      valeurAcquisition: equipement.valeurAcquisition ?? null,
      actif: equipement.actif,
      enReparation: equipement.enReparation,
      obsolescenceMois: equipement.obsolescenceMois ?? null,
    };
  }

  /** Description, notes et nom libre du prestataire restent dans la fiche. */
  private instantaneReparation(reparation: any) {
    return {
      id: reparation.id,
      equipementId: reparation.equipementId,
      statut: reparation.statut,
      cout: reparation.cout,
      dateDeclaration: reparation.dateDeclaration ?? null,
      dateResolution: reparation.dateResolution ?? null,
      declareParId: reparation.declareParId ?? null,
      resoluParId: reparation.resoluParId ?? null,
      prestataireFourni: Boolean(reparation.prestataire),
    };
  }

}

// Référence pour le typage Prisma — le préfixe est utilisé pour la séquence
// d'inventaire (PAT-AAAA-NNNNN) si on l'active plus tard.
void PREFIX_INVENTAIRE;

/** Étiquette d'inventaire : planche commune + lignes propres au patrimoine. */
const STYLE_ETIQUETTE_INVENTAIRE = `${STYLE_ETIQUETTES}
  .etiquette img { width: 42mm; height: 42mm; }
  .categorie { font-size: 10px; color: ${PALETTE_IMPRESSION.encreDouce}; margin-top: 1mm; text-transform: uppercase; letter-spacing: .04em; }
  .ligne { display: flex; justify-content: space-between; font-size: 10px; margin-top: 1.5mm; gap: 4mm; text-align: left; }
  .ligne .pochoir { color: ${PALETTE_IMPRESSION.encreDouce}; text-transform: uppercase; letter-spacing: .03em; }
  .ligne strong { font-family: Consolas, monospace; }
`;
