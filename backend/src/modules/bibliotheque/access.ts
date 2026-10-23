import { Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators';

export function fondsComplet(user: AuthUser | null): boolean {
  return !!user && ([Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.ENSEIGNANT] as Role[]).includes(user.role);
}

/** Métadonnées publiables : les matricules, clés internes et déposants sont internes. */
export function projectionPubliqueDocument(doc: Record<string, any>): Record<string, any> {
  const {
    etudiant: _etudiant,
    etudiantId: _etudiantId,
    enseignantId: _enseignantId,
    deposePar: _deposePar,
    deposeParId: _deposeParId,
    departementId: _departementId,
    departement,
    ...publicDoc
  } = doc;
  const enseignant = publicDoc.enseignant
    ? (() => {
        const {
          id: _id,
          matricule: _matricule,
          departementId: _departementIdEnseignant,
          departement: departementEnseignant,
          ...reste
        } = publicDoc.enseignant;
        return {
          ...reste,
          ...(departementEnseignant ? { departement: { nom: departementEnseignant.nom } } : {}),
        };
      })()
    : undefined;
  return {
    ...publicDoc,
    ...(departement ? { departement: { nom: departement.nom } } : {}),
    ...(enseignant ? { enseignant } : {}),
  };
}
