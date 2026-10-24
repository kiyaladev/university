import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Logger,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { ErreurHttpFilter, normaliserErreur } from './erreur-http.filter';
import { PrismaExceptionFilter } from '../prisma-exception.filter';

describe('ErreurHttpFilter — format d’erreur unique', () => {
  const response = {};
  const adapter = { isHeadersSent: jest.fn(() => false), reply: jest.fn(), end: jest.fn() };
  const host = { getArgByIndex: () => response } as unknown as ArgumentsHost;
  const filter = new ErreurHttpFilter({ httpAdapter: adapter } as unknown as HttpAdapterHost);

  beforeEach(() => jest.clearAllMocks());

  /** Corps réellement envoyé au client. */
  const corpsEnvoye = () => adapter.reply.mock.calls[0][1] as Record<string, unknown>;
  const statutEnvoye = () => adapter.reply.mock.calls[0][2] as number;

  it('renvoie les trois champs du format unique', () => {
    filter.catch(new BadRequestException('Saisie invalide'), host);

    expect(corpsEnvoye()).toEqual({
      statusCode: 400,
      message: 'Saisie invalide',
      error: 'Bad Request',
    });
    expect(statutEnvoye()).toBe(400);
  });

  it('accepte un tableau de messages (validation de formulaire)', () => {
    filter.catch(new BadRequestException(['Champ A requis', 'Champ B invalide']), host);

    expect(corpsEnvoye()).toEqual({
      statusCode: 400,
      message: ['Champ A requis', 'Champ B invalide'],
      error: 'Bad Request',
    });
  });

  it('reprend l’ancien format de validation { statutCode, erreur, messages }', () => {
    // Écriture historique : le format unique ne doit pas la perdre.
    filter.catch(
      new BadRequestException({ statutCode: 400, erreur: 'ValidationFailed', messages: ['Champ A requis'] }),
      host,
    );

    expect(corpsEnvoye()).toEqual({
      statusCode: 400,
      message: ['Champ A requis'],
      error: 'Bad Request',
    });
  });

  it('conserve les champs hors erreur (sonde de santé)', () => {
    filter.catch(
      new ServiceUnavailableException({
        status: 'error',
        service: 'university-api',
        database: 'unavailable',
      }),
      host,
    );

    expect(corpsEnvoye()).toEqual({
      status: 'error',
      service: 'university-api',
      database: 'unavailable',
      statusCode: 503,
      message: 'Service Unavailable',
      error: 'Service Unavailable',
    });
  });

  it('traduit toujours les erreurs Prisma en 404/409', () => {
    const erreur = new Prisma.PrismaClientKnownRequestError('Détail interne', { code: 'P2002', clientVersion: '6' });
    filter.catch(erreur, host);

    expect(corpsEnvoye()).toEqual(expect.objectContaining({ statusCode: 409, error: 'Conflict' }));
    expect(statutEnvoye()).toBe(409);
  });

  it('répond aux erreurs inconnues sans divulguer leur détail', () => {
    const journal = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter.catch(new Error('Secret interne à ne pas exposer'), host);

    expect(corpsEnvoye()).toEqual(expect.objectContaining({ statusCode: 500, error: 'Internal Server Error' }));
    expect(JSON.stringify(corpsEnvoye())).not.toContain('Secret interne');
    journal.mockRestore();
  });
});

describe('normaliserErreur — cas limites', () => {
  it('reprend le libellé HTTP du statut quand l’erreur n’en porte pas', () => {
    const corps = normaliserErreur(new ConflictException({ statutCode: 409 }));

    expect(corps).toEqual({ statusCode: 409, message: 'Conflict', error: 'Conflict' });
  });

  it('conserve un message déjà au format unique', () => {
    const corps = normaliserErreur(
      new BadRequestException({ statusCode: 400, message: 'Déjà normalisé', error: 'Bad Request' }),
    );

    expect(corps).toEqual({ statusCode: 400, message: 'Déjà normalisé', error: 'Bad Request' });
  });

  it('remonte le message d’une erreur sans corps', () => {
    const corps = normaliserErreur(new BadRequestException());

    expect(corps).toEqual({ statusCode: 400, message: 'Bad Request', error: 'Bad Request' });
  });
});

/**
 * Le filtre doit être en tête de la file des filtres globaux : en
 * production, le filtre Prisma est enregistré par le mécanisme APP_FILTER,
 * donc avant celui de `main.ts`, et c'est nevertheless le filtre d'erreur
 * unique qui doit répondre.
 */
describe('ErreurHttpFilter — en conditions réelles', () => {
  @Controller('test')
  class TestController {
    @Get('ko')
    ko() {
      throw new BadRequestException('Saisie invalide');
    }

    @Get('liste')
    lister() {
      throw new BadRequestException(['A requis', 'B invalide']);
    }
  }

  @Module({
    controllers: [TestController],
    providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }],
  })
  class TestModule {}

  let app: NestExpressApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(TestModule, { bodyParser: false });
    app.useBodyParser('json', { limit: '8mb' });
    app.useGlobalFilters(new ErreurHttpFilter(app.get(HttpAdapterHost)));
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('répond au format unique sur une vraie requête', async () => {
    const reponse = await fetch(`${base}/test/ko`);

    expect(reponse.status).toBe(400);
    expect(await reponse.json()).toEqual({
      statusCode: 400,
      message: 'Saisie invalide',
      error: 'Bad Request',
    });
  });

  it('répond un tableau de messages sur une vraie requête', async () => {
    const reponse = await fetch(`${base}/test/liste`);

    expect(await reponse.json()).toEqual({
      statusCode: 400,
      message: ['A requis', 'B invalide'],
      error: 'Bad Request',
    });
  });
});
