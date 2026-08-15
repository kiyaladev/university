import { Body, Controller, Get, Injectable, Module, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators';

/** Règles de contrôle paramétrables par l'établissement. */
export const PARAMETRES_DEFAUT: Record<string, { valeur: string; description: string }> = {
  NOM_ETABLISSEMENT: {
    valeur: 'Université de Conakry',
    description: "Nom de l'établissement (en-tête des états imprimés)",
  },
  TOLERANCE_RETARD_MIN: {
    valeur: '15',
    description: 'Minutes de tolérance avant de considérer un enseignant en retard',
  },
  ABSENCE_APRES_MIN: {
    valeur: '30',
    description: "Minutes après l'heure de début au-delà desquelles l'enseignant est absent",
  },
  DUREE_MIN_VALIDE: {
    valeur: '30',
    description: 'Durée effective minimale (minutes) pour qu’une séance compte comme tenue',
  },
  QR_OBLIGATOIRE: {
    valeur: 'false',
    description: 'Exiger le scan du QR de la salle pour valider un pointage',
  },
  GEOLOC_OBLIGATOIRE: {
    valeur: 'false',
    description: 'Exiger une position GPS dans le rayon de la salle',
  },
  ATTESTATION_OBLIGATOIRE: {
    valeur: 'true',
    description:
      "Exiger que l'enseignant atteste sa présence (signature, code personnel, empreinte ou téléphone)",
  },
  SIGNATURE_OBLIGATOIRE: {
    valeur: 'false',
    description:
      "Exiger spécifiquement la signature manuscrite, même si un autre moyen a été utilisé",
  },
  EMPREINTE_SCORE_MIN: {
    valeur: '60',
    description: 'Score minimal de correspondance accepté par le lecteur d’empreintes (0-100)',
  },
  EFFECTIF_OBLIGATOIRE: {
    valeur: 'true',
    description: "Exiger le comptage des étudiants présents",
  },
};

export class ParametreItemDto {
  @IsString() cle: string;
  @IsString() valeur: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateParametresDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ParametreItemDto)
  parametres: ParametreItemDto[];
}

@Injectable()
export class ParametresService {
  constructor(private prisma: PrismaService) {}

  /** Tous les paramètres, complétés par les valeurs par défaut manquantes. */
  async tous(): Promise<Record<string, string>> {
    const rows = await this.prisma.parametre.findMany();
    const map: Record<string, string> = {};
    for (const [cle, def] of Object.entries(PARAMETRES_DEFAUT)) map[cle] = def.valeur;
    for (const r of rows) map[r.cle] = r.valeur;
    return map;
  }

  async liste() {
    const valeurs = await this.tous();
    return Object.entries(valeurs).map(([cle, valeur]) => ({
      cle,
      valeur,
      description: PARAMETRES_DEFAUT[cle]?.description ?? null,
    }));
  }

  async valeur(cle: string, defaut = ''): Promise<string> {
    const row = await this.prisma.parametre.findUnique({ where: { cle } });
    return row?.valeur ?? PARAMETRES_DEFAUT[cle]?.valeur ?? defaut;
  }

  async nombre(cle: string, defaut = 0): Promise<number> {
    const v = Number(await this.valeur(cle, String(defaut)));
    return Number.isFinite(v) ? v : defaut;
  }

  async booleen(cle: string, defaut = false): Promise<boolean> {
    return (await this.valeur(cle, String(defaut))).toLowerCase() === 'true';
  }

  async enregistrer(dto: UpdateParametresDto) {
    await this.prisma.$transaction(
      dto.parametres.map((p) =>
        this.prisma.parametre.upsert({
          where: { cle: p.cle },
          create: {
            cle: p.cle,
            valeur: p.valeur,
            description: p.description ?? PARAMETRES_DEFAUT[p.cle]?.description,
          },
          update: { valeur: p.valeur },
        }),
      ),
    );
    return this.liste();
  }
}

@ApiTags('Paramètres')
@ApiBearerAuth()
@Controller('parametres')
export class ParametresController {
  constructor(private readonly service: ParametresService) {}

  @Get() liste() {
    return this.service.liste();
  }

  @Roles(Role.ADMIN)
  @Put() enregistrer(@Body() dto: UpdateParametresDto) {
    return this.service.enregistrer(dto);
  }
}

@Module({
  controllers: [ParametresController],
  providers: [ParametresService],
  exports: [ParametresService],
})
export class ParametresModule {}
