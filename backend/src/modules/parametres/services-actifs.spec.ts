import 'reflect-metadata';
import { BadRequestException, Controller, Get, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ServicesActifsController } from './services-actifs.controller';
import { ServicesActifsGuard } from './services-actifs.guard';
import { DUREE_CACHE_SERVICES_MS, ServicesActifsDto, ServicesActifsService } from './services-actifs.service';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../common/decorators';
import { ParametresService } from './parametres.service';

describe('Activation des services', () => {
  it('préserve les accès existants et rend les services essentiels non désactivables', async () => {
    const prisma = { parametre: { findMany: jest.fn().mockResolvedValue([{ cle: 'SERVICE_ACTIF_presence', valeur: 'false' }, { cle: 'SERVICE_ACTIF_vod', valeur: 'false' }]) } };
    const service = new ServicesActifsService(prisma as any);
    const liste = await service.liste();
    expect(liste.find(s => s.id === 'presence')?.actif).toBe(true);
    expect(liste.find(s => s.id === 'vod')?.actif).toBe(false);
    expect(liste.find(s => s.id === 'bibliotheque')?.actif).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ServicesActifsController.prototype.liste)).toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, ServicesActifsController.prototype.enregistrer)).toEqual(['ADMIN']);
  });
  it('refuse les inconnus, doublons et désactivations essentielles avant transaction', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new ServicesActifsService(prisma as any);
    for (const services of [[{ id: 'inconnu', actif: false }], [{ id: 'presence', actif: false }], [{ id: 'vod', actif: true }, { id: 'vod', actif: false }]]) {
      await expect(service.enregistrer({ services }, { id: 'admin' } as any)).rejects.toThrow(BadRequestException);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('journalise le changement dans la même transaction et ne stocke aucune identité personnelle', async () => {
    const tx = { parametre: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() }, auditLog: { create: jest.fn() } };
    const prisma = { $transaction: jest.fn(callback => callback(tx)), parametre: { findMany: jest.fn().mockResolvedValue([]) } };
    await new ServicesActifsService(prisma as any).enregistrer({ services: [{ id: 'vod', actif: false }] }, { id: 'admin' } as any);
    expect(tx.parametre.upsert).toHaveBeenCalledWith({ where: { cle: 'SERVICE_ACTIF_vod' }, create: { cle: 'SERVICE_ACTIF_vod', valeur: 'false' }, update: { valeur: 'false' } });
    expect(JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details)).toEqual({ service: 'vod', avant: { actif: true }, apres: { actif: false } });
  });
  it('refuse une écriture si sa trace ne peut pas être créée', async () => {
    const tx = { parametre: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() }, auditLog: { create: jest.fn().mockRejectedValue(new Error('audit')) } };
    const prisma = { $transaction: jest.fn(callback => callback(tx)), parametre: { findMany: jest.fn() } };
    await expect(new ServicesActifsService(prisma as any).enregistrer({ services: [{ id: 'vod', actif: false }] }, { id: 'admin' } as any)).rejects.toThrow('audit');
    expect(prisma.parametre.findMany).not.toHaveBeenCalled();
  });
  it('refuse la modification des services via les paramètres génériques', async () => {
    const prisma = { $transaction: jest.fn() };
    await expect(new ParametresService(prisma as any).enregistrer({ parametres: [{ cle: 'SERVICE_ACTIF_vod', valeur: 'false' }] })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('valide réellement les booléens JSON et refuse les services dupliqués', async () => {
    for (const services of [[{ id: 'vod', actif: 'false' }], [{ id: 'vod', actif: false }, { id: 'vod', actif: false }]]) {
      expect((await validate(plainToInstance(ServicesActifsDto, { services }, { enableImplicitConversion: true }))).length).toBeGreaterThan(0);
    }
  });
  it('met les activations en cache, invalide à l’écriture et expire après le TTL', async () => {
    let valeur = 'false';
    const tx = { parametre: { findUnique: jest.fn().mockResolvedValue({ valeur: 'false' }), upsert: jest.fn(async () => { valeur = 'true'; }) }, auditLog: { create: jest.fn() } };
    const prisma = {
      $transaction: jest.fn(callback => callback(tx)),
      parametre: { findMany: jest.fn(async () => [{ cle: 'SERVICE_ACTIF_vod', valeur }]) },
    };
    const service = new ServicesActifsService(prisma as any);
    const maintenant = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      expect(await service.actif('vod')).toBe(false);
      expect(await service.actif('vod')).toBe(false);
      expect(await service.actif('presence')).toBe(true);
      expect(prisma.parametre.findMany).toHaveBeenCalledTimes(1);

      // Écriture : l'état suivant est relu tout de suite, sans attendre le TTL.
      await service.enregistrer({ services: [{ id: 'vod', actif: true }] }, { id: 'admin' } as any);
      expect(await service.actif('vod')).toBe(true);
      const appels = prisma.parametre.findMany.mock.calls.length;

      // Changement hors de ce processus : visible une fois le TTL écoulé.
      valeur = 'false';
      maintenant.mockReturnValue(1_000_000 + DUREE_CACHE_SERVICES_MS - 1);
      expect(await service.actif('vod')).toBe(true);
      maintenant.mockReturnValue(1_000_000 + DUREE_CACHE_SERVICES_MS + 1);
      expect(await service.actif('vod')).toBe(false);
      expect(prisma.parametre.findMany).toHaveBeenCalledTimes(appels + 1);
    } finally {
      maintenant.mockRestore();
    }
  });
  it('mutualise les lectures simultanées et jette un chargement antérieur à une écriture', async () => {
    let resoudre!: (rows: any[]) => void;
    const prisma = { parametre: { findMany: jest.fn(() => new Promise<any[]>(r => { resoudre = r; })) } };
    const service = new ServicesActifsService(prisma as any);
    const a = service.actif('vod');
    const b = service.actif('vod');
    expect(prisma.parametre.findMany).toHaveBeenCalledTimes(1);
    service.invalider();
    resoudre([{ cle: 'SERVICE_ACTIF_vod', valeur: 'false' }]);
    expect(await a).toBe(false);
    expect(await b).toBe(false);
    prisma.parametre.findMany.mockResolvedValue([] as any);
    expect(await service.actif('vod')).toBe(true);
    expect(prisma.parametre.findMany).toHaveBeenCalledTimes(2);
  });
  it('bloque les accès directs et les routes publiques, sans confondre portail et restauration', async () => {
    @Controller('portail/resto') class Resto { @Get('me') me() {} }
    @Controller('documents') class Bibliotheque { @Get(':id/fichier') fichier() {} }
    @Controller('portail') class Portail { @Get('me') me() {} }
    const service = { actif: jest.fn().mockResolvedValue(false) };
    const guard = new ServicesActifsGuard(service as any, new Reflector());
    const context = (controller: any, handler: string) => ({ getClass: () => controller, getHandler: () => controller.prototype[handler] }) as any;
    await expect(guard.canActivate(context(Resto, 'me'))).rejects.toThrow(NotFoundException);
    expect(service.actif).toHaveBeenLastCalledWith('restauration');
    await expect(guard.canActivate(context(Bibliotheque, 'fichier'))).rejects.toThrow(NotFoundException);
    expect(service.actif).toHaveBeenLastCalledWith('bibliotheque');
    service.actif.mockResolvedValue(true);
    await expect(guard.canActivate(context(Portail, 'me'))).resolves.toBe(true);
    expect(service.actif).toHaveBeenLastCalledWith('scolarite');
  });
});
