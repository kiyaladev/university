<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ $t(mode === 'jury' ? 'stages.dialogs.defense.juryTitle' : 'stages.dialogs.defense.scheduleTitle') }}
      </q-card-section>
      <q-card-section v-if="mode === 'jury'" class="page-sous-titre">
        {{ $t('stages.dialogs.defense.juryHint', { title: travail?.intitule }) }}
      </q-card-section>

      <q-card-section v-if="mode !== 'jury'" class="q-gutter-md">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-7">
            <champ-date v-model="form.date" :label="$t('stages.dialogs.defense.date')" />
          </div>
          <div class="col-12 col-sm-5">
            <q-input v-model="form.heure" type="time" outlined dense :label="$t('stages.dialogs.defense.time')" />
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
          :label="$t('common.fields.classroom')"
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
              :label="$t('stages.dialogs.defense.chair')"
              @filter="filtrerEncadrants"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.assesseurs"
              outlined
              dense
              :label="$t('stages.dialogs.defense.assessors')"
              :hint="$t('stages.dialogs.defense.assessorsHint')"
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
              :label="$t('stages.dialogs.defense.grade')"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.mention" outlined dense :label="$t('bulletins.table.columns.mention')" hint="Félicitations, Très bien…" />
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          :label="$t(mode === 'jury' ? 'stages.dialogs.defense.saveJury' : 'stages.dialogs.defense.saveDefense')"
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
import { useI18n } from 'vue-i18n';
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
const { t } = useI18n();
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
      $q.notify({ type: 'positive', message: t('stages.dialogs.defense.jurySaved') });
    } else {
      if (!form.value.date) {
        $q.notify({ type: 'warning', message: t('stages.dialogs.defense.dateRequired') });
        return;
      }
      await api.post('/soutenances', {
        travailEncadreId: props.travail.id,
        date: `${form.value.date}T${form.value.heure || '09:00'}`,
        salleId: form.value.salleId || undefined,
        presidentId: form.value.presidentId || undefined,
        assesseurs: form.value.assesseurs || undefined,
      });
      $q.notify({ type: 'positive', message: t('stages.dialogs.defense.saved') });
    }
    emit('enregistre');
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>
