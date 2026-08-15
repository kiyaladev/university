import 'reflect-metadata';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });

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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
  });

  // Les signatures manuscrites et pièces jointes transitent en base64.
  const express = require('express');
  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ limit: '8mb', extended: true }));

  const config = new DocumentBuilder()
    .setTitle('UniPrésence API')
    .setDescription(
      "Contrôle numérique de la présence des enseignants pendant les séances de cours",
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 5030);
  await app.listen(port, '0.0.0.0');
  Logger.log(`UniPrésence API démarrée sur http://0.0.0.0:${port}/api`, 'Bootstrap');
}

void bootstrap();
