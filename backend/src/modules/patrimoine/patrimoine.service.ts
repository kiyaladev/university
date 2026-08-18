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
import {
  CreateCategorieDto,
  CreateEquipementDto,
  DeclarationReparationDto,
  EquipementQueryDto,
  ResolutionReparationDto,
  UpdateCategorieDto,
  UpdateEquipementDto,
} from './patrimoine.dto';

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

  async creerCategorie(dto: CreateCategorieDto, user: AuthUser) {
    const cat = await this.categoriesService.create({
      code: dto.code.trim(),
      libelle: dto.libelle.trim(),
      ...(dto.dureeAmortissement ? { dureeAmortissement: dto.dureeAmortissement } : {}),
    });
    await this.audit(user, 'PATRIMOINE_CATEGORIE_CREEE', cat.id, dto.libelle);
    return cat;
  }

  async modifierCategorie(id: string, dto: UpdateCategorieDto, user: AuthUser) {
    const cat = await this.categoriesService.update(id, {
      ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
      ...(dto.libelle !== undefined ? { libelle: dto.libelle.trim() } : {}),
      ...(dto.dureeAmortissement !== undefined
        ? { dureeAmortissement: dto.dureeAmortissement }
        : {}),
    });
    await this.audit(user, 'PATRIMOINE_CATEGORIE_MODIFIEE', id, cat.libelle);
    return cat;
  }

  /**
   * Suppression d'une catégorie : refusée si elle a encore des équipements.
   * C'est la règle inscrite dans le cahier des charges — un équipement
   * orphelin de catégorie perdrait son libellé.
   */
  async supprimerCategorie(id: string, user: AuthUser) {
    const cat = await this.categoriesService.findOne(id);
    if (cat._count && (cat._count as any).equipements > 0) {
      throw new ConflictException(
        `Catégorie « ${cat.libelle} » : ${(cat._count as any).equipements} équipement(s) y sont rattachés. Réaffectez-les avant de supprimer.`,
      );
    }
    await this.categoriesService.remove(id);
    await this.audit(user, 'PATRIMOINE_CATEGORIE_SUPPRIMEE', id, cat.libelle);
    return { id };
  }

  // ============================================================ Équipements

  /**
   * Liste paginée, filtrable par texte, catégorie, département, état actif,
   * état en réparation. La fulltext « search » balaie libellé, numéro de
   * série, numéro d'inventaire et qrCode.
   */
  async listeEquipements(query: EquipementQueryDto) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';

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
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.prisma.equipementPatrimoine.count({ where }),
    ]);
    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
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
        const equipement = await this.prisma.equipementPatrimoine.create({
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
        await this.audit(
          user,
          'PATRIMOINE_EQUIPEMENT_CREE',
          equipement.id,
          `${equipement.numeroInventaire} — ${equipement.libelle}`,
        );
        return equipement;
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
    throw new ConflictException(
      'Impossible de générer un identifiant QR unique, réessayez',
    );
  }

  async modifierEquipement(id: string, dto: UpdateEquipementDto, user: AuthUser) {
    const equipement = await this.trouverEquipement(id);
    const maj = await this.prisma.equipementPatrimoine.update({
      where: { id },
      data: {
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
      },
      include: EQUIPEMENT_INCLUDE,
    });
    void equipement;
    await this.audit(
      user,
      'PATRIMOINE_EQUIPEMENT_MODIFIE',
      id,
      `${maj.numeroInventaire} — ${maj.libelle}`,
    );
    return maj;
  }

  /**
   * Suppression d'un équipement : refusée si une réparation a été consignée,
   * car la trace comptable est ce qui justifie l'inventaire. L'admin peut
   * désactiver (actif=false) à la place.
   */
  async supprimerEquipement(id: string, user: AuthUser) {
    const equipement = await this.trouverEquipement(id);
    const reparations = await this.prisma.reparationMateriel.count({ where: { equipementId: id } });
    if (reparations > 0) {
      throw new ConflictException(
        `${equipement.numeroInventaire} : ${reparations} réparation(s) consignée(s). Désactivez l'équipement plutôt que de le supprimer.`,
      );
    }
    await this.prisma.equipementPatrimoine.delete({ where: { id } });
    await this.audit(
      user,
      'PATRIMOINE_EQUIPEMENT_SUPPRIME',
      id,
      `${equipement.numeroInventaire} — ${equipement.libelle}`,
    );
    return { id };
  }

  /**
   * Régénération du QR d'équipement : utile si l'étiquette est devenue
   * illisible ou compromise. Le nouveau token est aléatoire et remplace
   * l'ancien.
   */
  async regenererQr(id: string, user: AuthUser) {
    const equipement = await this.trouverEquipement(id);
    for (let tentative = 0; tentative < 10; tentative++) {
      const qrCode = `${QR_PREFIX}${randomBytes(12).toString('base64url')}`;
      try {
        const maj = await this.prisma.equipementPatrimoine.update({
          where: { id },
          data: { qrCode },
          include: EQUIPEMENT_INCLUDE,
        });
        await this.audit(
          user,
          'PATRIMOINE_QR_REGENERE',
          id,
          `${equipement.numeroInventaire} — ${qrCode}`,
        );
        return maj;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException('Impossible de générer un QR unique, réessayez');
  }

  /**
   * Résolution publique par QR : le QR imprimé appelle cette route. Comme
   * pour le helpdesk, le token est public — un QR forgé ne résout rien.
   */
  async parQr(qrCode: string) {
    const equipement = await this.prisma.equipementPatrimoine.findUnique({
      where: { qrCode },
      include: {
        categorie: { select: { id: true, code: true, libelle: true } },
        departement: { select: { id: true, code: true, nom: true } },
        salle: { select: { id: true, code: true, nom: true } },
      },
    });
    if (!equipement) {
      throw new NotFoundException('Équipement introuvable pour ce QR');
    }
    return equipement;
  }

  // ============================================================ Réparations

  /**
   * Déclaration d'une réparation : la première intervention crée la fiche
   * et bascule l'équipement en « en réparation ». Si une fiche est déjà
   * ouverte (DECLARE ou EN_COURS), on refuse pour éviter le double
   * comptage.
   */
  async declarerReparation(
    equipementId: string,
    dto: DeclarationReparationDto,
    user: AuthUser,
  ) {
    const equipement = await this.trouverEquipement(equipementId);
    const ouverte = await this.prisma.reparationMateriel.findFirst({
      where: {
        equipementId,
        statut: { in: [StatutReparation.DECLARE, StatutReparation.EN_COURS] },
      },
    });
    if (ouverte) {
      throw new ConflictException(
        `${equipement.numeroInventaire} a déjà une réparation en cours (${ouverte.statut}).`,
      );
    }
    const reparation = await this.prisma.reparationMateriel.create({
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
    await this.prisma.equipementPatrimoine.update({
      where: { id: equipementId },
      data: { enReparation: true },
    });
    await this.audit(
      user,
      'PATRIMOINE_REPARATION_DECLAREE',
      reparation.id,
      `${equipement.numeroInventaire} — ${dto.description.slice(0, 120)}`,
    );
    return reparation;
  }

  /**
   * Résolution : la dernière fiche ouverte passe TERMINE, sa note est
   * consignée, l'équipement reprend son état normal.
   */
  async resoudreReparation(
    equipementId: string,
    dto: ResolutionReparationDto,
    user: AuthUser,
  ) {
    const equipement = await this.trouverEquipement(equipementId);
    const ouverte = await this.prisma.reparationMateriel.findFirst({
      where: {
        equipementId,
        statut: { in: [StatutReparation.DECLARE, StatutReparation.EN_COURS] },
      },
      orderBy: { dateDeclaration: 'desc' },
    });
    if (!ouverte) {
      throw new BadRequestException(
        `${equipement.numeroInventaire} n'a pas de réparation en cours.`,
      );
    }
    const reparation = await this.prisma.reparationMateriel.update({
      where: { id: ouverte.id },
      data: {
        statut: StatutReparation.TERMINE,
        dateResolution: ouverte.dateResolution ?? new Date(),
        resoluParId: user.id,
        notes: dto.noteResolution?.trim() ?? ouverte.notes ?? null,
      },
      include: REPARATION_INCLUDE,
    });
    await this.prisma.equipementPatrimoine.update({
      where: { id: equipementId },
      data: { enReparation: false },
    });
    await this.audit(
      user,
      'PATRIMOINE_REPARATION_RESOLUE',
      ouverte.id,
      `${equipement.numeroInventaire}`,
    );
    return reparation;
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
    const equipements = await this.prisma.equipementPatrimoine.findMany({
      where: { actif: true },
      include: {
        categorie: { select: { id: true, code: true, libelle: true } },
        departement: { select: { id: true, code: true, nom: true } },
      },
    });

    const maintenant = new Date();
    const filtres = anneeId
      ? equipements.filter((e) => {
          if (!e.dateAcquisition) return true;
          return e.dateAcquisition.getUTCFullYear() === maintenant.getUTCFullYear() || true;
        })
      : equipements;

    const total = equipements.length;
    const valeur = equipements.reduce((acc, e) => acc + (e.valeurAcquisition ?? 0), 0);

    const parCategorieMap = new Map<string, { code: string; libelle: string; nombre: number; valeur: number }>();
    const parDepartementMap = new Map<string, { code: string; nom: string; nombre: number; valeur: number }>();
    let enReparation = 0;
    let obsoletes = 0;

    for (const e of equipements) {
      const cKey = e.categorie.id;
      const cEntry = parCategorieMap.get(cKey) ?? {
        code: e.categorie.code,
        libelle: e.categorie.libelle,
        nombre: 0,
        valeur: 0,
      };
      cEntry.nombre += 1;
      cEntry.valeur += e.valeurAcquisition ?? 0;
      parCategorieMap.set(cKey, cEntry);

      if (e.departementId && e.departement) {
        const dKey = e.departementId;
        const dEntry = parDepartementMap.get(dKey) ?? {
          code: e.departement.code,
          nom: e.departement.nom,
          nombre: 0,
          valeur: 0,
        };
        dEntry.nombre += 1;
        dEntry.valeur += e.valeurAcquisition ?? 0;
        parDepartementMap.set(dKey, dEntry);
      }

      if (e.enReparation) enReparation += 1;
      if (estObsolete(e.dateAcquisition, e.obsolescenceMois ?? 60, maintenant)) {
        obsoletes += 1;
      }
    }

    void filtres;
    return {
      total,
      valeur: Math.round(valeur),
      enReparation,
      obsoletes,
      parCategorie: [...parCategorieMap.values()].sort((a, b) => b.nombre - a.nombre),
      parDepartement: [...parDepartementMap.values()].sort((a, b) => b.nombre - a.nombre),
    };
  }

  // ============================================================ Étiquette A4

  /**
   * Étiquette A4 d'un équipement : ouverte dans un nouvel onglet, le jeton
   * est vérifié à la main (le navigateur n'envoie pas l'Authorization sur
   * window.open).
   */
  async imprimerEtiquette(id: string, token: string | undefined, baseUrl: string): Promise<string> {
    try {
      this.jwt.verify(token ?? '', {
        secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      });
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
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

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Étiquette ${echapper(equipement.numeroInventaire)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #10251E; margin: 0; }
  .entete { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px solid #10251E; padding-bottom: 4px; margin-bottom: 6mm; }
  .etab { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #10251E; }
  .consigne { font-size: 10px; color: #33463F; }
  .grille { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }
  .etiquette { border: 1.5px dashed #33463F; padding: 5mm 4mm; text-align: center; page-break-inside: avoid; }
  .etiquette img { width: 42mm; height: 42mm; }
  .libelle { font-weight: 700; text-transform: uppercase; letter-spacing: .03em; font-size: 12.5px; margin-top: 2mm; }
  .categorie { font-size: 10px; color: #33463F; margin-top: 1mm; text-transform: uppercase; letter-spacing: .04em; }
  .ligne { display: flex; justify-content: space-between; font-size: 10px; margin-top: 1.5mm; gap: 4mm; text-align: left; }
  .ligne .pochoir { color: #33463F; text-transform: uppercase; letter-spacing: .03em; }
  .ligne strong { font-family: Consolas, monospace; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <div class="entete">
    <span class="etab">Inventaire du patrimoine</span>
    <span class="consigne">${echapper(equipement.qrCode)} · ${echapper(equipement.numeroInventaire)}</span>
  </div>
  <div class="grille">${etiquettes}</div>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }

  // ============================================================ utilitaires

  private async trouverEquipement(id: string) {
    const equipement = await this.prisma.equipementPatrimoine.findUnique({
      where: { id },
      include: EQUIPEMENT_INCLUDE,
    });
    if (!equipement) throw new NotFoundException('Équipement introuvable');
    return equipement;
  }

  private async audit(user: AuthUser, action: string, entiteId: string, details?: string) {
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action,
        entite: 'Patrimoine',
        entiteId,
        details,
      },
    });
  }
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

function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Référence pour le typage Prisma — le préfixe est utilisé pour la séquence
// d'inventaire (PAT-AAAA-NNNNN) si on l'active plus tard.
void PREFIX_INVENTAIRE;
