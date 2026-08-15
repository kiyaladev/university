<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ seance ? 'Modifier la séance' : 'Séance non programmée' }}</div>
        <div v-if="!seance" class="page-sous-titre">
          Un cours trouvé en salle sans ligne à l’emploi du temps : ouvrez-le ici, il
          se pointe ensuite comme les autres.
        </div>
      </q-card-section>

      <q-card-section>
        <span class="section-titre">Quel cours</span>
        <q-select
          v-model="form.affectationId"
          :options="optionsAffectations"
          outlined
          dense
          emit-value
          map-options
          use-input
          input-debounce="200"
          label="Charge d'enseignement"
          hint="Enseignant · matière · promotion"
          @filter="filtrer"
        />
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <champ-date v-model="form.date" label="Date" />
          </div>
          <div class="col-12 col-sm-6">
            <q-select v-model="form.type" :options="TYPES_COURS" outlined dense label="Type" />
          </div>
        </div>
        <span class="section-titre">Quand et où</span>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-input v-model="form.heureDebut" outlined dense mask="##:##" label="Heure de début" />
          </div>
          <div class="col-6">
            <q-input v-model="form.heureFin" outlined dense mask="##:##" label="Heure de fin" />
          </div>
        </div>
        <q-select
          v-model="form.salleId"
          :options="optionsSalles"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Salle"
        />
        <q-input v-model="form.thematique" outlined dense label="Thème prévu" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn color="primary" unelevated label="Enregistrer" :loading="enregistrement" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import ChampDate from './ChampDate.vue';
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { TYPES_COURS, aujourdhui } from '../utils/libelles';
import type { Affectation, Salle, Seance } from '../types';

const props = defineProps<{
  modelValue: boolean;
  seance?: Seance | null;
  salles: Salle[];
  /** Date pré-remplie : la journée que le contrôleur est en train de pointer. */
  dateImposee?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [Seance] }>();

const $q = useQuasar();
const enregistrement = ref(false);
const affectations = ref<Affectation[]>([]);
const optionsAffectations = ref<{ label: string; value: string }[]>([]);

const form = ref({
  affectationId: '',
  date: aujourdhui(),
  heureDebut: '08:00',
  heureFin: '10:00',
  type: 'CM',
  salleId: null as string | null,
  thematique: '',
});

const optionsSalles = computed(() =>
  props.salles.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })),
);

const libelle = (a: Affectation) =>
  `${a.enseignant?.nom} ${a.enseignant?.prenom} · ${a.matiere?.code} · ${a.promotion?.nom}`;

async function filtrer(saisie: string, maj: (fn: () => void) => void) {
  if (!affectations.value.length) {
    const { data } = await api.get('/affectations', { params: { all: '1' } });
    affectations.value = data.data;
  }
  maj(() => {
    const q = saisie.toLowerCase();
    optionsAffectations.value = affectations.value
      .filter((a) => libelle(a).toLowerCase().includes(q))
      .map((a) => ({ label: libelle(a), value: a.id }));
  });
}

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    const s = props.seance;
    form.value = {
      affectationId: s?.affectationId ?? '',
      date: s?.date?.slice(0, 10) ?? props.dateImposee ?? aujourdhui(),
      heureDebut: s?.heureDebut ?? '08:00',
      heureFin: s?.heureFin ?? '10:00',
      type: s?.type ?? 'CM',
      salleId: s?.salleId ?? null,
      thematique: s?.thematique ?? '',
    };
  },
);

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = { ...form.value, thematique: form.value.thematique || undefined };
    const { data } = props.seance
      ? await api.put(`/seances/${props.seance.id}`, payload)
      : await api.post('/seances', payload);
    $q.notify({ type: 'positive', message: 'Séance enregistrée' });
    emit('enregistre', data);
    emit('update:modelValue', false);
  } finally {
    enregistrement.value = false;
  }
}
</script>
