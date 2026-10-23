import 'reflect-metadata';
import { Logger, BadRequestException } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import { I18nContext } from 'nestjs-i18n';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from './modules/auth/jwt.strategy';
import { AppModule } from './app.module';
import { ValidationPipeCompatStatuts } from './common/statuts';
import { ErreurHttpFilter } from './common/filters/erreur-http.filter';
import { t } from './common/i18n';

async function bootstrap() {
  // `bodyParser: false` : les analyseurs de corps sont enregistrés à la main
  // juste après, avec la limite de 8 Mo. Le double enregistrement (option
  // Nest + express) faisait venir deux fois le même middleware et la
  // limite n'était appliquée que par le second.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // En-têtes de sécurité. L'API ne sert que du JSON à une origine connue :
  // pas de CSP à composer, mais le reste (nosniff, HSTS, referrer) est gratuit.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // L'API tourne derrière nginx. Sans cela toutes les requêtes portent l'IP du
  // proxy : la limite de connexion serait partagée par toute l'université, et
  // les adresses tracées dans le journal d'audit seraient toutes 127.0.0.1.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.setGlobalPrefix('api');

  // `whitelist` retire en silence tout paramètre absent du DTO : un filtre
  // oublié côté serveur ne remonte alors aucune erreur, il ne filtre juste
  // rien. Hors production on refuse explicitement l'inconnu (400) pour que le
  // décalage se voie tout de suite ; en production on garde le silence, une
  // requête un peu bavarde ne doit pas casser un écran en service.
  const enProduction = process.env.NODE_ENV === 'production';

  /**
   * Fabrique d'exceptions de validation : si le `message` class-validator
   * ressemble à une clé i18n (« validation.required », « validation.invalidEmail »),
   * on le traduit dans la langue courante. Sinon, on garde le libellé tel quel.
   */
  const factory = (erreurs: ValidationError[]) => {
    const ctx = I18nContext.current();
    const messages = erreurs.flatMap((err) =>
      Object.values(err.constraints ?? {}).map((m) => {
        if (typeof m === 'string' && /^[a-z]+\.[a-zA-Z0-9_.]+$/.test(m) && ctx) {
          return ctx.t(m) as string;
        }
        return m as string;
      }),
    );
    return new BadRequestException(messages.length ? messages : t('common.validationFailed'));
  };

  app.useGlobalPipes(
    new ValidationPipeCompatStatuts({
      whitelist: true,
      forbidNonWhitelisted: !enProduction,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: factory,
    }),
  );

  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // En production, une liste d'origines vide ne doit jamais faire réfléchir
  // n'importe quel Origin tout en autorisant les cookies : on refuse tout.
  if (!origins.length && enProduction) {
    Logger.error(
      'CORS_ORIGINS est requis en production (liste d\u2019origines séparées par des virgules)',
      'Bootstrap',
    );
  }

  app.enableCors({
    origin: origins.length ? origins : enProduction ? false : true,
    credentials: true,
  });

  // Les signatures manuscrites et pièces jointes transitent en base64 :
  // une seule configuration des analyseurs de corps, avec la limite de 8 Mo.
  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('urlencoded', { limit: '8mb', extended: true });

  // Format d'erreur unique : `{ statusCode, message, error }`, quelle que
  // soit l'origine de l'erreur (validation, métier, base de données).
  app.useGlobalFilters(new ErreurHttpFilter(app.get(HttpAdapterHost)));

  const config = new DocumentBuilder()
    .setTitle('University — API')
    .setDescription('ERP universitaire : présence des enseignants, scolarité, finances, campus, documents.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  // Le middleware brut de Swagger échappe à la chaîne APP_GUARD : en
  // production, on ne publie l'inventaire des routes que derrière un jeton.
  if (enProduction) {
    const jwt = app.get(JwtService);
    const identite = app.get(JwtStrategy);
    app.use(['/api/docs', '/api/docs-json', '/api/docs-yaml'], async (req, res, next) => {
      const entete = req.headers.authorization ?? '';
      if (!entete.startsWith('Bearer ')) {
        res.status(401).json({ statusCode: 401, message: 'Documentation désactivée', error: 'Unauthorized' });
        return;
      }
      try {
        const charge = await jwt.verifyAsync(entete.slice(7));
        const utilisateur = await identite.validate(charge);
        if (utilisateur.role !== 'ADMIN') {
          res.status(403).json({ statusCode: 403, message: 'Réservé aux administrateurs', error: 'Forbidden' });
          return;
        }
      } catch {
        res.status(401).json({ statusCode: 401, message: 'Jeton invalide', error: 'Unauthorized' });
        return;
      }
      next();
    });
  }
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 5031);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  Logger.log(`University API démarrée sur http://${host}:${port}/api`, 'Bootstrap');
}

void bootstrap();
