/** Rôles autorisés sur la structure académique. */

import { Role } from '@prisma/client';

export const GESTION = [Role.ADMIN, Role.SCOLARITE] as const;

export const LECTURE_STRUCTURE = [
  Role.ADMIN,
  Role.DIRECTION,
  Role.SCOLARITE,
  Role.CHEF_DEPARTEMENT,
  Role.CONTROLEUR,
  Role.ENSEIGNANT,
] as const;
