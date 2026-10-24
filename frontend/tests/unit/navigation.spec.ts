import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import routes from '../../src/router/routes';
import { MANIFESTE } from '../../src/navigation/manifeste';
import { verifierManifeste } from '../../src/navigation/menu';

/**
 * Le manifeste de navigation et le routeur doivent se répondre : une entrée
 * sans route porte un lien mort, une route dont les droits diffèrent du
 * manifeste ouvre un écran que l'API refuse (403) ou en cache un qu'elle
 * autorise. Le contrôle tourne au démarrage en développement ; ici il est
 * vérifié à chaque exécution de la suite.
 */
const router = createRouter({ history: createMemoryHistory(), routes });

const memePoubelle = (a: readonly string[] = [], b: readonly string[] = []) =>
  a.length === b.length && a.every((x) => b.includes(x));

describe('manifeste de navigation', () => {
  it('le manifeste et les routes se répondent', () => {
    expect(() => verifierManifeste(router)).not.toThrow();
  });

  it('chaque écran du manifeste a une route qui porte son titre et ses rôles', () => {
    for (const e of MANIFESTE) {
      if (e.redirection) continue;
      const resolue = router.resolve(e.path);
      expect(resolue.matched.length, e.path).toBeGreaterThan(0);
      expect(resolue.meta.titre, e.path).toBe(e.titre);
      expect(memePoubelle(resolue.meta.roles, e.roles), e.path).toBe(true);
    }
  });

  it('chaque entrée qui redirige mène à l’écran annoncé', () => {
    for (const e of MANIFESTE) {
      if (!e.redirection) continue;
      const resolue = router.resolve(e.path);
      const feuille = resolue.matched[resolue.matched.length - 1];
      expect(feuille.redirect, e.path).toBe(e.redirection);
      const cible = router.resolve(e.redirection);
      expect(memePoubelle(cible.meta.roles, e.roles), e.path).toBe(true);
    }
  });

  it('les rôles d’un écran de détail sont ceux de son écran d’origine', () => {
    for (const chemin of ['/plagiat/:id', '/vod/lecteur/:id']) {
      const detail = MANIFESTE.find((e) => e.path === chemin);
      expect(detail, chemin).toBeDefined();
      const parent = MANIFESTE.find((e) => e.path === detail!.famille);
      expect(parent, `${chemin} → ${detail!.famille}`).toBeDefined();
      expect(memePoubelle(parent!.roles, detail!.roles), chemin).toBe(true);
    }
  });

  it('le lecteur VOD et le catalogue VOD admettent les mêmes rôles', () => {
    const catalogue = MANIFESTE.find((e) => e.path === '/vod');
    const lecteur = MANIFESTE.find((e) => e.path === '/vod/lecteur/:id');
    expect(catalogue).toBeDefined();
    expect(lecteur).toBeDefined();
    expect(memePoubelle(catalogue!.roles, lecteur!.roles)).toBe(true);
  });
});
