// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { Quasar, QDate, QIcon, QInput, QPopupProxy } from 'quasar';
import { createI18n } from 'vue-i18n';
import ChampDate from '../../src/shared/components/ChampDate.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'fr-FR',
  messages: { 'fr-FR': { common: { champDate: { calendar: 'Ouvrir le calendrier' } } } },
});

function monter(props: Record<string, unknown> = {}) {
  return mount(ChampDate, {
    props: { modelValue: '', ...props },
    // Les composants Quasar sont enregistrés à la main : hors construction,
    // c'est l'outil de Quasar qui les importe dans le gabarit.
    global: { plugins: [Quasar, i18n], components: { QDate, QIcon, QInput, QPopupProxy } },
    attachTo: document.body,
  });
}

/** Le calendrier est-il ouvert ? (le popup est porté sur le corps de la page) */
function calendrierOuvert(): boolean {
  return Boolean(document.querySelector('.q-date'));
}

/** Laisse le popup s'ouvrir ou se fermer. */
async function stabiliser(): Promise<void> {
  await nextTick();
  await new Promise((resoudre) => setTimeout(resoudre, 0));
  await nextTick();
}

/** Une touche Échap, telle que le clavier la livre. */
function echap(): void {
  for (const type of ['keydown', 'keyup']) {
    const evenement = new KeyboardEvent(type, { key: 'Escape', bubbles: true });
    Object.defineProperty(evenement, 'keyCode', { value: 27 });
    window.dispatchEvent(evenement);
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('shared/components/ChampDate', () => {
  it('ouvre le calendrier au clic sur le champ', async () => {
    const wrapper = monter();
    expect(calendrierOuvert()).toBe(false);

    await wrapper.find('input').trigger('click');
    await stabiliser();

    expect(calendrierOuvert()).toBe(true);
  });

  it('ouvre le calendrier au clic sur l’icône', async () => {
    const wrapper = monter();

    await wrapper.find('.champ-date__icone').trigger('click');
    await stabiliser();

    expect(calendrierOuvert()).toBe(true);
  });

  it('ouvre le calendrier au focus du champ', async () => {
    const wrapper = monter();

    await wrapper.find('input').trigger('focusin');
    await stabiliser();

    expect(calendrierOuvert()).toBe(true);
  });

  it('active l’icône au clavier : Entrée et Espace', async () => {
    const wrapper = monter();
    const icone = wrapper.find('.champ-date__icone');

    await icone.trigger('keydown', { key: 'Enter' });
    await stabiliser();
    expect(calendrierOuvert()).toBe(true);

    // Le calendrier se referme, puis l'icône doit rouvrir seule.
    echap();
    await stabiliser();
    expect(calendrierOuvert()).toBe(false);

    await icone.trigger('keydown', { key: ' ' });
    await stabiliser();
    expect(calendrierOuvert()).toBe(true);
  });

  it('ferme le calendrier avec la touche Échap', async () => {
    const wrapper = monter();
    await wrapper.find('input').trigger('click');
    await stabiliser();
    expect(calendrierOuvert()).toBe(true);

    echap();
    await stabiliser();

    expect(calendrierOuvert()).toBe(false);
  });

  it('annonce l’icône comme un bouton et ne l’ouvre pas quand le champ est inactif', async () => {
    const wrapper = monter();
    const icone = wrapper.find('.champ-date__icone');

    expect(icone.attributes('type')).toBe('button');
    expect(icone.attributes('aria-label')).toBe('Ouvrir le calendrier');
    expect(icone.attributes('aria-haspopup')).toBe('dialog');

    const inactif = monter({ disable: true });
    await inactif.find('.champ-date__icone').trigger('click');
    await stabiliser();

    expect(calendrierOuvert()).toBe(false);
  });

  it('restitue la date choisie et referme le calendrier', async () => {
    const wrapper = monter();
    await wrapper.find('input').trigger('click');
    await stabiliser();

    wrapper.findComponent(QDate).vm.$emit('update:model-value', '2026-10-24');
    await stabiliser();

    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-10-24']]);
    expect(calendrierOuvert()).toBe(false);
  });

  it('affiche la date au format français', async () => {
    const wrapper = monter({ modelValue: '2026-10-24' });

    expect(wrapper.find('input').element.value).toBe('24/10/2026');
  });
});
