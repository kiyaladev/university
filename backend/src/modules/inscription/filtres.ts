/**
 * Construction des `where` Prisma des registres étudiants et inscriptions.
 * Fonctions pures : testées sans base, partagées par la liste paginée et
 * l'export complet (même requête, `pageSize` plus grand).
 */
import { Prisma } from '@prisma/client';
import { EtudiantQueryDto, InscriptionQueryDto } from './inscription.dto';

const UN_JOUR_MS = 86_400_000;

/**
 * Intervalle de dates inclusif : `dateFin` couvre toute la journée saisie
 * (« jusqu'au 31 » inclut le 31 à 23:59:59.999), comme l'ancien filtrage client.
 */
export function intervalleDates(
  dateDebut?: string,
  dateFin?: string,
): Prisma.DateTimeFilter | undefined {
  if (!dateDebut && !dateFin) return undefined;
  const filtre: Prisma.DateTimeFilter = {};
  if (dateDebut) filtre.gte = new Date(dateDebut);
  if (dateFin) filtre.lte = new Date(new Date(dateFin).getTime() + UN_JOUR_MS - 1);
  return filtre;
}

/**
 * Registre étudiants. La promotion et la date d'inscription ne sont pas
 * portées par la fiche : elles passent par la relation `inscriptions`, dans
 * un même `some` pour viser un même dossier (promotion ET période).
 * La recherche textuelle reste ajoutée par `CrudService.findAll`.
 */
export function whereEtudiants(query: EtudiantQueryDto): Prisma.EtudiantWhereInput {
  const actif =
    query.actif === 'false' || query.actif === '0' ? false : query.actif ? true : undefined;
  const createdAt = intervalleDates(query.dateDebut, query.dateFin);
  const dossier: Prisma.InscriptionWhereInput = {
    ...(query.promotionId ? { promotionId: query.promotionId } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
  return {
    ...(actif !== undefined ? { actif } : {}),
    ...(query.sexe ? { sexe: query.sexe } : {}),
    ...(Object.keys(dossier).length ? { inscriptions: { some: dossier } } : {}),
  };
}

/** Registre des inscriptions (dossiers). */
export function whereInscriptions(query: InscriptionQueryDto): Prisma.InscriptionWhereInput {
  const periode = intervalleDates(query.dateDebut, query.dateFin);
  const et: Prisma.InscriptionWhereInput[] = [];
  if (query.search) {
    et.push({
      OR: [
        { numero: { contains: query.search, mode: 'insensitive' } },
        {
          etudiant: {
            OR: [
              { nom: { contains: query.search, mode: 'insensitive' } },
              { prenom: { contains: query.search, mode: 'insensitive' } },
              { matricule: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        },
      ],
    });
  }
  if (periode) {
    // Date d'inscription si elle est renseignée, sinon date de création du dossier.
    et.push({
      OR: [{ dateInscription: periode }, { dateInscription: null, createdAt: periode }],
    });
  }
  return {
    ...(query.anneeId ? { anneeId: query.anneeId } : {}),
    ...(query.promotionId ? { promotionId: query.promotionId } : {}),
    ...(query.etudiantId ? { etudiantId: query.etudiantId } : {}),
    ...(query.statut ? { statut: query.statut } : {}),
    ...(et.length ? { AND: et } : {}),
  };
}
