import { Module } from '@nestjs/common';
import { ReclamationsController } from './reclamations.controller';
import { ReclamationsService } from './reclamations.service';

/**
 * Plateforme de réclamations : un guichet unique où convergent les doléances
 * étudiantes — note manquante, erreur de saisie, scolarité, enseignement,
 * technique. Le canal peut être identifié (l'étudiant a un compte) ou
 * parfaitement anonyme (nom + email conservés à part, jamais reliés).
 *
 * Chaque réclamation suit un cycle : OUVERTE → EN_COURS → EN_ATTENTE_REPONSE
 * → RESOLUE / FERMEE / REJETEE. Une note de clôture consigne la décision finale.
 * Un délai d'escalade (par défaut 48 h) peut être dépassé sans intervention :
 * la direction force alors l'escalade et trace l'événement.
 */
@Module({
  controllers: [ReclamationsController],
  providers: [ReclamationsService],
})
export class ReclamationsModule {}