/** Export CSV des états — reprise des mêmes données que les écrans de rapports,
 *  au format attendu par Excel francophone (séparateur `;`, UTF-8 avec BOM). */
import { Injectable } from '@nestjs/common';
import { RapportsService } from './rapports.service';
import { RapportQueryDto } from './rapports.dto';

const SEPARATEUR = ';';
const BOM = '﻿';

export function cellule(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return '';
  const texte = String(valeur);
  // Les décimales sont écrites à la française pour rester numériques dans Excel.
  let normalise = typeof valeur === 'number' ? texte.replace('.', ',') : texte;

  // Neutralisation d'injection de formule. Un nom d'enseignant ou un intitulé de
  // séance est saisi librement : `=HYPERLINK("http://…","x")` dans une cellule
  // s'exécute à l'ouverture dans Excel ou LibreOffice, dans le contexte de la
  // personne qui exporte. On préfixe d'une apostrophe, ce qu'Excel stocke comme
  // un caractère littéral et non comme une formule.
  if (/^[=+\-@\t\r]/.test(normalise)) normalise = `'${normalise}`;

  return /[";\n]/.test(normalise) ? `"${normalise.replace(/"/g, '""')}"` : normalise;
}

function versCsv(entetes: string[], lignes: unknown[][]): string {
  return BOM + [entetes, ...lignes].map((l) => l.map(cellule).join(SEPARATEUR)).join('\r\n') + '\r\n';
}

@Injectable()
export class ExportService {
  constructor(private rapports: RapportsService) {}

  async presenceEnseignants(query: RapportQueryDto) {
    const r = await this.rapports.presenceEnseignants(query);
    return versCsv(
      [
        'Matricule',
        'Enseignant',
        'Grade',
        'Statut',
        'Département',
        'Séances programmées',
        'Séances contrôlées',
        'Séances assurées',
        'Retards',
        'Absences',
        'Absences excusées',
        'Heures programmées',
        'Heures réalisées',
        'Taux de présence (%)',
        'Taux de contrôle (%)',
      ],
      r.lignes.map((l) => [
        l.matricule,
        l.nom,
        l.grade,
        l.statutEnseignant,
        l.departement,
        l.planifiees,
        l.controlees,
        l.assurees,
        l.retard,
        l.absent,
        l.excuse,
        l.heuresPrevues,
        l.heuresRealisees,
        l.tauxPresence,
        l.tauxControle,
      ]),
    );
  }

  async volumeHoraire(query: RapportQueryDto) {
    const r = await this.rapports.volumeHoraire(query);
    return versCsv(
      [
        'Enseignant',
        'Département',
        'Code matière',
        'Matière',
        'Promotion',
        'Volume contractuel (h)',
        'Heures réalisées (h)',
        'Reste à faire (h)',
        'Séances programmées',
        'Séances assurées',
        'Avancement contrat (%)',
      ],
      r.lignes.map((l) => [
        l.enseignant,
        l.departement,
        l.codeMatiere,
        l.matiere,
        l.promotion,
        l.volumeHorairePrevu,
        l.heuresRealisees,
        l.reste,
        l.planifiees,
        l.assurees,
        l.tauxContrat,
      ]),
    );
  }

  async etatPaiement(query: RapportQueryDto) {
    const r = await this.rapports.etatPaiement(query);
    const lignes: unknown[][] = r.lignes.map((l) => [
      l.matricule,
      l.nom,
      l.statutEnseignant,
      l.departement,
      l.seancesAssurees,
      l.heuresRealisees,
      l.tauxHoraire,
      l.montant,
    ]);
    lignes.push([]);
    lignes.push(['', 'TOTAL', '', '', '', r.totalHeures, '', r.totalMontant]);

    return versCsv(
      [
        'Matricule',
        'Enseignant',
        'Statut',
        'Département',
        'Séances assurées',
        'Heures réalisées',
        'Taux horaire',
        'Montant',
      ],
      lignes,
    );
  }

  async registre(query: RapportQueryDto, inclureObservations = false) {
    const r = await this.rapports.registre(query, false, inclureObservations);
    return versCsv(
      [
        'Date',
        'Horaire',
        'Matricule',
        'Enseignant',
        'Matière',
        'Promotion',
        'Salle',
        'Type',
        'Constat',
        'Heure arrivée',
        'Heure fin réelle',
        'Durée (min)',
        'Étudiants présents',
        'Thème déroulé',
        'Observation',
        'Vérification contrôleur',
        'Attestation enseignant',
        'Justificatif',
      ],
      r.lignes.map((l) => [
        l.date,
        l.horaire,
        l.matricule,
        l.enseignant,
        l.matiere,
        l.promotion,
        l.salle,
        l.type,
        l.statut,
        l.heureArrivee,
        l.heureFinReelle,
        l.dureeMinutes,
        l.effectifPresent,
        l.thematiqueTraitee,
        l.observation,
        l.methode,
        l.attestation,
        l.justificatif,
      ]),
    );
  }
}
