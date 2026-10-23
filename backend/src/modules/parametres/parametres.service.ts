import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { t } from '../../common/i18n';
import { journaliser } from '../../common/audit';
import { UpdateParametresDto } from './parametres.dto';

/**
 * Préfixe des clés `Parametre` qui activent ou masquent un service
 * (SERVICE_ACTIF_vod…). Elles ne s'écrivent que par ServicesActifsService :
 * l'écran des paramètres génériques ne les montre ni ne les modifie.
 */
export const PREFIXE_SERVICE_ACTIF = 'SERVICE_ACTIF_';

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
      "Exiger que l'enseignant atteste sa présence (signature, code personnel ou lecteur d’empreintes)",
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
    })).filter(p => !p.cle.startsWith(PREFIXE_SERVICE_ACTIF));
  }

  /** Paramètre unique nécessaire au dialogue de pointage ; ne divulgue pas les seuils internes. */
  async reglesPointage() {
    return [{ cle: 'ATTESTATION_OBLIGATOIRE', valeur: await this.valeur('ATTESTATION_OBLIGATOIRE') }];
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

  private instantaneAudit(cle: string, valeur: string | null) {
    // Valeurs des paramètres connus utiles à expliquer les décisions métier ;
    // les clés ajoutées hors catalogue ne révèlent que leur état de présence.
    if (Object.prototype.hasOwnProperty.call(PARAMETRES_DEFAUT, cle)) {
      return { valeur };
    }
    return { configure: valeur !== null };
  }

  async enregistrer(dto: UpdateParametresDto, user?: AuthUser) {
    if (dto.parametres.some(p => p.cle.startsWith(PREFIXE_SERVICE_ACTIF))) {
      throw new BadRequestException(t('common.servicesConfigurationEndpoint'));
    }
    await this.prisma.$transaction(async (tx) => {
      for (const p of dto.parametres) {
        const avant = await tx.parametre.findUnique({ where: { cle: p.cle } });
        const apres = await tx.parametre.upsert({
          where: { cle: p.cle },
          create: {
            cle: p.cle,
            valeur: p.valeur,
            description: p.description ?? PARAMETRES_DEFAUT[p.cle]?.description,
          },
          update: { valeur: p.valeur },
        });
        await journaliser(
          tx,
          user ?? null,
          'PARAMETRE_MODIFIE',
          'Parametre',
          p.cle,
          {
            cle: p.cle,
            avant: this.instantaneAudit(p.cle, avant?.valeur ?? PARAMETRES_DEFAUT[p.cle]?.valeur ?? null),
            apres: this.instantaneAudit(p.cle, apres.valeur),
            descriptionModifiee: !avant && Boolean(p.description ?? PARAMETRES_DEFAUT[p.cle]?.description),
          },
        );
      }
    });
    return this.liste();
  }
}
