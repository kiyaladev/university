import { I18nContext } from 'nestjs-i18n';
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
