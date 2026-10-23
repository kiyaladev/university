import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Role } from '@prisma/client';
import { AuthUser } from './decorators';
import { estChefDeDepartement } from './perimetre';

/** Password/PIN hashes and biometric templates never belong in an HTTP response. */
const SECRETS = new Set(['password', 'codePin', 'empreinteTemplate', 'nip', 'qrRestoToken']);

const ENSEIGNANT_MINIMAL = new Set([
  'id',
  'matricule',
  'nom',
  'prenom',
  'grade',
  'statut',
  'actif',
  'departementId',
  'departement',
]);
const ETUDIANT_MINIMAL = new Set(['id', 'matricule', 'nom', 'prenom', 'promotionId', 'promotion']);
const PREUVES_PRESENCE_PRIVEES = new Set(['signatureBase64', 'latitude', 'longitude', 'motif', 'piece', 'commentaire']);

export function sansSecrets(value: unknown, user?: AuthUser): unknown {
  if (Array.isArray(value)) return value.map((item) => sansSecrets(item, user));
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
  const record = value as Record<string, unknown>;
  const enseignant = 'tauxHoraire' in record && 'matricule' in record && 'prenom' in record;
  const etudiant =
    'matricule' in record &&
    'prenom' in record &&
    ('dateNaissance' in record || 'lieuNaissance' in record || 'qrRestoToken' in record);
  const projectionMinimale =
    enseignant &&
    user &&
    (user.role === Role.ETUDIANT ||
      user.role === Role.CONTROLEUR ||
      estChefDeDepartement(user) ||
      (user.role === Role.ENSEIGNANT && record.id !== user.enseignantId));
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !projectionMinimale || ENSEIGNANT_MINIMAL.has(key))
      .filter(([key]) => !(etudiant && user?.role === Role.ENSEIGNANT) || ETUDIANT_MINIMAL.has(key))
      .filter(([key, item]) => !SECRETS.has(key) || typeof item === 'boolean')
      .filter(([key]) => user?.role !== Role.CONTROLEUR || !PREUVES_PRESENCE_PRIVEES.has(key))
      .map(([key, item]) => [
        key,
        key === 'observation' && typeof item === 'string' && item.startsWith('Absence justifiée (')
          ? 'Absence justifiée'
          : sansSecrets(item, user),
      ]),
  );
}

@Injectable()
export class SensitiveDataInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    return next.handle().pipe(map((value) => sansSecrets(value, user)));
  }
}
