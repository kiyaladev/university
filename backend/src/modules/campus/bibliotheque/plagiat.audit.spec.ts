import { Role, StatutSuspicionPlagiat } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import type { AuthUser } from '../../../common/decorators';
import { PlagiatService } from './plagiat.service';

describe('PlagiatService — journal avant/après', () => {
  afterEach(() => jest.restoreAllMocks());

  it('journalise une décision sans le commentaire libre ni les métadonnées des documents', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Erreur' } as never);
    const suspicion = {
      id: 'suspicion-1',
      documentAId: 'doc-a',
      documentBId: 'doc-b',
      score: 94,
      statut: StatutSuspicionPlagiat.EN_ATTENTE,
      detecteLe: new Date('2026-09-30T10:00:00.000Z'),
      acquitteParId: null,
      acquitteLe: null,
      commentaire: null,
    };
    const auditLog = { create: jest.fn().mockResolvedValue({}) };
    const update = jest.fn(async ({ data }: any) => ({ ...suspicion, ...data }));
    const tx = {
      suspicionPlagiat: {
        findUnique: jest.fn().mockResolvedValue(suspicion),
        update,
      },
      auditLog,
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new PlagiatService(prisma);
    const user = { id: 'direction-1', role: Role.DIRECTION } as AuthUser;

    await service.acquitter('suspicion-1', StatutSuspicionPlagiat.CONFIRME, user, 'Texte confidentiel du mémoire');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'suspicion-1' },
        data: expect.objectContaining({ statut: StatutSuspicionPlagiat.CONFIRME }),
      }),
    );
    const trace = auditLog.create.mock.calls[0][0].data;
    expect(trace).toMatchObject({
      userId: 'direction-1',
      action: 'PLAGIAT_CONFIRME',
      entite: 'SuspicionPlagiat',
      entiteId: 'suspicion-1',
    });
    const details = JSON.parse(trace.details);
    expect(details.avant.statut).toBe(StatutSuspicionPlagiat.EN_ATTENTE);
    expect(details.apres.statut).toBe(StatutSuspicionPlagiat.CONFIRME);
    expect(details.apres.commentaireFourni).toBe(true);
    expect(trace.details).not.toContain('Texte confidentiel');
    expect(trace.details).not.toContain('titre');
  });

  it('journalise la création automatique d’une paire sans attribuer le calcul à un utilisateur', async () => {
    const cible = {
      id: 'doc-a',
      titre: 'Titre privé',
      contenuTexte: 'texte extrait privé',
      resume: 'résumé privé',
      motsClefs: [],
      empreinteHash: 'empreinte-identifiante',
      type: 'MEMOIRE',
      indicePlagiat: 0,
    };
    const suspicionCreee = {
      id: 'suspicion-2',
      documentAId: 'doc-a',
      documentBId: 'doc-b',
      score: 100,
      statut: StatutSuspicionPlagiat.EN_ATTENTE,
      detecteLe: new Date('2026-10-03T10:00:00.000Z'),
      acquitteParId: null,
      acquitteLe: null,
      commentaire: null,
    };
    const auditLog = { create: jest.fn().mockResolvedValue({}) };
    const tx = {
      suspicionPlagiat: { create: jest.fn().mockResolvedValue(suspicionCreee) },
      documentDepot: { update: jest.fn().mockResolvedValue({}) },
      auditLog,
    };
    const prisma: any = {
      documentDepot: {
        findUnique: jest.fn().mockResolvedValue(cible),
        findMany: jest.fn().mockResolvedValue([{ id: 'doc-b', empreinteHash: cible.empreinteHash }]),
      },
      suspicionPlagiat: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new PlagiatService(prisma);

    await expect(service.detecterDoublons('doc-a')).resolves.toEqual({ creees: 1, ignorees: 0 });

    const trace = auditLog.create.mock.calls[0][0].data;
    expect(trace).toMatchObject({
      userId: null,
      action: 'PLAGIAT_SUSPICION_OUVERTE',
      entite: 'SuspicionPlagiat',
      entiteId: 'suspicion-2',
    });
    expect(trace.details).not.toContain('Titre privé');
    expect(trace.details).not.toContain('texte extrait privé');
    expect(trace.details).not.toContain('empreinte-identifiante');
  });
});
