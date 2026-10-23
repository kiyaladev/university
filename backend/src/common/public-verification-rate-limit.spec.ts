import { AttestationsController } from '../modules/documents/attestations/attestations.controller';
import { BadgesController } from '../modules/documents/badges/badges.controller';
import { CarteEtudianteController } from '../modules/documents/carte-etudiante/carte-etudiante.controller';
import { EquipementsController } from '../modules/campus/helpdesk/helpdesk.controller';
import { RestoController } from '../modules/campus/resto/resto.controller';
import { PatrimoineController } from '../modules/campus/patrimoine/patrimoine.controller';
import { BibliothequeController } from '../modules/campus/bibliotheque/bibliotheque.controller';
import { IS_PUBLIC_KEY } from './decorators';

describe('Protection des vérifications QR publiques', () => {
  it.each([
    ['attestations', AttestationsController],
    ['badges', BadgesController],
    ['cartes étudiantes', CarteEtudianteController],
  ])('rend la vérification %s publique avec une limite de 30/minute', (_nom, controller) => {
    const handler = controller.prototype.verifier;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata('THROTTLER:LIMITcourant', handler)).toBe(30);
    expect(Reflect.getMetadata('THROTTLER:TTLcourant', handler)).toBe(60_000);
  });

  it.each([
    ['lecture de carte restaurant', 'carte'],
    ['validation de repas restaurant', 'valider'],
  ])('limite à 60/minute la route publique %s protégée par jeton manuel', (_nom, methode) => {
    const handler = RestoController.prototype[methode];

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata('THROTTLER:LIMITcourant', handler)).toBe(60);
    expect(Reflect.getMetadata('THROTTLER:TTLcourant', handler)).toBe(60_000);
  });

  it('limite la résolution QR Helpdesk à 30/minute et la déclare publique', () => {
    const handler = EquipementsController.prototype.parCode;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata('THROTTLER:LIMITcourant', handler)).toBe(30);
    expect(Reflect.getMetadata('THROTTLER:TTLcourant', handler)).toBe(60_000);
  });

  it('limite la résolution QR patrimoine à 30/minute et la déclare publique', () => {
    const handler = PatrimoineController.prototype.parQr;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata('THROTTLER:LIMITcourant', handler)).toBe(30);
    expect(Reflect.getMetadata('THROTTLER:TTLcourant', handler)).toBe(60_000);
  });

  it('limite la recherche plein texte publique de la bibliothèque à 30/minute', () => {
    const handler = BibliothequeController.prototype.rechercheFts;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata('THROTTLER:LIMITcourant', handler)).toBe(30);
    expect(Reflect.getMetadata('THROTTLER:TTLcourant', handler)).toBe(60_000);
  });
});
