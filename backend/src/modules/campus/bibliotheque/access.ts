import { Role } from '@prisma/client';
import { AuthUser } from '../../../common/decorators';

export function fondsComplet(user: AuthUser | null): boolean {
  return !!user && ([Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.ENSEIGNANT] as Role[]).includes(user.role);
}

/** Département tel qu'il est chargé : on n'en publie que le nom. */
interface DepartementCharge {
  nom: string;
}

/** Enseignant chargé avec son département : matricule et identifiants restent internes. */
interface EnseignantCharge {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  departementId: string | null;
  departement: DepartementCharge | null;
}

/** Nom public d'un département chargé. */
function nomDepartement(source: unknown): string {
  return (source as DepartementCharge).nom;
}

/** Projection publique d'un enseignant : ni matricule, ni identifiant interne. */
function projeterEnseignant(source: unknown): Record<string, unknown> {
  const {
    id: _id,
    matricule: _matricule,
    departementId: _departementIdEnseignant,
    departement: departementEnseignant,
    ...reste
  } = source as EnseignantCharge;
  return {
    ...reste,
    ...(departementEnseignant ? { departement: { nom: departementEnseignant.nom } } : {}),
  };
}

/** Métadonnées publiables : les matricules, clés internes et déposants sont internes. */
export function projectionPubliqueDocument(doc: object): Record<string, unknown> {
  const {
    etudiant: _etudiant,
    etudiantId: _etudiantId,
    enseignantId: _enseignantId,
    deposePar: _deposePar,
    deposeParId: _deposeParId,
    departementId: _departementId,
    departement,
    ...publicDoc
  } = doc as Record<string, unknown>;
  const enseignant = publicDoc.enseignant ? projeterEnseignant(publicDoc.enseignant) : undefined;
  return {
    ...publicDoc,
    ...(departement ? { departement: { nom: nomDepartement(departement) } } : {}),
    ...(enseignant ? { enseignant } : {}),
  };
}
