import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nJsonLoader,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard, LectureSeuleGuard, RolesGuard } from './common/guards';
import { DebitGuard } from './common/debit.guard';
import { DocumentScopeGuard } from './common/document-scope.guard';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { JwtConfigModule } from './common/jwt-config.module';
import { validerConfiguration } from './common/configuration';
import { SensitiveDataInterceptor } from './common/sensitive-data.interceptor';
import { HealthController } from './common/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ReferentielModule } from './modules/referentiel/referentiel.module';
import { PlanificationModule } from './modules/planification/planification.module';
import { ImportsModule } from './modules/imports/imports.module';
import { ControleModule } from './modules/controle/controle.module';
import { AttestationModule } from './modules/attestation/attestation.module';
import { JustificatifsModule } from './modules/justificatifs/justificatifs.module';
import { RapportsModule } from './modules/rapports/rapports.module';
import { ParametresModule } from './modules/parametres/parametres.module';
import { InscriptionModule } from './modules/inscription/inscription.module';
import { PaieModule } from './modules/paie/paie.module';
import { ScolariteModule } from './modules/scolarite/scolarite.module';
import { AttestationsModule } from './modules/attestations/attestations.module';
import { PortailModule } from './modules/portail/portail.module';
import { CitesModule } from './modules/cites/cites.module';
import { BibliothequeModule } from './modules/bibliotheque/bibliotheque.module';
import { RestoModule } from './modules/resto/resto.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { StagesModule } from './modules/stages/stages.module';
import { HelpdeskModule } from './modules/helpdesk/helpdesk.module';
import { FormationsModule } from './modules/formations/formations.module';
import { RectoratModule } from './modules/rectorat/rectorat.module';
import { PatrimoineModule } from './modules/patrimoine/patrimoine.module';
import { CourrierModule } from './modules/courrier/courrier.module';
import { ExamensModule } from './modules/examens/examens.module';
import { TirageModule } from './modules/tirage/tirage.module';
import { RecettesModule } from './modules/recettes/recettes.module';
import { ReclamationsModule } from './modules/reclamations/reclamations.module';
import { DocumentsDemandeModule } from './modules/documents-demande/documents-demande.module';
import { ElectionsModule } from './modules/elections/elections.module';
import { CarteEtudianteModule } from './modules/carte-etudiante/carte-etudiante.module';
import { BadgesModule } from './modules/badges/badges.module';
import { VodModule } from './modules/vod/vod.module';
import { ServicesActifsGuard } from './modules/parametres/services-actifs.guard';

@Module({
  imports: [
    // Variables vérifiées au démarrage : voir common/configuration.ts.
    ConfigModule.forRoot({ isGlobal: true, validate: validerConfiguration }),
    // Secret et durée de vie des jetons, résolus après le chargement du .env.
    JwtConfigModule,
    ScheduleModule.forRoot(),
    // Attention : toute définition nommée s'applique à TOUTES les routes. Un
    // strict 10/quart d'heure déclaré ici pour la connexion briderait
    // l'application entière — c'est arrivé. « connexion » est donc neutre par
    // défaut et ne prend sa valeur stricte que sur /auth/login, via @Throttle.
    ThrottlerModule.forRoot([
      { name: 'courant', ttl: 60_000, limit: 1200 },
      { name: 'connexion', ttl: 900_000, limit: 100_000 },
    ]),
    I18nModule.forRoot({
      fallbackLanguage: 'fr',
      loaderOptions: {
        path: path.join(__dirname, 'i18n/'),
      },
      loader: I18nJsonLoader,
      resolvers: [
        new HeaderResolver(['x-lang']),
        new AcceptLanguageResolver(),
        new QueryResolver(['lang', 'l']),
      ],
    }),
    PrismaModule,
    AuthModule,
    ReferentielModule,
    PlanificationModule,
    ImportsModule,
    ControleModule,
    AttestationModule,
    JustificatifsModule,
    RapportsModule,
    ParametresModule,
    InscriptionModule,
    PaieModule,
    ScolariteModule,
    AttestationsModule,
    PortailModule,
    CitesModule,
    BibliothequeModule,
    RestoModule,
    ReservationsModule,
    StagesModule,
    HelpdeskModule,
    FormationsModule,
    RectoratModule,
    PatrimoineModule,
    CourrierModule,
    ExamensModule,
    TirageModule,
    RecettesModule,
    ReclamationsModule,
    DocumentsDemandeModule,
    ElectionsModule,
    CarteEtudianteModule,
    BadgesModule,
    VodModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: SensitiveDataInterceptor },
    // Toutes les routes sont protégées par défaut : @Public() ouvre l'exception,
    // @Roles() restreint plus finement, et l'enseignant reste en lecture seule.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Après authentification : un jeton arbitraire ne peut pas créer un nouveau
    // compteur, et les sessions valides restent isolées derrière un NAT.
    { provide: APP_GUARD, useClass: DebitGuard },
    { provide: APP_GUARD, useClass: LectureSeuleGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useExisting: ServicesActifsGuard },
    { provide: APP_GUARD, useClass: DocumentScopeGuard },
    // P2025/P2002 deviennent des 404/409 explicites partout, y compris dans
    // les services qui n'écrivent pas via CrudService.
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
