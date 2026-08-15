/** Chiffrement des gabarits d'empreinte au repos. */
import { chiffrer, dechiffrer, estChiffre, oublierCle } from './coffre';

const GABARIT = 'SIMU-ENS-001-RU5TLTAwMQ';

describe('coffre', () => {
  beforeEach(() => {
    process.env.BIOMETRIE_CHIFFREMENT_CLE = 'a'.repeat(64);
    oublierCle();
  });

  it('rend le gabarit d’origine après un aller-retour', () => {
    expect(dechiffrer(chiffrer(GABARIT))).toBe(GABARIT);
  });

  it('ne laisse pas le gabarit lisible dans la valeur stockée', () => {
    const stocke = chiffrer(GABARIT);
    expect(stocke).not.toContain(GABARIT);
    expect(stocke).not.toContain('SIMU');
    expect(estChiffre(stocke)).toBe(true);
  });

  it('produit un chiffré différent à chaque fois', () => {
    // Sinon deux enseignants au même gabarit seraient reconnaissables comme tels.
    expect(chiffrer(GABARIT)).not.toBe(chiffrer(GABARIT));
  });

  it('refuse un chiffré altéré au lieu de rendre n’importe quoi', () => {
    const stocke = chiffrer(GABARIT);
    const [v, iv, tag, corps] = stocke.split('.');
    const altere = [v, iv, tag, `${corps!.slice(0, -2)}AA`].join('.');
    expect(() => dechiffrer(altere)).toThrow();
  });

  it('ne déchiffre pas avec une autre clé', () => {
    const stocke = chiffrer(GABARIT);
    process.env.BIOMETRIE_CHIFFREMENT_CLE = 'b'.repeat(64);
    oublierCle();
    expect(() => dechiffrer(stocke)).toThrow();
  });

  it('tolère en lecture un gabarit historique resté en clair', () => {
    expect(estChiffre(GABARIT)).toBe(false);
    expect(dechiffrer(GABARIT)).toBe(GABARIT);
  });

  it('refuse de chiffrer sans clé plutôt que d’écrire en clair', () => {
    delete process.env.BIOMETRIE_CHIFFREMENT_CLE;
    oublierCle();
    expect(() => chiffrer(GABARIT)).toThrow(/BIOMETRIE_CHIFFREMENT_CLE/);
  });

  it('accepte une phrase secrète en dérivant une clé', () => {
    process.env.BIOMETRIE_CHIFFREMENT_CLE = 'une phrase choisie par l’établissement';
    oublierCle();
    expect(dechiffrer(chiffrer(GABARIT))).toBe(GABARIT);
  });
});
