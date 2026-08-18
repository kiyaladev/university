<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 620px; max-width: 96vw">
      <q-card-section class="text-h6">Nouvelle demande de document</q-card-section>

      <q-card-section>
        <span class="section-titre">Type de document *</span>
        <q-select
          v-model="form.type"
          :options="optionsType"
          outlined
          dense
          emit-value
          map-options
          label="Type"
        >
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
                <q-item-label v-if="scope.opt.montant != null" caption>
                  {{ montantLisible(scope.opt.montant) }} {{ scope.opt.devise ?? 'GNF' }}
                  <span v-if="scope.opt.delaiHeures"> · délai {{ scope.opt.delaiHeures }} h</span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <template v-if="tarifSelectionne">
          <q-banner class="note--info q-mt-sm">
            Frais : <strong>{{ montantLisible(tarifSelectionne.montant) }} {{ tarifSelectionne.devise }}</strong>
            <span v-if="tarifSelectionne.delaiHeures">
              — délai habituel {{ tarifSelectionne.delaiHeures }} h</span
            >.
          </q-banner>
        </template>
        <q-banner v-else-if="form.type" class="note--alerte q-mt-sm">
          Aucun tarif paramétré pour ce type : la demande sera créée sans frais
          (workflow dégradé). Contactez la scolarité si nécessaire.
        </q-banner>

        <span class="section-titre">Motif</span>
        <q-input
          v-model="form.motif"
          outlined
          dense
          type="textarea"
          rows="2"
          counter
          :max-length="500"
          label="Motif de la demande"
          placeholder="Ex. : besoin pour dossier de bourse"
        />

        <span class="section-titre">Inscription concernée</span>
        <autocomplete-async
          v-if="inscriptions.length"
          v-model="form.inscriptionId"
          endpoint="/inscriptions"
          :label-fn="(i) => `${i.numero} — ${i.promotion?.nom ?? ''}`"
          label="Inscription"
          :preload="true"
        />
        <q-banner v-else class="note--info q-mt-sm">
          Aucune inscription enregistrée : la demande portera uniquement sur
          votre dossier.
        </q-banner>
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
          label="Soumettre"
          :loading="enregistrement"
          :disable="!form.type"
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
import { LIBELLE_TYPE_DEMANDE, montantLisible } from '../utils/libelles';
import type { DemandeDocument, Inscription, TarifDemande, TypeDemandeDocument } from '../types';

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [boolean];
  creee: [DemandeDocument];
}>();

const $q = useQuasar();
const enregistrement = ref(false);
const erreur = ref('');

const tarifs = ref<TarifDemande[]>([]);
const inscriptions = ref<Inscription[]>([]);
const form = ref<{
  type: TypeDemandeDocument | null;
  motif: string;
  inscriptionId: string | null;
}>({
  type: null,
  motif: '',
  inscriptionId: null,
});

const optionsType = computed(() =>
  (Object.keys(LIBELLE_TYPE_DEMANDE) as TypeDemandeDocument[]).map((value) => {
    const tarif = tarifs.value.find((t) => t.type === value);
    return {
      label: LIBELLE_TYPE_DEMANDE[value],
      value,
      montant: tarif?.montant,
      devise: tarif?.devise,
      delaiHeures: tarif?.delaiHeures,
    };
  }),
);

const tarifSelectionne = computed(() =>
  tarifs.value.find((t) => t.type === form.value.type) ?? null,
);

watch(
  () => props.modelValue,
  async (ouvert) => {
    if (!ouvert) return;
    erreur.value = '';
    form.value = { type: null, motif: '', inscriptionId: null };
    try {
      const [tarifsRes, inscriptionsRes] = await Promise.all([
        api.get('/documents-demande/tarifs'),
        api.get('/inscriptions', { params: { all: '1' } }),
      ]);
      tarifs.value = Array.isArray(tarifsRes.data) ? tarifsRes.data : [];
      inscriptions.value = Array.isArray(inscriptionsRes.data?.data) ? inscriptionsRes.data.data : [];
    } catch {
      tarifs.value = [];
      inscriptions.value = [];
    }
  },
);

async function envoyer() {
  if (!form.value.type) return;
  enregistrement.value = true;
  erreur.value = '';
  try {
    const body: Record<string, unknown> = { type: form.value.type };
    if (form.value.motif.trim()) body.motif = form.value.motif.trim();
    if (form.value.inscriptionId) body.inscriptionId = form.value.inscriptionId;
    const { data } = await api.post('/documents-demande', body);
    $q.notify({ type: 'positive', message: `Demande ${data.numero} créée` });
    emit('creee', data as DemandeDocument);
    emit('update:modelValue', false);
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? 'Création impossible';
  } finally {
    enregistrement.value = false;
  }
}
</script>