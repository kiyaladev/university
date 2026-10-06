import { SetMetadata, createParamDecorator, ExecutionContext, applyDecorators } from '@nestjs/common';
import { Role } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
/** Rend une route accessible sans jeton JWT. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restreint une route à une liste de rôles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const DOCUMENT_ACCESS_KEY = 'documentAccess';
/** Authentification normale, avec prise en charge du jeton du nouvel onglet. */
export const ProtectedDocument = (...roles: Role[]) => applyDecorators(
  SetMetadata(IS_PUBLIC_KEY, false),
  SetMetadata(DOCUMENT_ACCESS_KEY, true),
  Roles(...roles),
);

export const DOCUMENT_SCOPE_KEY = 'documentScope';
export interface DocumentScopeOptions {
  model: string;
  fields: Partial<Record<Role, string>>;
}
/** Contrôle le propriétaire avant que le HTML ne soit généré. */
export const DocumentScope = (model: string, fields: DocumentScopeOptions['fields']) =>
  SetMetadata(DOCUMENT_SCOPE_KEY, { model, fields } satisfies DocumentScopeOptions);

export interface AuthUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  departementId: string | null;
  enseignantId: string | null;
  etudiantId: string | null;
}

/** Injecte l'utilisateur authentifié dans un handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as AuthUser;
    return data ? user?.[data] : user;
  },
);
