<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t('mesReclamations.actions.new')"
    :envoi="enregistrement"
    :libelle-valider="$t('common.actions.send')"
    icone-valider="send"
    :desactive="!valide"
    @valider="envoyer"
  >
    <span class="section-titre">{{ $t('reclamations.dialog.create.type') }}</span>
    <div class="row q-col-gutter-sm">
      <div
        v-for="t in TYPES"
        :key="t.value"
        class="col-6 col-sm-4"
      >
        <q-btn
          flat
          no-caps
          class="tuile-type full-width"
          :class="{ 'tuile-type--active': form.type === t.value }"
          @click="form.type = form.type === t.value ? '' : t.value"
        >
          <div class="column items-center">
            <q-icon :name="t.icone" size="24px" />
            <span class="q-mt-xs text-center">{{ t.label }}</span>
          </div>
        </q-btn>
      </div>
    </div>

    <span class="section-titre">{{ $t('reclamations.dialog.create.subject') }}</span>
    <q-input
      v-model="form.sujet"
      outlined
      dense
      counter
      :max-length="200"
      :rules="[(v) => (v ?? '').trim().length >= 3 || $t('reclamations.dialog.create.subjectMin')]"
      :label="$t('reclamations.dialog.create.subjectHint')"
      class="q-mb-md"
    />

    <span class="section-titre">{{ $t('common.fields.descriptionRequired') }}</span>
    <q-input
      v-model="form.description"
      outlined
      dense
      type="textarea"
      rows="4"
      counter
      :min-length="10"
      :max-length="4000"
      :rules="[
        (v) => (v ?? '').trim().length >= 10 || $t('reclamations.dialog.create.descriptionMin'),
        (v) => (v ?? '').trim().length <= 4000 || $t('reclamations.dialog.create.descriptionMax'),
      ]"
      :label="$t('reclamations.dialog.create.descriptionHint')"
      :placeholder="$t('reclamations.dialog.create.descriptionPlaceholder')"
      class="q-mb-md"
    />

    <span class="section-titre">{{ $t('common.fields.priority') }}</span>
    <q-select
      v-model="form.priorite"
      :options="OPTIONS_PRIORITES"
      outlined
      dense
      emit-value
      map-options
      :label="$t('common.fields.priority')"
      :hint="$t('reclamations.dialog.create.priorityHint')"
      class="q-mb-md"
    />

    <span class="section-titre">{{ $t('reclamations.dialog.create.department') }}</span>
    <champ-recherche
      v-model="form.departementId"
      endpoint="/departements"
      :label-fn="(d) => `${d.code} — ${d.nom}`"
      :label="$t('common.fields.department')"
    />

    <q-toggle
      v-model="form.anonyme"
      class="q-mt-md"
      :label="$t('reclamations.dialog.create.anonymous')"
    >
      <q-tooltip>
        {{ $t('reclamations.dialog.create.anonymousHint') }}
      </q-tooltip>
    </q-toggle>

    <template v-if="form.anonyme">
      <q-input
        v-model="form.nomAuteur"
        outlined
        dense
        :label="$t('reclamations.dialog.create.contactName')"
        class="q-mt-sm"
        :hint="$t('reclamations.dialog.create.contactHint')"
      />
      <q-input
        v-model="form.emailAuteur"
        outlined
        dense
        type="email"
        :label="$t('reclamations.dialog.create.contactEmail')"
        class="q-mt-sm"
      />
    </template>

    <q-banner v-if="erreur" dense class="note--erreur q-mt-md">
      <template #avatar><q-icon name="warning" /></template>
      {{ erreur }}
    </q-banner>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { api } from '@/boot/axios';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { LIBELLE_PRIORITE_RECLAMATION, LIBELLE_TYPE_RECLAMATION } from '@/shared/utils/libelles';
import type { PrioriteReclamation, Reclamation, TypeReclamation } from '@/types';

const ouvert = defineModel<boolean>({ required: true });
const emit = defineEmits<{ enregistre: [Reclamation] }>();

const $q = useQuasar();
const { t: $t } = useI18n();
const enregistrement = ref(false);
const erreur = ref('');

interface TuileType {
  value: TypeReclamation;
  label: string;
  icone: string;
}

const ICONE_TYPE: Record<TypeReclamation, string> = {
  NOTE_MANQUANTE: 'edit_note',
  ERREUR_SAISIE: 'build_circle',
  INSCRIPTION: 'how_to_reg',
  ENSEIGNEMENT: 'school',
  SCOLARITE: 'account_balance',
  TECHNIQUE: 'computer',
  AUTRE: 'help',
};

const TYPES = computed<TuileType[]>(() =>
  (Object.keys(LIBELLE_TYPE_RECLAMATION) as TypeReclamation[]).map((value) => ({
    value,
    label: $t(`libelles.type_reclamation.${value}`),
    icone: ICONE_TYPE[value],
  })),
);

const OPTIONS_PRIORITES = computed(() =>
  Object.keys(LIBELLE_PRIORITE_RECLAMATION).map((value) => ({
    value,
    label: $t(`libelles.priorite_reclamation.${value}`),
  })),
);

const form = ref({
  type: '' as TypeReclamation | '',
  sujet: '',
  description: '',
  priorite: 'NORMALE' as PrioriteReclamation,
  anonyme: false,
  departementId: null as string | null,
  nomAuteur: '',
  emailAuteur: '',
});

const valide = computed(() => {
  const sujetOk = form.value.sujet.trim().length >= 3;
  const descOk = form.value.description.trim().length >= 10;
  const typeOk = form.value.type !== '';
  const anonymeOk = !form.value.anonyme || !!form.value.nomAuteur?.trim();
  return sujetOk && descOk && typeOk && anonymeOk;
});

watch(
  ouvert,
  (o) => {
    if (!o) return;
    erreur.value = '';
    form.value = {
      type: '',
      sujet: '',
      description: '',
      priorite: 'NORMALE',
      anonyme: false,
      departementId: null,
      nomAuteur: '',
      emailAuteur: '',
    };
  },
);

async function envoyer() {
  if (!valide.value) return;
  enregistrement.value = true;
  erreur.value = '';
  try {
    const body: Record<string, unknown> = {
      type: form.value.type,
      sujet: form.value.sujet.trim(),
      description: form.value.description.trim(),
      priorite: form.value.priorite,
      anonyme: form.value.anonyme,
    };
    if (form.value.departementId) body.departementId = form.value.departementId;
    if (form.value.anonyme) {
      if (form.value.nomAuteur) body.nomAuteur = form.value.nomAuteur.trim();
      if (form.value.emailAuteur) body.emailAuteur = form.value.emailAuteur.trim();
    }
    const { data } = await api.post('/reclamations', body, { silencieux: true });
    $q.notify({ type: 'positive', message: $t('reclamations.dialog.create.opened', { numero: data.numero }) });
    emit('enregistre', data);
    ouvert.value = false;
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? $t('reclamations.dialog.create.sendFailed');
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.tuile-type {
  border: var(--up-filet);
  padding: 10px 6px;
  min-height: 78px;
  background: var(--up-craie);
  color: var(--up-encre);
  font-size: 11px;
  letter-spacing: -0.01em;
  line-height: 1.25;

  &--active {
    background: var(--up-encre);
    color: var(--up-craie);
  }
}
</style>
