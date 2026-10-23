import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { OtpClient, numerique } from './otp.client';
import { SmsService } from './sms.service';

describe('Contrat HTTP local OTP/SMS', () => {
  let server: Server;
  let base: string;
  let status: number;
  let response: any;
  let raw: string | undefined;
  let hold: boolean;
  const requests: Array<{ path: string; key: string | string[]; body: any }> = [];
  const old = {
    url: process.env.OTP_GATEWAY_URL,
    key: process.env.OTP_API_KEY,
    template: process.env.OTP_MESSAGE_TEMPLATE,
  };
  const basePrisma = () => {
    const tx = {
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
        update: jest.fn().mockResolvedValue({ id: 'notification-1' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      notification: tx.notification,
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    return { tx, prisma };
  };
  beforeAll(async () => {
    server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      requests.push({
        path: req.url!,
        key: req.headers['x-api-key']!,
        body: JSON.parse(Buffer.concat(chunks).toString()),
      });
      if (hold) return;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(raw ?? JSON.stringify(response));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    process.env.OTP_GATEWAY_URL = base + '/';
    process.env.OTP_API_KEY = 'cle-recette';
    process.env.OTP_MESSAGE_TEMPLATE = 'Code {code}, valable {minutes} min';
    status = 200;
    response = { ok: true, requestId: 42, expiresAt: Date.now() + 300000 };
    raw = undefined;
    hold = false;
    requests.length = 0;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    for (const [key, value] of Object.entries({
      OTP_GATEWAY_URL: old.url,
      OTP_API_KEY: old.key,
      OTP_MESSAGE_TEMPLATE: old.template,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it.each(['+224 622 000 001', '622000001', '0622000001'])('normalise %s', (telephone) => {
    expect(numerique(telephone)).toBe('622000001');
  });
  it('émet un OTP avec clé et gabarit sans journaliser le code', async () => {
    await expect(new OtpClient().envoyer('+224 622000001', { but: 'portail' })).resolves.toMatchObject({
      ok: true,
      requestId: 42,
    });
    expect(requests).toEqual([
      {
        path: '/api/otp/send',
        key: 'cle-recette',
        body: { phone: '622000001', purpose: 'portail', template: 'Code {code}, valable {minutes} min' },
      },
    ]);
  });
  it('émet un SMS libre sur sa route, sans génération d’OTP', async () => {
    await new OtpClient().envoyerSms('622000001', 'Message contenant {code} littéralement');
    expect(requests).toEqual([
      {
        path: '/api/sms/send',
        key: 'cle-recette',
        body: { phone: '622000001', message: 'Message contenant {code} littéralement' },
      },
    ]);
  });
  it.each(['invalid_code', 'no_active_code', 'too_many_attempts'])(
    'adapte la réponse %s au modèle interne',
    async (reason) => {
      response = { valid: false, reason, remainingAttempts: 4 };
      await expect(new OtpClient().verifier('622000001', '123456')).resolves.toEqual({
        valid: false,
        raison: reason,
        tentativesRestantes: 4,
      });
      expect(requests[0]).toEqual({
        path: '/api/otp/verify',
        key: 'cle-recette',
        body: { phone: '622000001', code: '123456' },
      });
    },
  );
  it('accepte la vérification positive explicite de la passerelle', async () => {
    response = { valid: true };
    await expect(new OtpClient().verifier('622000001', '123456')).resolves.toEqual({ valid: true });
  });
  it('refuse une réponse de vérification ambiguë', async () => {
    response = { valid: 'true' };
    await expect(new OtpClient().verifier('622000001', '123456')).resolves.toMatchObject({
      valid: false,
      raison: 'passerelle_injoignable',
    });
  });
  it('refuse le JSON invalide ou l’accusé d’émission sans référence', async () => {
    raw = 'not-json';
    await expect(new OtpClient().envoyer('622000001')).resolves.toMatchObject({ ok: false });
    raw = undefined;
    response = { ok: true };
    await expect(new OtpClient().envoyerSms('622000001', 'Message')).resolves.toMatchObject({ ok: false });
  });
  it('consigne un refus de passerelle sans exposer sa réponse dans les logs', async () => {
    status = 401;
    response = { error: 'secret-temoin' };
    const { tx, prisma } = basePrisma();
    await expect(
      new SmsService(prisma as any, new OtpClient()).envoyerUn({
        telephone: '622000001',
        message: 'Message secret',
        destinataireNom: 'Nom témoin',
        etudiantId: 'etudiant-temoin',
        motif: 'MOTIF_SECRET',
      }),
    ).resolves.toMatchObject({ ok: false });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ statut: 'EN_ATTENTE', envoyeLe: null }),
      select: { id: true },
    });
    expect(tx.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: expect.objectContaining({ statut: 'ECHOUE', envoyeLe: null }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'SMS_DIFFUSION_DEMANDEE',
        entite: 'Notification',
        details: expect.stringContaining('"nombreDestinataires":1'),
      }),
    });
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toMatch(
      /622000001|Message secret|Nom témoin|etudiant-temoin|MOTIF_SECRET|secret-temoin/,
    );
    expect(JSON.stringify((Logger.prototype.warn as jest.Mock).mock.calls)).not.toContain('secret-temoin');
  });
  it('consigne la mise en file comme accusé de passerelle, avec date', async () => {
    const { tx, prisma } = basePrisma();
    await new SmsService(prisma as any, new OtpClient()).envoyerUn({
      telephone: '622000001',
      message: 'Avis secret',
      envoyeParId: 'agent-1',
      motif: 'AVIS_SECRET',
      destinataireNom: 'Nom témoin',
      etudiantId: 'etudiant-temoin',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ statut: 'EN_ATTENTE', envoyeLe: null }),
      select: { id: true },
    });
    expect(tx.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: expect.objectContaining({ statut: 'ENVOYEE', envoyeLe: expect.any(Date) }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'agent-1',
        action: 'SMS_DIFFUSION_DEMANDEE',
        entite: 'Notification',
        details: expect.stringContaining('"statutInitial":"EN_ATTENTE"'),
      }),
    });
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toMatch(
      /622000001|Avis secret|Nom témoin|etudiant-temoin|AVIS_SECRET/,
    );
    expect(requests[0].path).toBe('/api/sms/send');
  });
  it('ne contacte pas la passerelle si l’intention ne peut pas être journalisée', async () => {
    const otp = { envoyerSms: jest.fn().mockResolvedValue({ ok: true, requestId: 42 }) };
    const persiste = { notifications: [] as unknown[], audit: [] as unknown[] };
    const tx = {
      notification: {
        create: jest.fn(async (args: unknown) => {
          persiste.notifications.push(args);
          return { id: 'notification-1' };
        }),
      },
      auditLog: {
        create: jest.fn(async (args: unknown) => {
          persiste.audit.push(args);
          throw new Error('journal indisponible');
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
        try {
          return await callback(tx);
        } catch (erreur) {
          persiste.notifications.length = 0;
          persiste.audit.length = 0;
          throw erreur;
        }
      }),
    };
    await expect(
      new SmsService(prisma as any, otp as any).envoyerUn({ telephone: '622000001', message: 'Avis' }),
    ).resolves.toMatchObject({ ok: false });
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(persiste).toEqual({ notifications: [], audit: [] });
    expect(otp.envoyerSms).not.toHaveBeenCalled();
  });
  it('borne à dix les envois concurrents et conserve un résultat par cible', async () => {
    let actifs = 0;
    let maximum = 0;
    let numero = 0;
    const otp = {
      envoyerSms: async () => {
        actifs += 1;
        maximum = Math.max(maximum, actifs);
        await new Promise((resolve) => setTimeout(resolve, 5));
        actifs -= 1;
        return { ok: true, requestId: ++numero };
      },
    };
    const { prisma } = basePrisma();
    const cibles = Array.from({ length: 27 }, (_, index) => ({
      telephone: `622000${String(index).padStart(3, '0')}`,
      message: 'Recette',
    }));
    const resultats = await new SmsService(prisma as any, otp as any).envoyerPlusieurs(cibles);
    expect(resultats).toMatchObject({ total: 27, envoyees: 27, echouees: 0 });
    expect(maximum).toBe(10);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0]).toBeDefined();
  });
  it('résume les résultats mixtes sans interrompre les autres destinataires', async () => {
    const { prisma } = basePrisma();
    const otp = {
      envoyerSms: jest.fn(async (telephone: string) => ({
        ok: telephone !== '622000002',
        requestId: 42,
        raison: telephone === '622000002' ? 'refus' : undefined,
      })),
    };
    const resultats = await new SmsService(prisma as any, otp as any).envoyerPlusieurs([
      { telephone: '622000001', message: 'A' },
      { telephone: '622000002', message: 'B' },
      { telephone: '622000003', message: 'C' },
    ]);
    expect(resultats).toMatchObject({ total: 3, envoyees: 2, echouees: 1 });
    expect(resultats.resultats.map((r) => r.ok)).toEqual([true, false, true]);
  });
  it('retourne un lot vide sans ouvrir de transaction', async () => {
    const { prisma } = basePrisma();
    const resultat = await new SmsService(prisma as any, new OtpClient()).envoyerPlusieurs([]);
    expect(resultat).toEqual({ total: 0, envoyees: 0, echouees: 0, resultats: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('interrompt un serveur local qui ne répond pas', async () => {
    hold = true;
    await expect(new OtpClient().envoyer('622000001')).resolves.toMatchObject({ ok: false });
  }, 12000);
});
