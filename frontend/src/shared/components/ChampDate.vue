<template>
  <div class="champ-date" @click="surClic">
    <q-input
      :model-value="affichage"
      :label="label"
      outlined
      :dense="dense"
      readonly
      class="champ-date__champ"
      :disable="disable"
      @focus="surFocus"
    >
      <template #prepend>
        <!-- L'icône est un vrai bouton : elle s'atteint au clavier
             (Entrée ou Espace) et son rôle est annoncé au lecteur d'écran. -->
        <button
          type="button"
          class="champ-date__icone"
          :disabled="disable"
          :aria-label="$t('common.champDate.calendar')"
          :aria-expanded="ouvert"
          aria-haspopup="dialog"
          @click.stop="ouvrir"
          @keydown.enter.space.prevent="ouvrir"
        >
          <q-icon name="event" />
        </button>
      </template>
      <q-popup-proxy v-model="ouvert" cover transition-show="scale" transition-hide="scale" @escape-key="fermer">
        <q-date
          :model-value="modelValue"
          mask="YYYY-MM-DD"
          minimal
          today-btn
          :disable="disable"
          @update:model-value="choisir"
        />
      </q-popup-proxy>
    </q-input>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * Champ de date en français. Le `type="date"` natif suit la langue du système
 * et affiche 07/14/2026 sur un appareil anglophone : dans un produit qui ne
 * parle que français, la date se saisit ici au calendrier, en JJ/MM/AAAA.
 *
 * Le champ est en lecture seule : le calendrier est le seul moyen de le
 * renseigner. Il s'ouvre donc au clic sur le champ comme sur son icône, et au
 * focus (navigation au clavier) — l'icône seule, trop petite pour le doigt,
 * ne suffisait pas.
 */
const props = withDefaults(defineProps<{ modelValue: string; label?: string; dense?: boolean; disable?: boolean }>(), {
  label: '',
  dense: true,
  disable: false,
});
const emit = defineEmits<{ 'update:modelValue': [string] }>();
const { t: $t } = useI18n();

const ouvert = ref(false);

/**
 * Après un choix, le focus revient sur le champ : ce focus ne doit pas
 * rouvrir le calendrier. Le drapeau est levé après un court délai, pour que
 * le champ redevienne normalement sensible au focus.
 */
let fermeParChoix = false;
let minuteurFermeture: ReturnType<typeof setTimeout> | null = null;

const affichage = computed(() => {
  if (!props.modelValue) return '';
  const [a, m, j] = props.modelValue.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
});

function choisir(valeur: string | null) {
  if (valeur) emit('update:modelValue', valeur);
  fermeParChoix = true;
  fermer();
  if (minuteurFermeture) clearTimeout(minuteurFermeture);
  minuteurFermeture = setTimeout(() => {
    fermeParChoix = false;
    minuteurFermeture = null;
  }, 500);
}

function ouvrir() {
  if (props.disable) return;
  ouvert.value = true;
}

function fermer() {
  ouvert.value = false;
}

/** Un clic sur le champ — ou sur son icône — ouvre le calendrier. */
function surClic() {
  ouvrir();
}

/** Le focus sur le champ ouvre le calendrier, sauf s'il vient d'un choix. */
function surFocus() {
  if (fermeParChoix) {
    fermeParChoix = false;
    return;
  }
  ouvrir();
}

onBeforeUnmount(() => {
  if (minuteurFermeture) clearTimeout(minuteurFermeture);
});
</script>

<style scoped lang="scss">
// Cible tactile : le contrôleur et la scolarité travaillent au doigt.
.champ-date :deep(.q-field__control) {
  min-height: 48px;
  cursor: pointer;
}
.champ-date :deep(.q-field__native) {
  cursor: pointer;
}

// Le champ est en lecture seule pour forcer le calendrier, mais il s'actionne :
// il garde donc le filet plein du panneau, pas le pointillé des champs inertes.
.champ-date :deep(.q-field__control::before) {
  border-style: solid !important;
}

// L'icône devient un bouton : elle doit garder l'apparence d'une icône, mais
// s'annoncer comme un bouton et se garder visible au clavier.
.champ-date__icone {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  color: inherit;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}
</style>
