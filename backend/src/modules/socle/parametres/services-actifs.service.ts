import { BadRequestException, Injectable } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, ValidateNested, ArrayMaxSize, ArrayUnique } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AuthUser } from '../../../common/decorators';
import { PrismaService } from '../../../prisma/prisma.service';
import { t } from '../../../common/i18n';
import { journaliser } from '../../../common/audit';
import { PREFIXE_SERVICE_ACTIF } from './parametres.service';

/** Les services obligatoires portent aussi les archives et le rapprochement. */
export const SERVICES = [
  {
    id: 'presence',
    obligatoire: true,
    pilote: false,
    prefixes: ['controles', 'seances', 'creneaux', 'attestation', 'justificatifs', 'rapports', 'impression', 'export'],
  },
  {
    id: 'scolarite',
    obligatoire: true,
    pilote: false,
    prefixes: [
      'etudiants',
      'inscriptions',
      'inscription-publique',
      'frais',
      'evaluations',
      'notes',
      'deliberations',
      'portail',
    ],
  },
  { id: 'finances', obligatoire: true, pilote: false, prefixes: ['paiements', 'feuilles-paie', 'recettes'] },
  { id: 'documentsEtudiants', obligatoire: true, pilote: false, prefixes: ['documents-demande', 'attestations'] },
  { id: 'reclamations', obligatoire: false, pilote: false, prefixes: ['reclamations'] },
  { id: 'reservations', obligatoire: false, pilote: false, prefixes: ['reservations'] },
  { id: 'bibliotheque', obligatoire: false, pilote: true, prefixes: ['documents'] },
  { id: 'logements', obligatoire: false, pilote: true, prefixes: ['residences', 'chambres', 'attributions-logement'] },
  { id: 'restauration', obligatoire: false, pilote: true, prefixes: ['resto', 'portail/resto'] },
  { id: 'stages', obligatoire: false, pilote: true, prefixes: ['travaux-encadres', 'soutenances'] },
  { id: 'helpdesk', obligatoire: false, pilote: true, prefixes: ['equipements', 'tickets'] },
  { id: 'formations', obligatoire: false, pilote: true, prefixes: ['formations'] },
  { id: 'patrimoine', obligatoire: false, pilote: true, prefixes: ['patrimoine'] },
  { id: 'courrier', obligatoire: false, pilote: true, prefixes: ['courrier'] },
  { id: 'examens', obligatoire: false, pilote: true, prefixes: ['examens', 'tirage'] },
  { id: 'elections', obligatoire: false, pilote: true, prefixes: ['elections'] },
  { id: 'cartes', obligatoire: false, pilote: true, prefixes: ['cartes-etudiantes'] },
  { id: 'badges', obligatoire: false, pilote: true, prefixes: ['badges'] },
  { id: 'vod', obligatoire: false, pilote: true, prefixes: ['vod'] },
  { id: 'notifications', obligatoire: false, pilote: true, prefixes: ['notifications'] },
  { id: 'rectorat', obligatoire: false, pilote: true, prefixes: ['rectorat'] },
] as const;
const IDS = SERVICES.map((s) => s.id);
const IDS_VALIDES = new Set<string>(IDS);
const PREFIXE = PREFIXE_SERVICE_ACTIF;

export class ServiceActifDto {
  @IsIn(IDS) id: string;
  @Transform(({ obj, key }) => obj[key], { toClassOnly: true })
  @IsBoolean()
  actif: boolean;
}
export class ServicesActifsDto {
  @IsArray()
  @ArrayMaxSize(SERVICES.length)
  @ArrayUnique((s: ServiceActifDto) => s.id)
  @ValidateNested({ each: true })
  @Type(() => ServiceActifDto)
  services: ServiceActifDto[];
}

/**
 * Durée de vie du cache des activations. La garde globale consulte
 * l'activation à chaque requête : sans cache, chaque appel d'API coûtait une
 * requête SQL de plus.
 *
 * Le cache vit en mémoire du processus. C'est suffisant tant que PM2 ne lance
 * qu'une instance : l'écriture (enregistrer) l'invalide immédiatement. Si l'API
 * passait un jour en mode cluster, les autres instances verraient le
 * changement au plus tard après ce délai ; il faudrait alors un cache partagé
 * (ou une notification) pour un effet immédiat partout.
 */
export const DUREE_CACHE_SERVICES_MS = 30_000;

@Injectable()
export class ServicesActifsService {
  private cache: { valeurs: Map<string, string>; expireA: number } | null = null;
  private chargement: Promise<Map<string, string>> | null = null;
  /** Incrémentée à chaque écriture : un chargement lancé avant est jeté. */
  private generation = 0;

  constructor(private readonly prisma: PrismaService) {}

  /** Valeurs brutes des clés SERVICE_ACTIF_*, servies depuis le cache si frais. */
  private async valeurs(): Promise<Map<string, string>> {
    if (this.cache && this.cache.expireA > Date.now()) return this.cache.valeurs;
    if (this.chargement) return this.chargement;
    const generation = this.generation;
    const chargement = this.prisma.parametre
      .findMany({ where: { cle: { startsWith: PREFIXE } }, select: { cle: true, valeur: true } })
      .then((rows) => {
        const valeurs = new Map(rows.map((r) => [r.cle, r.valeur]));
        if (generation === this.generation) {
          this.cache = { valeurs, expireA: Date.now() + DUREE_CACHE_SERVICES_MS };
        }
        return valeurs;
      })
      .finally(() => {
        if (this.chargement === chargement) this.chargement = null;
      });
    this.chargement = chargement;
    return chargement;
  }

  /** Oublie le cache : la prochaine lecture repart de la base. */
  invalider() {
    this.generation++;
    this.cache = null;
    this.chargement = null;
  }

  async liste() {
    const valeurs = await this.valeurs();
    // Les installations existantes gardent leurs accès jusqu'au choix ADMIN.
    return SERVICES.map(({ id, obligatoire, pilote }) => ({
      id,
      obligatoire,
      pilote,
      actif: obligatoire || valeurs.get(PREFIXE + id) !== 'false',
    }));
  }
  async actif(id: string) {
    const service = SERVICES.find((s) => s.id === id);
    if (!service || service.obligatoire) return true;
    return (await this.valeurs()).get(PREFIXE + id) !== 'false';
  }
  async enregistrer(dto: ServicesActifsDto, user: AuthUser) {
    if (
      dto.services.some((s) => !IDS_VALIDES.has(s.id) || typeof s.actif !== 'boolean') ||
      new Set(dto.services.map((s) => s.id)).size !== dto.services.length
    )
      throw new BadRequestException(t('common.invalidServices'));
    if (dto.services.some((s) => !s.actif && SERVICES.find((def) => def.id === s.id)?.obligatoire))
      throw new BadRequestException(t('common.requiredService'));
    try {
      await this.ecrire(dto, user);
    } finally {
      // Après le commit (ou l'échec) : aucune lecture ne garde l'état d'avant.
      this.invalider();
    }
    return this.liste();
  }

  private async ecrire(dto: ServicesActifsDto, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      for (const service of dto.services) {
        const cle = PREFIXE + service.id;
        const avant = await tx.parametre.findUnique({ where: { cle }, select: { valeur: true } });
        if ((avant?.valeur !== 'false') === service.actif) continue;
        await tx.parametre.upsert({
          where: { cle },
          create: { cle, valeur: String(service.actif) },
          update: { valeur: String(service.actif) },
        });
        await journaliser(tx, user, 'SERVICE_ACTIVATION_MODIFIEE', 'Parametre', cle, {
          service: service.id,
          avant: { actif: avant?.valeur !== 'false' },
          apres: { actif: service.actif },
        });
      }
    });
  }
}
