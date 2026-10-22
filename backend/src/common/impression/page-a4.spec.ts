import { chargerEtablissement, pageA4, PALETTE_IMPRESSION } from './index';

describe('gabarit commun des documents A4', () => {
  const base = { titre: 'Relevé', corps: '<p>corps</p>', lang: 'fr', etablissement: 'Université' };

  it('produit un document complet au format A4 portrait', () => {
    const html = pageA4(base);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('@page { size: A4; margin: 10mm; }');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<p>corps</p>');
    expect(html).toContain('window.print()');
    expect(html.trim().endsWith('</body></html>')).toBe(true);
  });

  it('échappe le titre, dans l’onglet comme dans l’en-tête par défaut', () => {
    const html = pageA4({ ...base, titre: '<script>alert(1)</script> & co' });
    expect(html).toContain('<title>&lt;script&gt;alert(1)&lt;/script&gt; &amp; co</title>');
    expect(html).toContain('<div class="titre">&lt;script&gt;alert(1)&lt;/script&gt; &amp; co</div>');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('échappe le nom de l’établissement, une seule fois', () => {
    const html = pageA4({ ...base, etablissement: { nom: 'École "A" & <B>' } as any });
    expect(html).toContain('<div class="etab">École &quot;A&quot; &amp; &lt;B&gt;</div>');
    expect(html).not.toContain('&amp;amp;');
  });

  it('pose la langue demandée et refuse une valeur hors format', () => {
    expect(pageA4({ ...base, lang: 'en' })).toContain('<html lang="en">');
    expect(pageA4({ ...base, lang: 'fr' })).toContain('<html lang="fr">');
    expect(pageA4({ ...base, lang: '"><script>' })).toContain('<html lang="fr">');
  });

  it('insère l’en-tête, le corps et le pied fournis sans les ré-échapper', () => {
    const html = pageA4({
      ...base,
      entete: '<div class="etab">X &amp; Y</div>',
      piedDePage: '<span>pied</span>',
    });
    expect(html).toContain('<header>\n    <div class="etab">X &amp; Y</div>');
    expect(html).toContain('<footer><span>pied</span></footer>');
  });

  it('sait se passer d’en-tête, de pied et d’impression automatique', () => {
    const html = pageA4({ ...base, entete: null, impressionAuto: false });
    expect(html).not.toContain('<header>');
    expect(html).not.toContain('<footer>');
    expect(html).not.toContain('<script>');
  });

  it('gère le paysage, la marge et les styles propres au document', () => {
    const html = pageA4({ ...base, orientation: 'paysage', marge: '8mm', styles: '.x { color: red; }' });
    expect(html).toContain('@page { size: A4 landscape; margin: 8mm; }');
    expect(html.indexOf('.x { color: red; }')).toBeGreaterThan(html.indexOf('@page'));
  });

  it('applique la seule palette de DESIGN.md', () => {
    const html = pageA4(base).toLowerCase();
    expect(html).toContain(PALETTE_IMPRESSION.encre.toLowerCase());
    expect(html).not.toContain('#1565c0');
    expect(html).not.toContain('#10251e');
  });
});

describe('chargerEtablissement', () => {
  it('lit toutes les clés en une requête et complète par défaut', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { cle: 'NOM_ETABLISSEMENT', valeur: 'Université Gamal' },
      { cle: 'ADRESSE_ETABLISSEMENT', valeur: 'Dixinn, Conakry' },
    ]);
    const etab = await chargerEtablissement({ parametre: { findMany } });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(etab).toMatchObject({ nom: 'Université Gamal', adresse: 'Dixinn, Conakry', logo: null });
  });

  it('retombe sur le nom du catalogue si la table est absente ou illisible', async () => {
    expect((await chargerEtablissement({})).nom).toBe('Université de Conakry');
    const findMany = jest.fn().mockRejectedValue(new Error('panne'));
    expect((await chargerEtablissement({ parametre: { findMany } })).nom).toBe('Université de Conakry');
  });
});
