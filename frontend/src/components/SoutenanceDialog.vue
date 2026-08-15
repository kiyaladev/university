<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ mode === 'jury' ? 'Constat du jury' : 'Planifier la soutenance' }}
      </q-card-section>
      <q-card-section v-if="mode === 'jury'" class="page-sous-titre">
        Note et mention après la tenue de la soutenance de « {{ travail?.intitule }} ».
      </q-card-section>

      <q-card-section v-if="mode !== 'jury'" class="q-gutter-md">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-7">
            <champ-date v-model="form.date" label="Date de la soutenance *" />
          </div>
          <div class="col-12 col-sm-5">
            <q-input v-model="form.heure" type="time" outlined dense label="Heure *" />
          </div>
        </div>

        <q-select
          v-model="form.salleId"
          :options="optionsSalles"
          outlined
          dense
          emit-value
          map-options
          clearable
          label="Salle"
          @filter="filtrerSalles"
        />

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.presidentId"
              :options="optionsEncadrants"
              outlined
              dense
              emit-value
              map-options
              use-input
              input-debounce="300"
              clearable
              label="Président du jury"
              @filter="filtrerEncadrants"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.assesseurs"
              outlined
              dense
              label="Assesseurs"
              hint="« Pr. X ; Dr. Y »"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-section v-else class="q-gutter-md">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.note"
              type="number"
              min="0"
              max="20"
              step="0.5"
              outlined
              dense
              label="Note sur 20"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.mention" outlined dense label="Mention" hint="Félicitations, Très bien…" />
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          :label="mode === 'jury' ? 'Enregistrer le constat' : 'Enregistrer la soutenance'"
          :loading="enregistrement"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import ChampDate from './ChampDate.vue';
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import type { Enseignant, Salle, Soutenance, TravailEncadre } from '../types';

/**
 * Deux usages :
 * - planifier (mode création) : POST /soutenances — date, salle, jury ;
 * - constat du jury : PUT /soutenances/:id/hota — note et mention.
 */
const props = defineProps<{
  modelValue: boolean;
  travail: TravailEncadre;
  mode: 'planifier' | 'jury';
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);

const form = ref({
  date: '',
  heure: '09:00',
  salleId: null as string | null,
  presidentId: null as string | null,
  assesseurs: '',
  note: null as number | null,
  mention: '',
});

const optionsSalles = ref<{ label: string; value: string }[]>([]);
const optionsEncadrants = ref<{ label: string; value: string }[]>([]);
const encadrantsTous = ref<Enseignant[]>([]);

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const s: Soutenance | null = props.travail.soutenance ?? null;
    form.value = {
      date: s ? s.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      heure: s ? s.date.slice(11, 16) : '09:00',
      salleId: s?.salleId ?? null,
      presidentId: s?.presidentId ?? null,
      assesseurs: s?.assesseurs ?? '',
      note: s?.note ?? null,
      mention: s?.mention ?? '',
    };
    api
      .get('/salles', { params: { all: '1' } })
      .then(({ data }) => {
        optionsSalles.value = data.data.map((x: Salle) => ({
          label: `${x.nom} (${x.code})`,
          value: x.id,
        }));
      });
    if (!encadrantsTous.value.length) {
      api.get('/enseignants', { params: { all: '1' } }).then(({ data }) => {
        encadrantsTous.value = data.data;
        optionsEncadrants.value = encadrantsTous.value.map((e) => ({
          label: `${e.nom} ${e.prenom} (${e.matricule})`,
          value: e.id,
        }));
      });
    }
  },
);

function filtrerSalles(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsSalles.value = optionsSalles.value.filter((o) => o.label.toLowerCase().includes(q));
  });
}

function filtrerEncadrants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEncadrants.value = encadrantsTous.value
      .filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom} (${e.matricule})`, value: e.id }));
  });
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    if (props.mode === 'jury') {
      await api.put(`/soutenances/${props.travail.soutenance!.id}/hota`, {
        note: form.value.note ?? undefined,
        mention: form.value.mention || undefined,
      });
      $q.notify({ type: 'positive', message: 'Constat du jury enregistré' });
    } else {
      if (!form.value.date) {
        $q.notify({ type: 'warning', message: 'La date de soutenance est requise' });
        return;
      }
      await api.post('/soutenances', {
        travailEncadreId: props.travail.id,
        date: `${form.value.date}T${form.value.heure || '09:00'}`,
        salleId: form.value.salleId || undefined,
        presidentId: form.value.presidentId || undefined,
        assesseurs: form.value.assesseurs || undefined,
      });
      $q.notify({ type: 'positive', message: 'Soutenance enregistrée — travail soutenu' });
    }
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>
