import 'reflect-metadata';
import { DOCUMENT_ACCESS_KEY, IS_PUBLIC_KEY, ROLES_KEY } from './decorators';

import { AttestationsController } from '../modules/documents/attestations/attestations.controller';
import { BadgesController } from '../modules/documents/badges/badges.controller';
import { CarteEtudianteController } from '../modules/documents/carte-etudiante/carte-etudiante.controller';
import { CourrierController } from '../modules/documents/courrier/courrier.controller';
import { DocumentsDemandeController } from '../modules/documents/documents-demande/documents-demande.controller';
import { ElectionsController } from '../modules/campus/elections/elections.controller';
import { ExportController } from '../modules/pilotage/rapports/export.controller';
import { FormationsController } from '../modules/scolarite/formations/formations.controller';
import { EquipementsController } from '../modules/campus/helpdesk/helpdesk.controller';
import { ImpressionController } from '../modules/pilotage/rapports/impression.controller';
import { InscriptionsController } from '../modules/scolarite/inscription/inscription.controller';
import { PaieController } from '../modules/finances/paie/paie.controller';
import { PatrimoineController } from '../modules/campus/patrimoine/patrimoine.controller';
import { RectoratController } from '../modules/pilotage/rectorat/rectorat.controller';
import { DeliberationsController } from '../modules/scolarite/scolarite/scolarite.controller';
import { TirageController } from '../modules/presence/tirage/tirage.controller';
import { TravauxEncadresController } from '../modules/scolarite/stages/stages.controller';

/**
 * Ces routes vérifiaient le jeton d'impression à la main, en plus de la garde
 * globale. La vérification a été retirée : elle était inatteignable, la garde
 * `@ProtectedDocument` rejetant déjà la requête avant le handler.
 *
 * Ce test verrouille que le contrôle n'a pas disparu avec elle : chaque route
 * reste non publique et passe par la garde qui authentifie le jeton.
 */
const ROUTES_IMPRESSION: Array<{ nom: string; controleur: any; methode: string }> = [
  { nom: 'attestations/:id/imprimer', controleur: AttestationsController, methode: 'imprimer' },
  { nom: 'badges/:id/imprimer', controleur: BadgesController, methode: 'imprimer' },
  { nom: 'carte-etudiante/:id/imprimer', controleur: CarteEtudianteController, methode: 'imprimer' },
  { nom: 'courrier/:id/imprimer', controleur: CourrierController, methode: 'imprimer' },
  { nom: 'documents-demande/:id/imprimer', controleur: DocumentsDemandeController, methode: 'imprimer' },
  { nom: 'elections/:id/imprimer-bulletin', controleur: ElectionsController, methode: 'imprimerBulletin' },
  { nom: 'export/presence-enseignants', controleur: ExportController, methode: 'presence' },
  { nom: 'export/volume-horaire', controleur: ExportController, methode: 'volume' },
  { nom: 'export/etat-paiement', controleur: ExportController, methode: 'paiement' },
  { nom: 'export/registre', controleur: ExportController, methode: 'registre' },
  { nom: 'formations/:id/certificat', controleur: FormationsController, methode: 'certificat' },
  { nom: 'helpdesk/equipements/:id/imprimer', controleur: EquipementsController, methode: 'imprimerQr' },
  { nom: 'impression/registre', controleur: ImpressionController, methode: 'registre' },
  { nom: 'impression/fiche-enseignant/:id', controleur: ImpressionController, methode: 'fiche' },
  { nom: 'impression/etat-paiement', controleur: ImpressionController, methode: 'paiement' },
  { nom: 'impression/qr-salles', controleur: ImpressionController, methode: 'qr' },
  { nom: 'inscriptions/:id/attestation-inscription', controleur: InscriptionsController, methode: 'attestation' },
  { nom: 'paie/:id/imprimer', controleur: PaieController, methode: 'imprimer' },
  { nom: 'patrimoine/equipements/:id/imprimer', controleur: PatrimoineController, methode: 'imprimerEtiquette' },
  { nom: 'rectorat/:id/imprimer-bilan', controleur: RectoratController, methode: 'imprimer' },
  { nom: 'scolarite/deliberations/:id/imprimer', controleur: DeliberationsController, methode: 'imprimer' },
  { nom: 'scolarite/deliberations/:id/releve', controleur: DeliberationsController, methode: 'releve' },
  { nom: 'tirage/:id/imprimer-bordereau', controleur: TirageController, methode: 'imprimerBordereau' },
  { nom: 'travaux-encadres/:id/imprimer', controleur: TravauxEncadresController, methode: 'imprimer' },
];

describe('protection des routes d’impression', () => {
  it.each(ROUTES_IMPRESSION)('$nom reste protégée par la garde globale', (route) => {
    const { controleur, methode } = route;
    const handler = controleur.prototype[methode];
    expect(handler).toBeDefined();
    // La route n'est pas publique…
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(false);
    // …et la garde globale est bien celle qui authentifie le jeton.
    expect(Reflect.getMetadata(DOCUMENT_ACCESS_KEY, handler)).toBe(true);
  });

  it.each(ROUTES_IMPRESSION)('$nom reste restreinte à des rôles', (route) => {
    const { controleur, methode } = route;
    const handler = controleur.prototype[methode];
    const roles = Reflect.getMetadata(ROLES_KEY, handler);
    expect(Array.isArray(roles)).toBe(true);
    expect(roles.length).toBeGreaterThan(0);
  });
});
