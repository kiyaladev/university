<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 620px; max-width: 96vw">
      <q-card-section class="text-h6">{{ $t('helpdesk.actions.declareIncident') }}</q-card-section>

      <q-card-section>
        <span class="section-titre">{{ $t('helpdesk.ticketForm.equipmentSection') }}</span>
        <div v-if="equipementRetenu" class="row items-center q-gutter-sm q-mb-md">
          <q-chip color="primary" text-color="white" :icon="ICONE_CATEGORIE[form.categorie] ?? 'qr_code_2'">
            {{ equipementRetenu.libelle }}
          </q-chip>
          <span class="text-caption text-grey-7">{{ equipementRetenu.emplacement ?? '—' }}</span>
          <q-btn flat dense round size="sm" icon="close" :aria-label="$t('helpdesk.ticketForm.unlinkEquipment')" @click="form.equipementId = null">
            <q-tooltip>{{ $t('helpdesk.ticketForm.unlinkEquipment') }}</q-tooltip>
          </q-btn>
        </div>
        <q-select
          v-else
          v-model="form.equipementId"
          :options="optionsEquipements"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('helpdesk.ticketForm.equipmentOptional')"
          :hint="$t('helpdesk.ticketForm.qrPrefillHint')"
        />

        <span class="section-titre">{{ $t('helpdesk.ticketForm.category') }}</span>
        <div class="row q-col-gutter-sm">
          <div
            v-for="c in CATEGORIES"
            :key="c.value"
            class="col-6 col-sm-3"
          >
            <q-btn
              flat
              no-caps
              class="tuile-cat full-width"
              :class="{ 'tuile-cat--active': form.categorie === c.value }"
              @click="form.categorie = form.categorie === c.value ? '' : c.value"
            >
              <div class="column items-center">
                <q-icon :name="c.icone" size="26px" />
                <span class="q-mt-xs text-center">{{ c.label }}</span>
              </div>
            </q-btn>
          </div>
        </div>

        <span class="section-titre">{{ $t('helpdesk.ticketForm.description') }}</span>
        <q-input
          v-model="form.description"
          outlined
          dense
          type="textarea"
          rows="3"
          counter
          :min-length="5"
          :max-length="500"
          :rules="[
            (v) => (v ?? '').trim().length >= 5 || $t('helpdesk.ticketForm.minLength'),
            (v) => (v ?? '').trim().length <= 500 || $t('helpdesk.ticketForm.maxLength'),
          ]"
          :label="$t('helpdesk.ticketForm.descriptionLabel')"
          :placeholder="$t('helpdesk.ticketForm.descriptionPlaceholder')"
          class="q-mb-md"
        />

        <span class="section-titre">{{ $t('common.fields.priority') }}</span>
        <q-select
          v-model="form.priorite"
          :options="optionsPriorites"
          outlined
          dense
          emit-value
          map-options
          :label="$t('common.fields.priority')"
          :hint="$t('helpdesk.ticketForm.priorityHint')"
          class="q-mb-md"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          icon="send"
          :label="$t('common.actions.send')"
          :loading="enregistrement"
          :disable="!form.categorie || form.description.trim().length < 5 || form.description.trim().length > 500"
          @click="envoyer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { LIBELLE_CATEGORIE_INCIDENT } from '../utils/libelles';
import type { CategorieIncident, EquipementCampus, TicketSupport } from '../types';

/**
 * Formulaire express de déclaration : catégorie en une tuile, description, et
 * le ticket part à la DSI. Pré-rempli quand la page arrive par le QR scanné
 * (l'équipement traversé par la prop `equipement` est retenu par défaut).
 */
const props = defineProps<{
  modelValue: boolean;
  /** Équipement résolu depuis le QR scanné (?equipement= dans l'URL). */
  equipement?: EquipementCampus | null;
  /** Inventaire proposé au sélecteur (facultatif). */
  equipements?: EquipementCampus[];
  /** Catégorie pré-sélectionnée (depuis les tuiles express). */
  categorieInitiale?: CategorieIncident | '';
}>();
const emit = defineEmits<{
  'update:modelValue': [boolean];
  declare: [TicketSupport];
}>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);

const ICONE_CATEGORIE: Record<CategorieIncident, string> = {
  VIDEO: 'videocam',
  SON: 'volume_up',
  RESEAU: 'wifi',
  ELECTRICITE: 'bolt',
  MOBILIER: 'chair',
  INFORMATIQUE: 'computer',
  CLIMATISATION: 'ac_unit',
  AUTRE: 'build',
};

const CATEGORIES = computed(() => (
  Object.keys(LIBELLE_CATEGORIE_INCIDENT) as CategorieIncident[]
).map((value) => ({
  value,
  label: LIBELLE_CATEGORIE_INCIDENT[value],
  icone: ICONE_CATEGORIE[value],
})));

const optionsPriorites = computed(() => [
  { label: t('helpdesk.ticketForm.priorities.low'), value: 'BASSE' },
  { label: t('helpdesk.ticketForm.priorities.normal'), value: 'NORMALE' },
  { label: t('helpdesk.ticketForm.priorities.high'), value: 'HAUTE' },
]);

const form = ref({
  equipementId: null as string | null,
  categorie: '' as CategorieIncident | '',
  description: '',
  priorite: 'NORMALE',
});

const optionsEquipements = computed(() =>
  (props.equipements ?? [])
    .filter((e) => e.actif || e.id === form.value.equipementId)
    .map((e) => ({
      label: e.emplacement ? `${e.libelle} — ${e.emplacement}` : e.libelle,
      value: e.id,
    })),
);

const equipementRetenu = computed(
  () =>
    props.equipements?.find((e) => e.id === form.value.equipementId) ??
    (props.equipement?.id === form.value.equipementId ? props.equipement : null) ??
    null,
);

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    form.value = {
      equipementId: props.equipement?.id ?? null,
      categorie: (props.categorieInitiale ?? '') as CategorieIncident | '',
      description: '',
      priorite: 'NORMALE',
    };
  },
);

async function envoyer() {
  const len = form.value.description.trim().length;
  if (!form.value.categorie || len < 5 || len > 500) return;
  enregistrement.value = true;
  try {
    const { data } = await api.post('/tickets', {
      equipementId: form.value.equipementId || undefined,
      categorie: form.value.categorie,
      description: form.value.description.trim(),
      priorite: form.value.priorite,
    });
    $q.notify({ type: 'positive', message: t('helpdesk.ticketForm.opened', { number: data.numero }) });
    emit('declare', data);
    emit('update:modelValue', false);
  } catch {
    /* le boot axios affiche déjà le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.tuile-cat {
  border: var(--up-filet);
  padding: 10px 6px;
  min-height: 78px;
  background: var(--up-craie);
  color: var(--up-encre);
  font-size: 11px;
  letter-spacing: -0.01em;
  line-height: 1.25;

  &--active {
    background: #{$vert-action};
    color: #fff;
    border-color: #{$vert-action};
  }
}
</style>
