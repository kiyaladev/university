<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section class="text-h6">
        {{ creneau ? 'Modifier le créneau' : 'Nouveau créneau hebdomadaire' }}
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
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.jourSemaine"
              :options="optionsJours"
              outlined
              dense
              emit-value
              map-options
              label="Jour"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-select v-model="form.type" :options="TYPES_COURS" outlined dense label="Type" />
          </div>
        </div>

        <span class="section-titre">Horaire et salle</span>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-input v-model="form.heureDebut" outlined dense mask="##:##" label="Début" />
          </div>
          <div class="col-6">
            <q-input v-model="form.heureFin" outlined dense mask="##:##" label="Fin" />
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

        <span class="section-titre">Période</span>
        <p class="periode__aide">
          Laissez vide pour toute l’année. Sinon : « chaque
          {{ JOURS[form.jourSemaine]?.toLowerCase() }} de {{ form.heureDebut }} à
          {{ form.heureFin }}, du … au … ».
        </p>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <champ-date v-model="form.dateDebut" label="À partir du" />
          </div>
          <div class="col-12 col-sm-6">
            <champ-date v-model="form.dateFin" label="Jusqu’au" />
          </div>
        </div>
        <div v-if="form.dateDebut || form.dateFin" class="row q-gutter-xs q-mb-sm">
          <button
            v-for="r in raccourcisPeriode"
            :key="r.label"
            type="button"
            class="pochoir raccourci-periode"
            @click="appliquerPeriode(r)"
          >
            {{ r.label }}
          </button>
          <button type="button" class="pochoir raccourci-periode" @click="viderPeriode">
            toute l’année
          </button>
        </div>

        <q-toggle v-model="form.actif" label="Créneau actif" />

        <q-banner v-if="erreur" dense class="note--erreur">
          <template #avatar><q-icon name="warning" /></template>
          {{ erreur }}
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn color="primary" unelevated label="Enregistrer" :loading="enregistrement" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { JOURS, TYPES_COURS } from '../utils/libelles';
import ChampDate from './ChampDate.vue';
import type { Affectation, Creneau, Salle } from '../types';

const props = defineProps<{ modelValue: boolean; creneau?: Creneau | null; salles: Salle[] }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);
const erreur = ref('');
const affectations = ref<Affectation[]>([]);
const optionsAffectations = ref<{ label: string; value: string }[]>([]);

const optionsJours = JOURS.slice(1).map((j, i) => ({ label: j, value: i + 1 }));

const form = ref({
  affectationId: '',
  jourSemaine: 1,
  heureDebut: '08:00',
  heureFin: '10:00',
  type: 'CM',
  salleId: null as string | null,
  actif: true,
  dateDebut: '' as string,
  dateFin: '' as string,
});

/** Les découpages courants d'une année : semestre, mois en cours, un mois. */
const raccourcisPeriode = [
  { label: 'ce mois', mois: 0 },
  { label: 'mois prochain', mois: 1 },
  { label: '3 mois', mois: 3 },
];

function appliquerPeriode(r: { mois: number }) {
  const base = form.value.dateDebut ? new Date(form.value.dateDebut) : new Date();
  const debut = r.mois === 0
    ? new Date(base.getFullYear(), base.getMonth(), 1)
    : new Date(base.getFullYear(), base.getMonth() + (r.mois === 1 ? 1 : 0), 1);
  const fin = new Date(
    debut.getFullYear(),
    debut.getMonth() + (r.mois === 3 ? 3 : 1),
    0,
  );
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  form.value.dateDebut = iso(debut);
  form.value.dateFin = iso(fin);
}

function viderPeriode() {
  form.value.dateDebut = '';
  form.value.dateFin = '';
}

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
    erreur.value = '';
    const c = props.creneau;
    form.value = {
      affectationId: c?.affectationId ?? '',
      jourSemaine: c?.jourSemaine ?? 1,
      heureDebut: c?.heureDebut ?? '08:00',
      heureFin: c?.heureFin ?? '10:00',
      type: c?.type ?? 'CM',
      salleId: c?.salleId ?? null,
      actif: c?.actif ?? true,
      dateDebut: c?.dateDebut ? c.dateDebut.slice(0, 10) : '',
      dateFin: c?.dateFin ? c.dateFin.slice(0, 10) : '',
    };
  },
);

async function enregistrer() {
  enregistrement.value = true;
  erreur.value = '';
  try {
    // Une période vide vaut « toute l'année » : on envoie null, pas ''.
    const charge = {
      ...form.value,
      dateDebut: form.value.dateDebut || null,
      dateFin: form.value.dateFin || null,
    };
    if (props.creneau) await api.put(`/creneaux/${props.creneau.id}`, charge);
    else await api.post('/creneaux', charge);
    $q.notify({ type: 'positive', message: 'Créneau enregistré' });
    emit('enregistre');
    emit('update:modelValue', false);
  } catch (e: any) {
    // Les conflits d'emploi du temps sont renvoyés en 400 par l'API.
    erreur.value = e.response?.data?.message ?? 'Enregistrement impossible';
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.periode__aide {
  color: var(--up-encre-douce);
  font-size: 0.82rem;
  margin: 0 0 var(--up-2);
}

.raccourci-periode {
  border: var(--up-filet);
  background: transparent;
  color: var(--up-encre);
  padding: 3px var(--up-2);
  cursor: pointer;

  &:hover { background: var(--up-encre); color: var(--up-craie); }
}
</style>
