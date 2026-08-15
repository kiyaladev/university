<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section class="text-h6">Réserver une salle</q-card-section>

      <q-card-section>
        <q-select
          v-model="form.salleId"
          :options="optionsSalles"
          outlined
          dense
          emit-value
          map-options
          label="Salle *"
        />

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <champ-date v-model="form.dateJour" label="Date *" />
          </div>
          <div class="col-12 col-sm-6">
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <q-input v-model="form.heureDebut" outlined dense mask="##:##" label="Début *" />
              </div>
              <div class="col-6">
                <q-input v-model="form.heureFin" outlined dense mask="##:##" label="Fin *" />
              </div>
            </div>
          </div>
        </div>

        <q-input v-model="form.motif" outlined dense label="Motif de l’événement *" />
        <q-input v-model="form.organisme" outlined dense label="Organisme" hint="Ex. direction, département, entreprise…" />
        <q-input v-model="form.responsable" outlined dense label="Responsable sur place" />

        <q-banner v-if="conflits.length" dense class="note--avis q-mt-sm">
          <template #avatar><q-icon name="warning" size="22px" /></template>
          <div class="text-weight-bold">Cette salle est déjà occupée sur ce créneau :</div>
          <div
            v-for="c in conflits"
            :key="c.id"
            class="conflit-ligne"
            :class="`conflit-ligne--${c.statut.toLowerCase()}`"
          >
            {{ c.heureDebut }}–{{ c.heureFin }} · {{ c.motif }}
            <span v-if="c.organisme">({{ c.organisme }})</span>
            — {{ LIBELLE_STATUT_RESERVATION[c.statut].toLowerCase() }}
          </div>
          <div class="conflit-aide">La demande partira quand même : l’administration tranchera.</div>
        </q-banner>

        <q-banner v-if="erreur" dense class="note--erreur q-mt-sm">
          <template #avatar><q-icon name="block" /></template>
          {{ erreur }}
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn color="primary" unelevated label="Demander la réservation" :loading="enregistrement" @click="enregistrer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import ChampDate from './ChampDate.vue';
import { aujourdhui, LIBELLE_STATUT_RESERVATION } from '../utils/libelles';
import type { ReservationSalle, Salle } from '../types';

const props = defineProps<{ modelValue: boolean; salles: Salle[] }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);
const erreur = ref('');
const conflits = ref<ReservationSalle[]>([]);

const form = ref({
  salleId: '' as string,
  motif: '',
  organisme: '',
  dateJour: aujourdhui(),
  heureDebut: '14:00',
  heureFin: '16:00',
  responsable: '',
});

const optionsSalles = computed(() =>
  props.salles.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })),
);

const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/**
 * Avertissement non bloquant : la liste des réservations du jour dans la salle
 * choisie suffit à montrer les conflits d'horaire pendant la saisie. C'est le
 * service qui garde la décision dernière au moment de l'écriture.
 */
async function verifierConflits() {
  if (!form.value.salleId || !form.value.dateJour) return;
  try {
    const { data } = await api.get('/reservations', {
      params: { salleId: form.value.salleId, dateJour: form.value.dateJour, all: '1' },
    });
    const d = minutes(form.value.heureDebut);
    const f = minutes(form.value.heureFin);
    conflits.value = (data.data as ReservationSalle[]).filter(
      (r) =>
        (r.statut === 'EN_ATTENTE' || r.statut === 'CONFIRMEE') &&
        d < minutes(r.heureFin) &&
        minutes(r.heureDebut) < f,
    );
  } catch {
    conflits.value = [];
  }
}

watch(
  () => [form.value.salleId, form.value.dateJour, form.value.heureDebut, form.value.heureFin],
  verifierConflits,
);

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    erreur.value = '';
    conflits.value = [];
    form.value = {
      salleId: props.salles[0]?.id ?? '',
      dateJour: aujourdhui(),
      heureDebut: '14:00',
      heureFin: '16:00',
      motif: '',
      organisme: '',
      responsable: '',
    };
    verifierConflits();
  },
);

async function enregistrer() {
  enregistrement.value = true;
  erreur.value = '';
  try {
    await api.post('/reservations', {
      ...form.value,
      organisme: form.value.organisme || undefined,
      responsable: form.value.responsable || undefined,
    });
    $q.notify({ type: 'positive', message: 'Demande de réservation envoyée' });
    emit('enregistre');
    emit('update:modelValue', false);
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? 'Enregistrement impossible';
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.note--avis {
  border: 2px solid var(--up-jaune-fonce);
  border-radius: 0;

  :deep(.q-banner__avatar) {
    color: var(--up-jaune-fonce);
  }
}

.conflit-ligne {
  font-weight: 600;
  color: var(--up-encre);

  &--en_attente { color: var(--up-jaune-fonce); }
  &--confirmee { color: $vert; }
}

.conflit-aide {
  font-size: 0.8rem;
  color: var(--up-encre-douce);
  margin-top: 4px;
}
</style>