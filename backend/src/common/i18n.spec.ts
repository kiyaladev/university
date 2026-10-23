import { I18nContext } from 'nestjs-i18n';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { t } from './i18n';

describe('traduction hors et dans le contexte de requête', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("interpole les variables quand aucun contexte n'est disponible", () => {
    // Cron, boot ou test : le repli lit le catalogue français du disque.
    expect(t('common.crud.itemNotFound', { label: 'Salle' })).toContain('Salle');
  });

  it('interpole les variables via le contexte i18n', () => {
    // nestjs-i18n attend `{ args: {...} }` ; passer les variables à plat laisse
    // « {champ} » littéral dans la réponse. Un faux contexte suffit à le voir.
    const ctx = { t: jest.fn().mockReturnValue('texte traduit') };
    jest.spyOn(I18nContext, 'current').mockReturnValue(ctx as any);

    t('common.crud.sortInconnu', { champ: 'bogus', autorises: 'nom' });

    expect(ctx.t).toHaveBeenCalledWith('common.crud.sortInconnu', {
      args: { champ: 'bogus', autorises: 'nom' },
    });
  });

  it("n'embarque pas d'objet args vide quand il n'y a rien à interpoler", () => {
    const ctx = { t: jest.fn().mockReturnValue('texte') };
    jest.spyOn(I18nContext, 'current').mockReturnValue(ctx as any);

    t('common.notFoundRecord');

    expect(ctx.t).toHaveBeenCalledWith('common.notFoundRecord', undefined);
  });

  it('renvoie la clé quand le message est inconnu', () => {
    expect(t('namespace.inexistant')).toBe('namespace.inexistant');
  });
});

/**
 * Les deux langues doivent se répondre clé par clé : une clé présente en
 * français et absente en anglais laisse l'utilisateur anglophone devant un
 * identifiant technique (`stages.ce_travail_n_a_pas_d_encadrant`).
 */
describe('catalogues i18n — parité fr/en', () => {
  const dossier = (langue: string) => path.join(__dirname, '..', 'i18n', langue);

  /** Aplatit un catalogue : `a.b` pour `{ "a": { "b": "…" } }`. */
  const aplatir = (objet: Record<string, unknown>, prefixe = ''): Array<[string, unknown]> =>
    Object.entries(objet).flatMap(([cle, valeur]) => {
      const chemin = prefixe ? `${prefixe}.${cle}` : cle;
      if (valeur && typeof valeur === 'object' && !Array.isArray(valeur)) {
        return aplatir(valeur as Record<string, unknown>, chemin);
      }
      return [[chemin, valeur]] as Array<[string, unknown]>;
    });

  /** Fichiers d'une langue, avec leurs clés pointées. */
  const catalogues = (langue: string): Map<string, [string, unknown]> => {
    const cles = new Map<string, [string, unknown]>();
    for (const fichier of fs.readdirSync(dossier(langue)).filter((nom) => nom.endsWith('.json'))) {
      const brut = JSON.parse(fs.readFileSync(path.join(dossier(langue), fichier), 'utf8')) as Record<string, unknown>;
      for (const [cle, valeur] of aplatir(brut)) {
        cles.set(`${fichier.replace(/\.json$/, '')}.${cle}`, [fichier, valeur]);
      }
    }
    return cles;
  };

  it('les deux langues ont exactement les mêmes clés', () => {
    const fr = catalogues('fr');
    const en = catalogues('en');

    const absentesEn = [...fr.keys()].filter((cle) => !en.has(cle));
    const absentesFr = [...en.keys()].filter((cle) => !fr.has(cle));

    expect(absentesEn).toEqual([]);
    expect(absentesFr).toEqual([]);
  });

  it('aucune clé ne pointe une valeur vide', () => {
    for (const langue of ['fr', 'en']) {
      for (const [cle, [fichier, valeur]] of catalogues(langue)) {
        expect({ langue, fichier, cle, valeur }).toEqual(
          expect.objectContaining({ valeur: expect.any(String) }),
        );
        expect(String(valeur).trim()).not.toBe('');
      }
    }
  });
});
