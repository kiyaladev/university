import { BadRequestException } from '@nestjs/common';
import { exigerAnneeOuverte, exigerPromotionMemeAnnee } from './annee';

describe('verrou d’année académique', () => {
  const db = (cloturee: boolean | null) => ({
    anneeAcademique: { findUnique: jest.fn().mockResolvedValue(cloturee === null ? null : { cloturee }) },
  });

  it('laisse passer une année ouverte', async () => {
    const prisma = db(false);
    await expect(exigerAnneeOuverte(prisma, 'annee-1')).resolves.toBeUndefined();
  });

  it('refuse une écriture dans une année close', async () => {
    const prisma = db(true);
    await expect(exigerAnneeOuverte(prisma, 'annee-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une référence vers une année inexistante', async () => {
    const db = { anneeAcademique: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(exigerAnneeOuverte(db as any, 'annee-absente')).rejects.toThrow(BadRequestException);
  });

  it('ne fait aucune requête lorsqu’aucune année ne porte la donnée', async () => {
    const prisma = db(false);
    await exigerAnneeOuverte(prisma, null);
    expect(prisma.anneeAcademique.findUnique).not.toHaveBeenCalled();
  });

  it('verrouille la ligne d’année dans la transaction pendant la mutation', async () => {
    const query = jest.fn().mockResolvedValue([{ cloturee: false }]);
    const prisma: any = { $queryRaw: query };
    await exigerAnneeOuverte(prisma, 'annee-1');
    expect(query.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    expect(query.mock.calls[0][1]).toBe('annee-1');
  });

  it('refuse une année close sur la branche SQL verrouillée', async () => {
    const query = jest.fn().mockResolvedValue([{ cloturee: true }]);
    await expect(exigerAnneeOuverte({ $queryRaw: query } as any, 'annee-1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls[0][0].join('?')).toContain('FOR SHARE');
  });

  it('refuse une année manquante sur la branche SQL verrouillée', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await expect(exigerAnneeOuverte({ $queryRaw: query } as any, 'annee-absente'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls[0][0].join('?')).toContain('FOR SHARE');
  });

  it('utilise le client transactionnel fourni au callback', async () => {
    const tx: any = { $queryRaw: jest.fn().mockResolvedValue([{ cloturee: false }]) };
    const prisma: any = { $transaction: jest.fn((operation: (client: any) => unknown) => operation(tx)) };
    await prisma.$transaction((client: any) => exigerAnneeOuverte(client, 'annee-1'));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain('FOR SHARE');
  });

  it('verrouille la promotion et refuse une année différente', async () => {
    const query = jest.fn().mockResolvedValue([{ anneeId: 'annee-2' }]);
    const prisma: any = { $queryRaw: query };
    await expect(exigerPromotionMemeAnnee(prisma, 'promotion-1', 'annee-1'))
      .rejects.toThrow('même année académique');
    expect(query.mock.calls[0][0].join('?')).toContain('FOR SHARE');
    expect(query.mock.calls[0][1]).toBe('promotion-1');
  });
});
