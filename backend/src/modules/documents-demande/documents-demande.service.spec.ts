import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DocumentsDemandeService } from './documents-demande.service';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

describe('Sécurité des demandes de documents', () => {
  const user = { id: 'user', etudiantId: 'owner', role: Role.ETUDIANT } as any;
  it('refuse Mobile Money sans coordonnées avant de créer un paiement', async () => {
    const service = new DocumentsDemandeService({} as any);
    const load = jest.spyOn(service, 'findOnePour');
    await expect(service.payer('doc', { mode: 'MOBILE_MONEY' }, user)).rejects.toThrow(BadRequestException);
    expect(load).not.toHaveBeenCalled();
  });
  it('refuse le rattachement à une inscription tierce avant de créer une demande', async () => {
    const db = { inscription: { findFirst: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn() };
    const service = new DocumentsDemandeService(db as any);
    await expect(service.creer({ type: 'ATTESTATION_SCOLARITE', inscriptionId: 'foreign' }, user)).rejects.toThrow(NotFoundException);
    expect(db.inscription.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', etudiantId: 'owner' }, select: { id: true } });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('refuse la confirmation simulée par un étudiant en production', async () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const service = new DocumentsDemandeService({} as any);
    const load = jest.spyOn(service, 'findOnePour');
    try {
      await expect(service.payer('doc', { mode: 'ESPECES', simuler: true }, user)).rejects.toThrow(BadRequestException);
      expect(load).not.toHaveBeenCalled();
    } finally { process.env.NODE_ENV = oldEnv; }
  });

  it('filtre le détail par propriétaire dans la requête et masque un identifiant tiers', async () => {
    const db = { demandeDocument: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new DocumentsDemandeService(db as any);
    await expect(service.findOnePour('demande-autre', user)).rejects.toThrow(NotFoundException);
    expect(db.demandeDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'demande-autre', etudiantId: 'owner' },
    }));
  });

  it('permet au personnel autorisé de charger le détail par identifiant', async () => {
    const demande = { id: 'demande-1', etudiantId: 'owner' };
    const db = { demandeDocument: { findFirst: jest.fn().mockResolvedValue(demande) } };
    const service = new DocumentsDemandeService(db as any);
    await expect(service.findOnePour('demande-1', { ...user, role: Role.SCOLARITE } as any)).resolves.toBe(demande);
    expect(db.demandeDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'demande-1' },
    }));
  });
});
