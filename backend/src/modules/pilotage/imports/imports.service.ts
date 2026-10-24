import { BadRequestException, Injectable } from '@nestjs/common';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { AuthUser } from '../../../common/decorators';
import { PrismaService } from '../../../prisma/prisma.service';
import { t } from '../../../common/i18n';
import { JOURS, toDateOnly } from '../../../common/utils';
import { codeErreur } from '../../../common/erreur';
import { CreneauxService } from '../../presence/planification/creneaux.service';
import { EnseignantsService } from '../../socle/referentiel/enseignants.service';
import { MatieresService } from '../../socle/referentiel/matieres.service';
import { SallesService } from '../../socle/referentiel/salles.service';
import { COLONNES, lireCsv } from './csv';
import {
  ImportCsvDto,
  LigneCreneauImport,
  LigneEnseignantImport,
  LigneMatiereImport,
  LigneSalleImport,
  TypeImportReferentiel,
} from './imports.dto';

/**
 * Ligne d'import validée : le schéma dépend du référentiel importé, mais le
 * service les manipule tous de la même façon.
 */
type LigneValidee = LigneEnseignantImport | LigneMatiereImport | LigneSalleImport | LigneCreneauImport;

/**
 * Colonnes lues pour la clé de doublon, tous référentiels confondus : une
 * colonne absente du référentiel importé reste `undefined`.
 */
type CleLigne = {
  matricule?: string;
  code?: string;
  affectationId?: string;
  jourSemaine?: number;
  heureDebut?: string;
  heureFin?: string;
  dateDebut?: string;
  dateFin?: string;
};

/** Description d'un import : schéma de validation et clé de doublon. */
interface ConfigImport {
  schema: ClassConstructor<LigneValidee>;
  requis: string[];
  cle: (r: CleLigne) => string | undefined;
}

const CONFIG: Record<TypeImportReferentiel, ConfigImport> = {
  [TypeImportReferentiel.ENSEIGNANTS]: {
    schema: LigneEnseignantImport,
    requis: ['matricule', 'nom', 'prenom'],
    cle: (r) => r.matricule?.toLocaleLowerCase('fr'),
  },
  [TypeImportReferentiel.MATIERES]: {
    schema: LigneMatiereImport,
    requis: ['code', 'intitule'],
    cle: (r) => r.code?.toLocaleLowerCase('fr'),
  },
  [TypeImportReferentiel.SALLES]: {
    schema: LigneSalleImport,
    requis: ['code', 'nom'],
    cle: (r) => r.code?.toLocaleLowerCase('fr'),
  },
  [TypeImportReferentiel.CRENEAUX]: {
    schema: LigneCreneauImport,
    requis: ['affectationId', 'jourSemaine', 'heureDebut', 'heureFin'],
    cle: (r) =>
      [r.affectationId, r.jourSemaine, r.heureDebut, r.heureFin, r.dateDebut ?? '', r.dateFin ?? '']
        .join('|')
        .toLocaleLowerCase('fr'),
  },
};

type LignePreparee = { numero: number; donnees: LigneValidee; erreurs: string[] };

/**
 * Message d'une exception HTTP : texte unique ou liste de textes de
 * validation. Renvoie `undefined` quand le corps ne porte pas de message.
 */
function messageHttp(exception: BadRequestException): string | string[] | undefined {
  const corps = exception.getResponse();
  if (typeof corps !== 'object' || corps === null) return undefined;
  const message = (corps as { message?: unknown }).message;
  if (typeof message === 'string' || Array.isArray(message)) return message as string | string[];
  return undefined;
}

function erreurCsv(message: string) {
  throw new BadRequestException(message);
}

function normaliserValeur(cle: string, valeur: string): unknown {
  if (valeur === '') return undefined;
  if (['tauxHoraire', 'volumeHoraireTotal', 'credits', 'capacite', 'jourSemaine'].includes(cle)) {
    if (cle === 'jourSemaine') {
      const jour = valeur
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase('fr')
        .replace(/\.$/, '');
      const index = JOURS.findIndex(
        (nom, numero) =>
          numero > 0 && [nom.toLocaleLowerCase('fr'), nom.slice(0, 3).toLocaleLowerCase('fr')].includes(jour),
      );
      if (index > 0) return String(index);
    }
    const nombre = valeur
      .trim()
      .replace(/(?:€|gnf|fcfa)\s*$/i, '')
      .trim();
    if (/^-?\d{1,3}(?:[ \u00a0\u202f\u2009]\d{3})+,\d+$/.test(nombre)) {
      return nombre.replace(/[\s\u00a0\u202f\u2009]/g, '').replace(',', '.');
    }
    if (/^-?\d{1,3}(?:\s+\d{3})+\.\d+$/.test(nombre)) return nombre.replace(/\s/g, '');
    if (/^-?\d{1,3}(?:\.\d{3})+,\d+$/.test(nombre)) {
      return nombre.replace(/\./g, '').replace(',', '.');
    }
    return nombre.replace(',', '.');
  }
  if (['heureDebut', 'heureFin'].includes(cle)) {
    const heure = valeur.trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})$/);
    if (heure) return `${heure[1].padStart(2, '0')}:${heure[2]}`;
  }
  if (cle === 'type') {
    const type = valeur
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('fr');
    const types: Record<string, string> = {
      'cours magistral': 'CM',
      cm: 'CM',
      'travaux diriges': 'TD',
      td: 'TD',
      'travaux pratiques': 'TP',
      tp: 'TP',
      examen: 'EXAMEN',
      'examen final': 'EXAMEN',
      conference: 'CONFERENCE',
    };
    if (types[type]) return types[type];
  }
  if (['statut', 'type'].includes(cle)) return valeur.trim().toLocaleUpperCase('fr');
  if (['dateDebut', 'dateFin'].includes(cle)) {
    const dateLocale = valeur.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if (dateLocale) {
      const annee =
        dateLocale[3].length === 2 ? `${Number(dateLocale[3]) < 70 ? '20' : '19'}${dateLocale[3]}` : dateLocale[3];
      return `${annee}-${dateLocale[2].padStart(2, '0')}-${dateLocale[1].padStart(2, '0')}`;
    }
    if (/^\d+(?:\.\d+)?$/.test(valeur)) {
      const numero = Number(valeur);
      if (numero >= 1 && numero <= 2_958_465) {
        const date = new Date(Date.UTC(1899, 11, 30) + numero * 86_400_000);
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      }
    }
    return valeur.trim();
  }
  return valeur;
}

function messagesValidation(instance: object): string[] {
  return validateSync(instance, { whitelist: true }).map((e) =>
    t('imports.valeurInvalide', { champ: COLONNES[e.property]?.[0] ?? e.property }),
  );
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enseignants: EnseignantsService,
    private readonly matieres: MatieresService,
    private readonly salles: SallesService,
    private readonly creneaux: CreneauxService,
  ) {}

  private async dejaPresent(type: TypeImportReferentiel, ligne: LignePreparee): Promise<boolean> {
    if (type === TypeImportReferentiel.ENSEIGNANTS) {
      const r = ligne.donnees as LigneEnseignantImport;
      return Boolean(
        await this.prisma.enseignant.findFirst({
          where: { matricule: { equals: r.matricule, mode: 'insensitive' } },
          select: { id: true },
        }),
      );
    }
    if (type === TypeImportReferentiel.MATIERES) {
      const r = ligne.donnees as LigneMatiereImport;
      return Boolean(
        await this.prisma.matiere.findFirst({
          where: { code: { equals: r.code, mode: 'insensitive' } },
          select: { id: true },
        }),
      );
    }
    if (type === TypeImportReferentiel.SALLES) {
      const r = ligne.donnees as LigneSalleImport;
      return Boolean(
        await this.prisma.salle.findFirst({
          where: { code: { equals: r.code, mode: 'insensitive' } },
          select: { id: true },
        }),
      );
    }
    const r = ligne.donnees as LigneCreneauImport;
    return Boolean(
      await this.prisma.creneau.findFirst({
        where: {
          affectationId: r.affectationId,
          jourSemaine: r.jourSemaine,
          heureDebut: r.heureDebut,
          heureFin: r.heureFin,
          dateDebut: r.dateDebut ? toDateOnly(r.dateDebut) : null,
          dateFin: r.dateFin ? toDateOnly(r.dateFin) : null,
        },
        select: { id: true },
      }),
    );
  }

  private async verifierReferences(type: TypeImportReferentiel, ligne: LignePreparee): Promise<string[]> {
    const erreurs: string[] = [];
    if (type === TypeImportReferentiel.ENSEIGNANTS || type === TypeImportReferentiel.MATIERES) {
      const r = ligne.donnees as LigneEnseignantImport | LigneMatiereImport;
      if (r.departementId) {
        const departement = await this.prisma.departement.findUnique({
          where: { id: r.departementId },
          select: { id: true },
        });
        if (!departement) erreurs.push(t('imports.departementIntrouvable'));
      }
    }
    if (type === TypeImportReferentiel.CRENEAUX) {
      const r = ligne.donnees as LigneCreneauImport;
      const [affectation, salle] = await Promise.all([
        this.prisma.affectation.findUnique({ where: { id: r.affectationId }, select: { id: true } }),
        r.salleId ? this.prisma.salle.findUnique({ where: { id: r.salleId }, select: { id: true } }) : null,
      ]);
      if (!affectation) erreurs.push(t('imports.affectationIntrouvable'));
      if (r.salleId && !salle) erreurs.push(t('imports.salleIntrouvable'));
      if (affectation && (!r.salleId || salle)) {
        try {
          await this.creneaux.verifierImport(r);
        } catch (cause) {
          const message = cause instanceof BadRequestException ? messageHttp(cause) : undefined;
          erreurs.push(
            ...(Array.isArray(message)
              ? message
              : [typeof message === 'string' ? message : t('imports.creneauHorsRegles')]),
          );
        }
      }
    }
    return erreurs;
  }

  private async preparer(dto: ImportCsvDto) {
    const csv = lireCsv(dto.contenu);
    if (csv.erreurs.length) erreurCsv(csv.erreurs.join(' '));
    if (csv.lignes.length > 2000) erreurCsv(t('imports.tropDeLignes'));
    if (!csv.lignes.length) erreurCsv(t('imports.aucuneLigne'));

    const config = CONFIG[dto.type];
    const header = new Set(csv.entetes.filter((cle): cle is string => Boolean(cle)));
    const manquantes = config.requis.filter((champ) => !header.has(champ));
    if (manquantes.length) {
      const noms = manquantes.map((cle) => COLONNES[cle]?.[0] ?? cle);
      erreurCsv(t('imports.colonnesObligatoiresAbsentes', { colonnes: noms.join(', ') }));
    }
    const vues = new Set<string>();
    const lignes: LignePreparee[] = csv.lignes.map((ligne) => {
      const brut = Object.fromEntries(
        Object.entries(ligne.donnees)
          .map(([cle, valeur]) => [cle, normaliserValeur(cle, valeur)])
          .filter(([, valeur]) => valeur !== undefined),
      );
      const instance = plainToInstance(config.schema, brut, { enableImplicitConversion: false });
      const erreurs = messagesValidation(instance);
      const cle = config.cle(instance);
      if (cle) {
        if (vues.has(cle)) erreurs.push(t('imports.doublonDansLeFichier'));
        vues.add(cle);
      }
      return { numero: ligne.numero, donnees: instance, erreurs };
    });

    // Le fichier est borné à 2 000 lignes ; limiter la concurrence garde la
    // prévisualisation sous le délai HTTP sans ouvrir 2 000 requêtes Prisma d'un coup.
    let prochaine = 0;
    const verifierLot = async () => {
      while (prochaine < lignes.length) {
        const preparee = lignes[prochaine++];
        if (preparee.erreurs.length) continue;
        preparee.erreurs.push(...(await this.verifierReferences(dto.type, preparee)));
        if (!preparee.erreurs.length && (await this.dejaPresent(dto.type, preparee))) {
          preparee.erreurs.push(t('imports.enregistrementExistant'));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(8, lignes.length) }, verifierLot));

    return { lignes, colonnesIgnorees: csv.colonnesIgnorees };
  }

  async previsualiser(dto: ImportCsvDto) {
    const { lignes, colonnesIgnorees } = await this.preparer(dto);
    const valides = lignes.filter((l) => l.erreurs.length === 0).length;
    return {
      type: dto.type,
      colonnesIgnorees,
      lignesLues: lignes.length,
      valides,
      rejetees: lignes.length - valides,
      apercu: lignes.slice(0, 10).map(({ numero, donnees, erreurs }) => ({ numero, donnees, erreurs })),
      erreurs: lignes.filter((l) => l.erreurs.length).map(({ numero, erreurs }) => ({ numero, erreurs })),
    };
  }

  private async creer(type: TypeImportReferentiel, donnees: LigneValidee, user: AuthUser) {
    if (type === TypeImportReferentiel.ENSEIGNANTS) {
      return this.enseignants.creerPour(donnees as LigneEnseignantImport, user);
    }
    if (type === TypeImportReferentiel.MATIERES) return this.matieres.creer(donnees as LigneMatiereImport, user);
    if (type === TypeImportReferentiel.SALLES) return this.salles.creer(donnees as LigneSalleImport, user);
    return this.creneaux.creer(donnees as LigneCreneauImport, user);
  }

  async importer(dto: ImportCsvDto, user: AuthUser) {
    const { lignes, colonnesIgnorees } = await this.preparer(dto);
    let importees = 0;
    const erreurs: Array<{ numero: number; erreurs: string[] }> = lignes
      .filter((l) => l.erreurs.length)
      .map(({ numero, erreurs }) => ({ numero, erreurs }));

    for (const ligne of lignes.filter((l) => l.erreurs.length === 0)) {
      try {
        await this.creer(dto.type, ligne.donnees, user);
        importees += 1;
      } catch (cause) {
        const message =
          codeErreur(cause) === 'P2002'
            ? 'Un enregistrement portant cette clé a été créé entre-temps.'
            : cause instanceof BadRequestException
              ? (messageHttp(cause) ?? 'Ligne refusée par les règles métier.')
              : 'La ligne n’a pas pu être créée ; vérifiez ses références et les règles métier.';
        erreurs.push({ numero: ligne.numero, erreurs: Array.isArray(message) ? message : [message] });
      }
    }
    return {
      type: dto.type,
      lignesLues: lignes.length,
      importees,
      rejetees: erreurs.length,
      erreurs,
      colonnesIgnorees,
    };
  }
}
