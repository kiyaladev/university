import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard, LectureSeuleGuard, RolesGuard } from './common/guards';
import { DebitGuard } from './common/debit.guard';
import { Public } from './common/decorators';
import { AuthModule } from './modules/auth/auth.module';
import { ReferentielModule } from './modules/referentiel/referentiel.module';
import { PlanificationModule } from './modules/planification/planification.module';
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

@ApiTags('Santé')
@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'university-api', date: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Attention : toute définition nommée s'applique à TOUTES les routes. Un
    // strict 10/quart d'heure déclaré ici pour la connexion briderait
    // l'application entière — c'est arrivé. « connexion » est donc neutre par
    // défaut et ne prend sa valeur stricte que sur /auth/login, via @Throttle.
    ThrottlerModule.forRoot([
      { name: 'courant', ttl: 60_000, limit: 1200 },
      { name: 'connexion', ttl: 900_000, limit: 100_000 },
    ]),
    PrismaModule,
    AuthModule,
    ReferentielModule,
    PlanificationModule,
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
    // Le débit se juge avant l'identité : une requête refusée pour excès n'a
    // pas à coûter une lecture en base.
    { provide: APP_GUARD, useClass: DebitGuard },
    // Toutes les routes sont protégées par défaut : @Public() ouvre l'exception,
    // @Roles() restreint plus finement, et l'enseignant reste en lecture seule.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: LectureSeuleGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
