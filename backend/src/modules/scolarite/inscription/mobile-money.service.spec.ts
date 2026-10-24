import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { HttpException, Logger } from '@nestjs/common';
import { MobileMoneyService } from './mobile-money.service';

describe('Contrat HTTP local Mobile Money', () => {
  let server: Server;
  let base: string;
  let status: number;
  let response: any;
  let raw: string | undefined;
  let hold: boolean;
  const requests: Array<{ path: string; auth: string; body: any }> = [];
  const old = { url: process.env.MOBILE_MONEY_URL, key: process.env.MOBILE_MONEY_API_KEY };
  const dto = {
    reference: 'QA-PAYMENT',
    montant: 1000,
    devise: 'GNF',
    operateur: 'Orange Money',
    telephone: '622000001',
  };
  beforeAll(async () => {
    server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      requests.push({
        path: req.url!,
        auth: req.headers.authorization!,
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
    process.env.MOBILE_MONEY_URL = base + '/';
    process.env.MOBILE_MONEY_API_KEY = 'cle-recette';
    status = 202;
    response = { transactionId: 'QA-TXN' };
    raw = undefined;
    hold = false;
    requests.length = 0;
    for (const method of ['log', 'warn', 'error'] as const)
      jest.spyOn(Logger.prototype, method).mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const [key, value] of Object.entries({ MOBILE_MONEY_URL: old.url, MOBILE_MONEY_API_KEY: old.key })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it('respecte la requête d’initiation et la référence de transaction', async () => {
    await expect(new MobileMoneyService().demanderPaiement(dto)).resolves.toEqual({
      mode: 'operateur',
      transactionId: 'QA-TXN',
    });
    expect(requests).toEqual([{ path: '/paiements', auth: 'Bearer cle-recette', body: { ...dto, motif: null } }]);
  });
  it.each([{ reference: 'QA-REF' }, { id: 42 }])('adapte une référence opérateur alternative', async (body) => {
    response = body;
    const result = await new MobileMoneyService().demanderPaiement(dto);
    expect(result.transactionId).toBe(String(body.reference ?? body.id));
  });
  it.each([{}, { transactionId: '' }, { transactionId: {} }, { id: 0 }])('refuse un accusé ambigu %j', async (body) => {
    response = body;
    await expect(new MobileMoneyService().demanderPaiement(dto)).rejects.toMatchObject({ status: 502 });
  });
  it('refuse le JSON invalide', async () => {
    raw = 'not-json';
    await expect(new MobileMoneyService().demanderPaiement(dto)).rejects.toBeInstanceOf(HttpException);
  });
  it('garde un refus opérateur comme erreur sans journaliser son corps', async () => {
    status = 422;
    response = { message: 'secret-temoin', apiKey: 'secret-temoin' };
    await expect(new MobileMoneyService().demanderPaiement(dto)).rejects.toMatchObject({ status: 502 });
    expect(JSON.stringify((Logger.prototype.warn as jest.Mock).mock.calls)).not.toContain('secret-temoin');
  });
  it('identifie le pilote sans appel réseau ni téléphone dans les logs', async () => {
    delete process.env.MOBILE_MONEY_URL;
    await expect(new MobileMoneyService().demanderPaiement(dto)).resolves.toEqual({
      mode: 'simulation',
      transactionId: null,
    });
    expect(requests).toEqual([]);
    expect(JSON.stringify((Logger.prototype.log as jest.Mock).mock.calls)).not.toContain(dto.telephone);
  });
  it('interrompt un serveur local qui ne répond pas', async () => {
    hold = true;
    await expect(new MobileMoneyService().demanderPaiement(dto)).rejects.toMatchObject({ status: 502 });
  }, 15000);
});
