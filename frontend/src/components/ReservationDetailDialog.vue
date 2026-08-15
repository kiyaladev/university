<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="row items-center no-wrap">
        <div class="col text-h6">
          {{ reservation?.motif }}
          <div class="text-subtitle2 text-grey-7">
            {{ reservation?.salle?.code }} — {{ reservation?.salle?.nom }}
          </div>
        </div>
        <q-badge
          v-if="reservation"
          class="detail-badge"
          :class="`detail-badge--${reservation.statut.toLowerCase()}`"
        >
          {{ LIBELLE_STATUT_RESERVATION[reservation.statut] }}
        </q-badge>
      </q-card-section>

      <q-card-section v-if="reservation" class="q-pt-none">
        <div class="detail-grille">
          <span class="pochoir">Créneau</span>
          <span class="lettrage chiffres">
            {{ reservation.dateJour.slice(8, 10) }}/{{ reservation.dateJour.slice(5, 7) }}/{{
              reservation.dateJour.slice(0, 4)
            }}
            · {{ reservation.heureDebut }}–{{ reservation.heureFin }}
          </span>
          <span class="pochoir">Organisme</span>
          <span>{{ reservation.organisme || '—' }}</span>
          <span class="pochoir">Responsable</span>
          <span>{{ reservation.responsable || '—' }}</span>
          <span class="pochoir">Demandeur</span>
          <span>
            {{ nomComplet(reservation.demandeur) || '—' }}
            <span v-if="estProprietaire" class="detail-moi">(vous)</span>
          </span>
          <span class="pochoir">Refus</span>
          <span v-if="reservation.refuseParId">
            {{ nomComplet(reservation.refusePar) }}{{ reservation.refuseMotif ? ` — ${reservation.refuseMotif}` : '' }}
          </span>
          <span v-else>—</span>
          <span class="pochoir">Demande du</span>
          <span>{{ dateHeureLisible(reservation.creeLe) }}</span>
        </div>

        <!-- L'emploi du temps se lit, il ne se décide pas ici : sans action
             possible, la réservation est déjà réglée. -->
        <p v-if="!peutModifier && !peutDecider" class="note--info q-mt-sm">
          <q-icon name="info" size="18px" /> Aucune action possible sur cette réservation.
        </p>

        <!-- Décision de l'administration : confirmer ou refuser proprement. -->
        <div v-if="peutDecider" class="q-mt-md">
          <span class="section-titre">Décision</span>
          <q-input
            v-model="decisionMotif"
            outlined
            dense
            label="Motif (recommandé pour un refus)"
          />
          <div class="row q-gutter-sm q-mt-sm">
            <q-btn
              unelevated
              color="positive"
              no-caps
              icon="check"
              label="Confirmer"
              :loading="enCours === 'confirmer'"
              :disabled="reservation.statut !== 'EN_ATTENTE'"
              @click="decider('CONFIRMEE')"
            />
            <q-btn
              unelevated
              color="negative"
              no-caps
              icon="close"
              label="Refuser"
              :loading="enCours === 'refuser'"
              :disabled="reservation.statut !== 'EN_ATTENTE'"
              @click="decider('REFUSEE')"
            />
          </div>
        </div>

        <!-- Modification de la demande : tant qu'elle n'est pas statuée. -->
        <div v-if="peutModifier" class="detail-section q-mt-md">
          <span class="section-titre">Modifier la demande</span>
          <q-select
            v-model="form.salleId"
            :options="optionsSalles"
            outlined
            dense
            emit-value
            map-options
            label="Salle"
          />
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <champ-date v-model="form.dateJour" label="Date" />
            </div>
            <div class="col-6">
              <q-input v-model="form.heureDebut" outlined dense mask="##:##" label="Début" />
            </div>
            <div class="col-6">
              <q-input v-model="form.heureFin" outlined dense mask="##:##" label="Fin" />
            </div>
          </div>
          <q-input v-model="form.motif" outlined dense label="Motif" />
          <q-input v-model="form.organisme" outlined dense label="Organisme" />
          <q-input v-model="form.responsable" outlined dense label="Responsable" />
          <div class="row q-gutter-sm q-mt-sm">
            <q-btn
              unelevated
              color="primary"
              no-caps
              icon="save"
              label="Enregistrer"
              :loading="enCours === 'modifier'"
              @click="modifier"
            />
            <q-btn
              flat
              no-caps
              icon="delete"
              label="Annuler la réservation"
              :loading="enCours === 'annuler'"
              @click="annuler"
            />
          </div>
        </div>

        <q-banner v-if="erreur" dense class="note--erreur q-mt-sm">
          <template #avatar><q-icon name="block" /></template>
          {{ erreur }}
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Fermer" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import ChampDate from './ChampDate.vue';
import { dateHeureLisible, LIBELLE_STATUT_RESERVATION } from '../utils/libelles';
import type { ReservationSalle, Salle } from '../types';

/** Champs renvoyés par l'API mais non inscrits dans types.ts (ajouts récents). */
type ReservationDetail = ReservationSalle & {
  demandeurId?: string | null;
  refuseParId?: string | null;
  refusePar?: { id: string; nom: string; prenom: string } | null;
};

const props = defineProps<{
  modelValue: boolean;
  reservation: ReservationDetail | null;
  salles: Salle[];
}>();

const emit = defineEmits<{ 'update:modelValue': [boolean]; change: [] }>();

const $q = useQuasar();
const auth = useAuthStore();

const enCours = ref('');
const erreur = ref('');
const decisionMotif = ref('');
const form = ref({
  salleId: '',
  motif: '',
  organisme: '',
  dateJour: '',
  heureDebut: '',
  heureFin: '',
  responsable: '',
});

const estProprietaire = computed(
  () => props.reservation?.demandeurId && props.reservation.demandeurId === auth.utilisateur?.id,
);
const estAdministrateur = computed(
  () => auth.utilisateur?.role === 'ADMIN' || auth.utilisateur?.role === 'DIRECTION',
);
const peutDecider = computed(() => estAdministrateur.value);
const estModifiable = computed(() => props.reservation?.statut === 'EN_ATTENTE');
const peutModifier = computed(
  () => estModifiable.value && (estProprietaire.value || auth.utilisateur?.role === 'ADMIN'),
);

const optionsSalles = computed(() =>
  props.salles.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })),
);

const nomComplet = (u?: { nom: string; prenom: string } | null) =>
  u ? `${u.prenom} ${u.nom}` : '';

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert || !props.reservation) return;
    erreur.value = '';
    decisionMotif.value = props.reservation.refuseMotif ?? '';
    const r = props.reservation;
    form.value = {
      salleId: r.salleId,
      motif: r.motif,
      organisme: r.organisme ?? '',
      dateJour: r.dateJour.slice(0, 10),
      heureDebut: r.heureDebut,
      heureFin: r.heureFin,
      responsable: r.responsable ?? '',
    };
  },
);

async function decider(statut: 'CONFIRMEE' | 'REFUSEE') {
  const id = props.reservation!.id;
  enCours.value = statut === 'CONFIRMEE' ? 'confirmer' : 'refuser';
  erreur.value = '';
  try {
    await api.post(`/reservations/${id}/decider`, {
      statut,
      ...(decisionMotif.value ? { motif: decisionMotif.value } : {}),
    });
    $q.notify({
      type: statut === 'CONFIRMEE' ? 'positive' : 'warning',
      message: statut === 'CONFIRMEE' ? 'Réservation confirmée' : 'Réservation refusée',
    });
    emit('change');
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? 'Décision impossible';
  } finally {
    enCours.value = '';
  }
}

async function modifier() {
  enCours.value = 'modifier';
  erreur.value = '';
  try {
    await api.put(`/reservations/${props.reservation!.id}`, {
      ...form.value,
      organisme: form.value.organisme || undefined,
      responsable: form.value.responsable || undefined,
    });
    $q.notify({ type: 'positive', message: 'Réservation mise à jour' });
    emit('change');
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? 'Modification impossible';
  } finally {
    enCours.value = '';
  }
}

async function annuler() {
  $q.dialog({
    title: 'Annuler la réservation ?',
    message: 'Le créneau redevient disponible immédiatement.',
    cancel: true,
    ok: { label: 'Annuler la réservation', color: 'negative' },
  }).onOk(async () => {
    enCours.value = 'annuler';
    erreur.value = '';
    try {
      await api.delete(`/reservations/${props.reservation!.id}`);
      $q.notify({ type: 'positive', message: 'Réservation annulée' });
      emit('change');
      emit('update:modelValue', false);
    } catch (e: any) {
      erreur.value = e.response?.data?.message ?? 'Annulation impossible';
    } finally {
      enCours.value = '';
    }
  });
}
</script>

<style scoped lang="scss">
.detail-grille {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  row-gap: var(--up-2);
  column-gap: var(--up-3);
  font-size: 0.92rem;

  .pochoir { color: var(--up-encre-douce); }
}

.detail-badge {
  border-radius: 0;
  text-transform: none;
  font-weight: 700;

  &--en_attente { background: $jaune; color: $encre; }
  &--confirmee { background: $vert; }
  &--refusee,
  &--annulee { background: $rouge; }
}

.detail-moi { color: var(--up-encre-douce); font-size: 0.8rem; }

.detail-section {
  border-top: var(--up-filet-fin);
  padding-top: var(--up-3);
}
</style>