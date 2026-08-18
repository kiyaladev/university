<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 620px; max-width: 96vw">
      <q-card-section class="text-h6">Nouvelle réclamation</q-card-section>

      <q-card-section>
        <span class="section-titre">Nature *</span>
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

        <span class="section-titre">Sujet *</span>
        <q-input
          v-model="form.sujet"
          outlined
          dense
          counter
          :max-length="200"
          :rules="[(v) => (v ?? '').trim().length >= 3 || 'Au moins 3 caractères']"
          label="Résumez le problème en une phrase"
          class="q-mb-md"
        />

        <span class="section-titre">Description *</span>
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
            (v) => (v ?? '').trim().length >= 10 || 'Au moins 10 caractères',
            (v) => (v ?? '').trim().length <= 4000 || 'Au plus 4000 caractères',
          ]"
          label="Décrivez précisément"
          placeholder="Ex. : la note de Mathématiques du CC2 ne s'affiche pas dans mon bulletin"
          class="q-mb-md"
        />

        <span class="section-titre">Priorité</span>
        <q-select
          v-model="form.priorite"
          :options="OPTIONS_PRIORITES"
          outlined
          dense
          emit-value
          map-options
          label="Priorité"
          hint="Haute ou urgente pour les blocages ; basse pour les demandes d'information"
          class="q-mb-md"
        />

        <span class="section-titre">Département concerné</span>
        <autocomplete-async
          v-model="form.departementId"
          endpoint="/departements"
          :label-fn="(d) => `${d.code} — ${d.nom}`"
          label="Département"
        />

        <q-toggle
          v-model="form.anonyme"
          class="q-mt-md"
          label="Déposer de façon anonyme"
        >
          <q-tooltip>
            L'anonymat conserve votre dossier à l'écart : ni votre nom, ni votre
            matricule ne seront associés à la réclamation.
          </q-tooltip>
        </q-toggle>

        <template v-if="form.anonyme">
          <q-input
            v-model="form.nomAuteur"
            outlined
            dense
            label="Nom de contact"
            class="q-mt-sm"
            hint="Pour vous recontacter hors de l'application"
          />
          <q-input
            v-model="form.emailAuteur"
            outlined
            dense
            type="email"
            label="Email de contact"
            class="q-mt-sm"
          />
        </template>
      </q-card-section>

      <q-banner v-if="erreur" dense class="note--erreur q-mx-md q-mb-sm">
        <template #avatar><q-icon name="warning" /></template>
        {{ erreur }}
      </q-banner>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          icon="send"
          label="Envoyer"
          :loading="enregistrement"
          :disable="!valide"
          @click="envoyer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import AutocompleteAsync from './AutocompleteAsync.vue';
import {
  LIBELLE_PRIORITE_RECLAMATION,
  LIBELLE_TYPE_RECLAMATION,
  optionsDepuis,
} from '../utils/libelles';
import type { PrioriteReclamation, Reclamation, TypeReclamation } from '../types';

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [boolean];
  creee: [Reclamation];
}>();

const $q = useQuasar();
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

const TYPES: TuileType[] = (Object.keys(LIBELLE_TYPE_RECLAMATION) as TypeReclamation[]).map(
  (value) => ({
    value,
    label: LIBELLE_TYPE_RECLAMATION[value],
    icone: ICONE_TYPE[value],
  }),
);

const OPTIONS_PRIORITES = optionsDepuis(LIBELLE_PRIORITE_RECLAMATION);

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
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
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
    const { data } = await api.post('/reclamations', body);
    $q.notify({ type: 'positive', message: `Réclamation ${data.numero} ouverte` });
    emit('creee', data);
    emit('update:modelValue', false);
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? 'Envoi impossible';
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.tuile-type {
  border: 2px solid rgba(16, 37, 30, 0.34);
  padding: 10px 6px;
  min-height: 78px;
  background: var(--up-craie);
  color: var(--up-encre);
  font-size: 11px;
  letter-spacing: 0.03em;
  line-height: 1.25;

  &--active {
    background: var(--up-encre);
    color: var(--up-craie);
  }
}
</style>