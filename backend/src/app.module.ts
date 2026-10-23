import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AcceptLanguageResolver, HeaderResolver, I18nJsonLoader, I18nModule, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard, LectureSeuleGuard, RolesGuard } from './common/guards';
import { DebitGuard } from './common/debit.guard';
import { DocumentScopeGuard } from './common/document-scope.guard';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { JwtConfigModule } from './common/jwt-config.module';
import { validerConfiguration } from './common/configuration';
import { SensitiveDataInterceptor } from './common/sensitive-data.interceptor';
import { MontantInterceptor } from './common/finances/montant.interceptor';
import { HealthController } from './common/health.controller';
import { AuthModule } from './modules/socle/auth/auth.module';
import { ReferentielModule } from './modules/socle/referentiel/referentiel.module';
import { ParametresModule } from './modules/socle/parametres/parametres.module';
import { PlanificationModule } from './modules/presence/planification/planification.module';
import { ControleModule } from './modules/presence/controle/controle.module';
import { PresencePreuvesModule } from './modules/presence/presence-preuves/presence-preuves.module';
import { JustificatifsModule } from './modules/presence/justificatifs/justificatifs.module';
import { TirageModule } from './modules/presence/tirage/tirage.module';
import { InscriptionModule } from './modules/scolarite/inscription/inscription.module';
import { ScolariteModule } from './modules/scolarite/scolarite/scolarite.module';
import { ExamensModule } from './modules/scolarite/examens/examens.module';
import { FormationsModule } from './modules/scolarite/formations/formations.module';
import { StagesModule } from './modules/scolarite/stages/stages.module';
import { PortailModule } from './modules/scolarite/portail/portail.module';
import { AttestationsModule } from './modules/documents/attestations/attestations.module';
import { DocumentsDemandeModule } from './modules/documents/documents-demande/documents-demande.module';
import { CarteEtudianteModule } from './modules/documents/carte-etudiante/carte-etudiante.module';
import { BadgesModule } from './modules/documents/badges/badges.module';
import { CourrierModule } from './modules/documents/courrier/courrier.module';
import { PaieModule } from './modules/finances/paie/paie.module';
import { RecettesModule } from './modules/finances/recettes/recettes.module';
import { CitesModule } from './modules/campus/cites/cites.module';
import { RestoModule } from './modules/campus/resto/resto.module';
import { ReservationsModule } from './modules/campus/reservations/reservations.module';
import { HelpdeskModule } from './modules/campus/helpdesk/helpdesk.module';
import { PatrimoineModule } from './modules/campus/patrimoine/patrimoine.module';
import { ElectionsModule } from './modules/campus/elections/elections.module';
import { BibliothequeModule } from './modules/campus/bibliotheque/bibliotheque.module';
import { VodModule } from './modules/campus/vod/vod.module';
import { ReclamationsModule } from './modules/campus/reclamations/reclamations.module';
import { RapportsModule } from './modules/pilotage/rapports/rapports.module';
import { RectoratModule } from './modules/pilotage/rectorat/rectorat.module';
import { ImportsModule } from './modules/pilotage/imports/imports.module';
import { ServicesActifsGuard } from './modules/socle/parametres/services-actifs.guard';

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
      resolvers: [new HeaderResolver(['x-lang']), new AcceptLanguageResolver(), new QueryResolver(['lang', 'l'])],
    }),
    PrismaModule,
    // socle : authentification, données de référence et paramètres
    AuthModule,
    ReferentielModule,
    ParametresModule,
    // presence : planification, contrôle et preuves de passage en salle
    PlanificationModule,
    ControleModule,
    PresencePreuvesModule,
    JustificatifsModule,
    TirageModule,
    // scolarite : étudiants, notes et vie de l'étudiant
    InscriptionModule,
    ScolariteModule,
    ExamensModule,
    FormationsModule,
    StagesModule,
    PortailModule,
    // documents : attestations, demandes, carte, badges et courrier
    AttestationsModule,
    DocumentsDemandeModule,
    CarteEtudianteModule,
    BadgesModule,
    CourrierModule,
    // finances : paie et recettes
    PaieModule,
    RecettesModule,
    // campus : logement, restauration, services et équipements
    CitesModule,
    RestoModule,
    ReservationsModule,
    HelpdeskModule,
    PatrimoineModule,
    ElectionsModule,
    BibliothequeModule,
    VodModule,
    ReclamationsModule,
    // pilotage : rapports, rectorat et imports
    RapportsModule,
    RectoratModule,
    ImportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: SensitiveDataInterceptor },
    // Déclaré APRÈS le précédent : les intercepteurs globaux s'exécutent dans
    // l'ordre sur la requête et dans l'ordre inverse sur la réponse. Le
    // convertisseur de montants passe donc avant le filtre de secrets, et
    // aucun `Prisma.Decimal` n'atteint la sérialisation.
    { provide: APP_INTERCEPTOR, useClass: MontantInterceptor },
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
