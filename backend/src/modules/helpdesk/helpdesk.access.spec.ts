import { NotFoundException } from '@nestjs/common';
import { Role, StatutTicket } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import * as QRCode from 'qrcode';
import { EquipementsService, TicketsService } from './helpdesk.service';

jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));

describe('résolution publique des QR d’équipement', () => {
  afterEach(() => jest.restoreAllMocks());

  it('retourne uniquement les champs nécessaires au formulaire de signalement', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'eq-1',
      libelle: 'Vidéoprojecteur',
      emplacement: 'Salle B12',
      actif: true,
    });
    const prisma = { equipementCampus: { findUnique } };
    const service = new EquipementsService(prisma as never, {} as never, {} as never);

    await expect(service.parCode('UP-IT-secret')).resolves.toEqual({
      id: 'eq-1',
      libelle: 'Vidéoprojecteur',
      emplacement: 'Salle B12',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { codeQr: 'UP-IT-secret' },
      select: { id: true, libelle: true, emplacement: true, actif: true },
    });
  });

  it('exclut le code de résolution des inventaires et fiches authentifiés', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const findUnique = jest.fn().mockResolvedValue({ id: 'eq-1', libelle: 'Vidéoprojecteur' });
    const service = new EquipementsService(
      { equipementCampus: { findMany, count, findUnique } } as never,
      {} as never,
      {} as never,
    );

    await service.liste({});
    await service.findOne('eq-1');

    expect(findMany.mock.calls[0][0].select).not.toHaveProperty('codeQr');
    expect(findUnique.mock.calls[0][0].select).not.toHaveProperty('codeQr');
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'eq-1' },
      select: expect.objectContaining({ libelle: true }),
    }));
  });

  it('masque les codes inconnus et les équipements désactivés derrière un NotFound identique', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Équipement indisponible' } as never);
    const findUnique = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'eq-2', libelle: 'Climatisation', emplacement: null, actif: false });
    const service = new EquipementsService(
      { equipementCampus: { findUnique } } as never,
      {} as never,
      {} as never,
    );

    await expect(service.parCode('UP-IT-unknown')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.parCode('UP-IT-disabled')).rejects.toBeInstanceOf(NotFoundException);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('rejette une référence anormalement longue sans requête en base', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Équipement indisponible' } as never);
    const findUnique = jest.fn();
    const service = new EquipementsService(
      { equipementCampus: { findUnique } } as never,
      {} as never,
      {} as never,
    );

    await expect(service.parCode('x'.repeat(65))).rejects.toBeInstanceOf(NotFoundException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('imprime le vrai code QR même si les fiches d’inventaire le masquent', async () => {
    jest.mocked(QRCode.toDataURL).mockResolvedValue('data:image/png;base64,qr' as never);
    const findUnique = jest.fn().mockResolvedValue({
      id: 'eq-1', libelle: 'Vidéoprojecteur', emplacement: 'Salle B12', codeQr: 'UP-IT-abc123',
    });
    const jwt = { verify: jest.fn().mockResolvedValue({}) };
    const parametres = { valeur: jest.fn().mockResolvedValue('Université') };
    const service = new EquipementsService(
      { equipementCampus: { findUnique } } as never,
      jwt as never,
      parametres as never,
    );

    const html = await service.imprimerQr('eq-1', 'valid-token', 'https://campus.test/');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'eq-1' },
      select: { id: true, libelle: true, emplacement: true, codeQr: true },
    });
    expect(html).toContain('UP-IT-abc123');
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      'https://campus.test/#/helpdesk?equipement=UP-IT-abc123',
      expect.any(Object),
    );
    expect(html).not.toContain('undefined');
  });
});

describe('visibilité des tickets du helpdesk', () => {
  afterEach(() => jest.restoreAllMocks());

  const utilisateur = (id: string, role: Role = Role.ENSEIGNANT) => ({
    id, role, nom: 'Diallo', prenom: 'Aïssatou', email: `${id}@campus.test`,
    departementId: null, enseignantId: null, etudiantId: null,
  });

  it('limite la liste d’un utilisateur ordinaire à ses déclarations, même avec les filtres', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = new TicketsService({ ticketSupport: { findMany, count } } as never);

    await service.liste({ statut: StatutTicket.OUVERT, equipementId: 'eq-1' }, utilisateur('user-1'));

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { utilisateurId: 'user-1', statut: StatutTicket.OUVERT, equipementId: 'eq-1' },
    }));
    expect(count).toHaveBeenCalledWith({
      where: { utilisateurId: 'user-1', statut: StatutTicket.OUVERT, equipementId: 'eq-1' },
    });
  });

  it.each([Role.ADMIN, Role.SCOLARITE, Role.DIRECTION])('%s peut consulter le registre complet', async role => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = new TicketsService({ ticketSupport: { findMany, count } } as never);

    await service.liste({}, utilisateur('gestionnaire', role));

    expect(findMany.mock.calls[0][0].where).toEqual({});
    expect(count.mock.calls[0][0].where).toEqual({});
  });

  it('masque un ticket appartenant à un autre utilisateur comme introuvable', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Ticket introuvable' } as never);
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new TicketsService({ ticketSupport: { findFirst } } as never);

    await expect(service.findTicket('ticket-1', utilisateur('user-1')))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ticket-1', utilisateurId: 'user-1' },
    }));
  });

  it('permet au déclarant de lire son ticket', async () => {
    const ticket = { id: 'ticket-1', utilisateurId: 'user-1' };
    const findFirst = jest.fn().mockResolvedValue(ticket);
    const service = new TicketsService({ ticketSupport: { findFirst } } as never);

    await expect(service.findTicket('ticket-1', utilisateur('user-1'))).resolves.toEqual(ticket);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ticket-1', utilisateurId: 'user-1' },
    }));
  });
});
