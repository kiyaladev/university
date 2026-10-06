import { BadRequestException, Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Module, NotFoundException, Put } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { IsArray, IsBoolean, IsIn, ValidateNested, ArrayMaxSize, ArrayUnique } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { t } from '../../common/i18n';

/** Les services obligatoires portent aussi les archives et le rapprochement. */
export const SERVICES = [
  { id: 'presence', obligatoire: true, pilote: false, prefixes: ['controles', 'seances', 'creneaux', 'attestation', 'justificatifs', 'rapports', 'impression', 'export'] },
  { id: 'scolarite', obligatoire: true, pilote: false, prefixes: ['etudiants', 'inscriptions', 'inscription-publique', 'frais', 'evaluations', 'notes', 'deliberations', 'portail'] },
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
const IDS = SERVICES.map(s => s.id);
const IDS_VALIDES = new Set<string>(IDS);
const PREFIXE = 'SERVICE_ACTIF_';

export class ServiceActifDto {
  @IsIn(IDS) id: string;
  @Transform(({ obj, key }) => obj[key], { toClassOnly: true })
  @IsBoolean() actif: boolean;
}
export class ServicesActifsDto {
  @IsArray() @ArrayMaxSize(SERVICES.length) @ArrayUnique((s: ServiceActifDto) => s.id)
  @ValidateNested({ each: true }) @Type(() => ServiceActifDto)
  services: ServiceActifDto[];
}

@Injectable()
export class ServicesActifsService {
  constructor(private readonly prisma: PrismaService) {}
  async liste() {
    const rows = await this.prisma.parametre.findMany({ where: { cle: { startsWith: PREFIXE } }, select: { cle: true, valeur: true } });
    const valeurs = new Map(rows.map(r => [r.cle, r.valeur]));
    // Les installations existantes gardent leurs accès jusqu'au choix ADMIN.
    return SERVICES.map(({ id, obligatoire, pilote }) => ({ id, obligatoire, pilote, actif: obligatoire || valeurs.get(PREFIXE + id) !== 'false' }));
  }
  async actif(id: string) {
    const service = SERVICES.find(s => s.id === id);
    if (!service || service.obligatoire) return true;
    const row = await this.prisma.parametre.findUnique({ where: { cle: PREFIXE + id }, select: { valeur: true } });
    return row?.valeur !== 'false';
  }
  async enregistrer(dto: ServicesActifsDto, user: AuthUser) {
    if (dto.services.some(s => !IDS_VALIDES.has(s.id) || typeof s.actif !== 'boolean') || new Set(dto.services.map(s => s.id)).size !== dto.services.length) throw new BadRequestException(t('common.invalidServices'));
    if (dto.services.some(s => !s.actif && SERVICES.find(def => def.id === s.id)?.obligatoire)) throw new BadRequestException(t('common.requiredService'));
    await this.prisma.$transaction(async tx => {
      for (const service of dto.services) {
        const cle = PREFIXE + service.id;
        const avant = await tx.parametre.findUnique({ where: { cle }, select: { valeur: true } });
        if ((avant?.valeur !== 'false') === service.actif) continue;
        await tx.parametre.upsert({ where: { cle }, create: { cle, valeur: String(service.actif) }, update: { valeur: String(service.actif) } });
        await tx.auditLog.create({ data: { userId: user.id, action: 'SERVICE_ACTIVATION_MODIFIEE', entite: 'Parametre', entiteId: cle, details: JSON.stringify({ service: service.id, avant: { actif: avant?.valeur !== 'false' }, apres: { actif: service.actif } }) } });
      }
    });
    return this.liste();
  }
}

@Injectable()
export class ServicesActifsGuard implements CanActivate {
  constructor(private readonly service: ServicesActifsService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    const controller = this.reflector.get<string>(PATH_METADATA, context.getClass()) || '';
    const handler = this.reflector.get<string>(PATH_METADATA, context.getHandler()) || '';
    const path = `${controller}/${handler}`.replace(/^\/+/, '');
    // Longest prefix first: portail/resto must precede the required portail.
    const match = SERVICES.flatMap(s => s.prefixes.map(prefix => ({ id: s.id, prefix })))
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find(s => path === s.prefix || path.startsWith(s.prefix + '/'));
    if (match && !await this.service.actif(match.id)) throw new NotFoundException(t('common.serviceUnavailable'));
    return true;
  }
}

@Controller('services-actifs')
export class ServicesActifsController {
  constructor(private readonly service: ServicesActifsService) {}
  @Public() @Get() liste() { return this.service.liste(); }
  @Roles(Role.ADMIN) @Put() enregistrer(@Body() dto: ServicesActifsDto, @CurrentUser() user: AuthUser) { return this.service.enregistrer(dto, user); }
}

@Module({ controllers: [ServicesActifsController], providers: [ServicesActifsService, ServicesActifsGuard], exports: [ServicesActifsGuard] })
export class ServicesActifsModule {}
