<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">Enregistrer un courrier</div>
        <div class="text-caption text-grey-7">
          Si aucun circuit n'est saisi, le circuit par défaut (secrétariat → chef département → archives)
          est créé automatiquement.
        </div>
      </q-card-section>
      <q-card-section class="q-gutter-md">
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-input v-model="form.numero" outlined dense label="Numéro (COUR-AAAA-XXXXX)" />
          </div>
          <div class="col-6">
            <q-select
              v-model="form.type"
              :options="optionsTypes"
              outlined
              dense
              emit-value
              map-options
              label="Type"
            />
          </div>
        </div>
        <q-input v-model="form.objet" outlined dense label="Objet" />
        <div class="row q-col-gutter-md">
          <div v-if="form.type === 'ENTRANT'" class="col-6">
            <q-input v-model="form.expediteur" outlined dense label="Expéditeur" />
          </div>
          <div v-else class="col-6">
            <q-input v-model="form.destinataire" outlined dense label="Destinataire" />
          </div>
          <div class="col-6">
            <champ-date v-if="form.type === 'ENTRANT'" v-model="form.dateReception" label="Date de réception" />
            <champ-date v-else v-model="form.dateEnvoi" label="Date d'envoi" />
          </div>
        </div>
        <q-input v-model="form.numeroReference" outlined dense label="Référence archive (optionnel)" />
        <q-file v-model="fichier" outlined dense label="PJ scannée (PDF/image)" accept="image/*,.pdf" @update:model-value="lireFichier">
          <template #prepend><q-icon name="attach_file" /></template>
        </q-file>
        <q-input v-model="form.notes" outlined dense type="textarea" rows="2" label="Notes" />

        <div>
          <div class="text-subtitle2 q-mb-sm">Circuit de paraphe</div>
          <q-list bordered separator dense>
            <q-item v-for="(e, i) in form.circuit" :key="i">
              <q-item-section>
                <div class="row q-col-gutter-sm items-center">
                  <div class="col-2">
                    <q-input v-model.number="e.ordre" type="number" min="1" outlined dense label="#" />
                  </div>
                  <div class="col">
                    <q-input v-model="e.roleValideur" outlined dense label="Rôle du valideur" />
                  </div>
                  <div class="col-auto">
                    <q-btn flat round dense icon="delete" color="negative" @click="form.circuit.splice(i, 1)" />
                  </div>
                </div>
              </q-item-section>
            </q-item>
            <q-item v-if="!form.circuit.length">
              <q-item-section class="text-grey-7 text-caption">
                Aucun circuit défini — un circuit par défaut sera appliqué.
              </q-item-section>
            </q-item>
          </q-list>
          <q-btn flat dense icon="add" no-caps label="Ajouter une étape" class="q-mt-sm" @click="ajouterEtape" />
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn unelevated color="primary" label="Enregistrer" :loading="envoi" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import ChampDate from './ChampDate.vue';

defineProps<{
  modelValue: boolean;
  existant?: any;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  cree: [];
}>();

const $q = useQuasar();

const optionsTypes = [
  { label: 'Entrant', value: 'ENTRANT' },
  { label: 'Sortant', value: 'SORTANT' },
];

const fichier = ref<File | null>(null);
const envoi = ref(false);

interface EtapeForm {
  ordre: number;
  roleValideur: string;
}

const form = ref({
  numero: '',
  type: 'ENTRANT' as 'ENTRANT' | 'SORTANT',
  objet: '',
  expediteur: '',
  destinataire: '',
  dateReception: '',
  dateEnvoi: '',
  numeroReference: '',
  notes: '',
  fichier: undefined as string | undefined,
  circuit: [] as EtapeForm[],
});

function ajouterEtape() {
  form.value.circuit.push({
    ordre: (form.value.circuit.at(-1)?.ordre ?? 0) + 1,
    roleValideur: '',
  });
}

function lireFichier(f: File | null) {
  if (!f) {
    form.value.fichier = undefined;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => (form.value.fichier = String(reader.result));
  reader.readAsDataURL(f);
}

async function enregistrer() {
  if (!form.value.numero || !form.value.objet) {
    $q.notify({ type: 'warning', message: 'Numéro et objet sont obligatoires' });
    return;
  }
  envoi.value = true;
  try {
    await api.post('/courrier', form.value);
    $q.notify({ type: 'positive', message: 'Courrier enregistré' });
    emit('update:modelValue', false);
    emit('cree');
    form.value = {
      numero: '',
      type: 'ENTRANT',
      objet: '',
      expediteur: '',
      destinataire: '',
      dateReception: '',
      dateEnvoi: '',
      numeroReference: '',
      notes: '',
      fichier: undefined,
      circuit: [],
    };
    fichier.value = null;
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Enregistrement impossible' });
  } finally {
    envoi.value = false;
  }
}
</script>
