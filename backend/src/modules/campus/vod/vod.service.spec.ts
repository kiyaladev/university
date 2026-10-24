import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { VodService } from './vod.service';

describe('Confidentialité des ressources VOD', () => {
  const student = { id: 'user', role: Role.ETUDIANT, etudiantId: 'own' } as any;
  const teacher = { id: 'teacher-user', role: Role.ENSEIGNANT, enseignantId: 'teacher' } as any;
  let prisma: any;
  let service: VodService;
  beforeEach(() => {
    prisma = {
      coursVOD: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({ id: 'foreign', creeParId: 'other' }),
        update: jest.fn(),
      },
    };
    service = new VodService(prisma);
  });
  it('un filtre étudiant ne remplace pas son périmètre de lecture', async () => {
    await service.lister({ inscriptionId: 'foreign', statut: 'BROUILLON', public: 'false' } as any, student);
    expect(prisma.coursVOD.findMany.mock.calls[0][0].where.AND).toEqual([
      {
        statut: 'EN_LIGNE',
        OR: [{ public: true }, { inscription: { etudiantId: 'own' } }],
      },
    ]);
  });
  it('la recherche applique aussi le périmètre étudiant', async () => {
    await service.recherche('cours', student);
    expect(prisma.coursVOD.findMany.mock.calls[0][0].where.AND[0].OR[1]).toEqual({
      inscription: { etudiantId: 'own' },
    });
  });
  it('un identifiant direct hors périmètre reste introuvable', async () => {
    await expect(service.trouverPour('foreign', student)).rejects.toThrow(NotFoundException);
  });
  it.each(['modifier', 'publier', 'archiver', 'statistiques'])(
    'refuse %s sur la ressource d’un autre auteur',
    async (method) => {
      const action =
        method === 'modifier' || method === 'archiver'
          ? (service as any)[method]('foreign', {}, teacher)
          : (service as any)[method]('foreign', teacher);
      await expect(action).rejects.toThrow(method === 'statistiques' ? NotFoundException : ForbiddenException);
      expect(prisma.coursVOD.update).not.toHaveBeenCalled();
    },
  );

  it('masque une statistique VOD hors périmètre avec la même réponse qu’un identifiant absent', async () => {
    await expect(service.statistiques('foreign', teacher)).rejects.toThrow(NotFoundException);
    expect(prisma.coursVOD.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'foreign', creeParId: 'teacher-user' },
      }),
    );
  });
});
