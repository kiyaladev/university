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
          <span class="pochoir">{{ $t('reservations.table.columns.slot') }}</span>
          <span class="lettrage chiffres">
            {{ reservation.dateJour.slice(8, 10) }}/{{ reservation.dateJour.slice(5, 7) }}/{{
              reservation.dateJour.slice(0, 4)
            }}
            · {{ reservation.heureDebut }}–{{ reservation.heureFin }}
          </span>
          <span class="pochoir">{{ $t('reservations.table.columns.organization') }}</span>
          <span>{{ reservation.organisme || '—' }}</span>
          <span class="pochoir">{{ $t('cites.residences.table.columns.responsable') }}</span>
          <span>{{ reservation.responsable || '—' }}</span>
          <span class="pochoir">{{ $t('reservations.detailDialog.requester') }}</span>
          <span>
            {{ nomComplet(reservation.demandeur) || '—' }}
            <span v-if="estProprietaire" class="detail-moi">({{ $t('reservations.detailDialog.you') }})</span>
          </span>
          <span class="pochoir">{{ $t('reservations.detailDialog.refusal') }}</span>
          <span v-if="reservation.refuseParId">
            {{ nomComplet(reservation.refusePar) }}{{ reservation.refuseMotif ? ` — ${reservation.refuseMotif}` : '' }}
          </span>
          <span v-else>—</span>
          <span class="pochoir">{{ $t('reservations.detailDialog.requestedOn') }}</span>
          <span>{{ dateHeureLisible(reservation.creeLe) }}</span>
        </div>

        <!-- L'emploi du temps se lit, il ne se décide pas ici : sans action
             possible, la réservation est déjà réglée. -->
        <p v-if="!peutModifier && !peutDecider" class="note--info q-mt-sm">
          <q-icon name="info" size="18px" /> {{ $t('reservations.detailDialog.noAction') }}
        </p>

        <!-- Décision de l'administration : confirmer ou refuser proprement. -->
        <div v-if="peutDecider" class="q-mt-md">
          <span class="section-titre">{{ $t('common.fields.decision') }}</span>
          <q-input
            v-model="decisionMotif"
            outlined
            dense
            :label="$t('reservations.detailDialog.refusalReason')"
          />
          <div class="row q-gutter-sm q-mt-sm">
            <q-btn
              unelevated
              color="positive"
              no-caps
              icon="check"
              :label="$t('common.actions.confirm')"
              :loading="enCours === 'confirmer'"
              :disabled="reservation.statut !== 'EN_ATTENTE'"
              @click="decider('CONFIRMEE')"
            />
            <q-btn
              unelevated
              color="negative"
              no-caps
              icon="close"
              :label="$t('common.actions.refuse')"
              :loading="enCours === 'refuser'"
              :disabled="reservation.statut !== 'EN_ATTENTE'"
              @click="decider('REFUSEE')"
            />
          </div>
        </div>

        <!-- Modification de la demande : tant qu'elle n'est pas statuée. -->
        <div v-if="peutModifier" class="detail-section q-mt-md">
          <span class="section-titre">{{ $t('reservations.detailDialog.editRequest') }}</span>
          <q-select
            v-model="form.salleId"
            :options="optionsSalles"
            outlined
            dense
            emit-value
            map-options
            :label="$t('common.fields.classroom')"
          />
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <champ-date v-model="form.dateJour" :label="$t('common.fields.date')" />
            </div>
            <div class="col-6">
              <q-input v-model="form.heureDebut" outlined dense mask="##:##" :label="$t('common.fields.start')" />
            </div>
            <div class="col-6">
              <q-input v-model="form.heureFin" outlined dense mask="##:##" :label="$t('common.fields.end')" />
            </div>
          </div>
          <q-input v-model="form.motif" outlined dense :label="$t('common.fields.motif')" />
          <q-input v-model="form.organisme" outlined dense :label="$t('reservations.table.columns.organization')" />
          <q-input v-model="form.responsable" outlined dense :label="$t('cites.residences.table.columns.responsable')" />
          <div class="row q-gutter-sm q-mt-sm">
            <q-btn
              unelevated
              color="primary"
              no-caps
              icon="save"
              :label="$t('common.actions.register')"
              :loading="enCours === 'modifier'"
              @click="modifier"
            />
            <q-btn
              flat
              no-caps
              icon="delete"
              :label="$t('reservations.detailDialog.cancelReservation')"
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
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useConfirmation } from '../composables/useConfirmation';
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
const { t } = useI18n();
const auth = useAuthStore();
const { confirmer } = useConfirmation();

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
    }, { silencieux: true });
    $q.notify({
      type: statut === 'CONFIRMEE' ? 'positive' : 'warning',
      message: t(statut === 'CONFIRMEE' ? 'reservations.detailDialog.confirmed' : 'reservations.detailDialog.refused'),
    });
    emit('change');
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? t('reservations.detailDialog.decisionFailed');
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
    }, { silencieux: true });
    $q.notify({ type: 'positive', message: t('reservations.detailDialog.updated') });
    emit('change');
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? t('reservations.detailDialog.updateFailed');
  } finally {
    enCours.value = '';
  }
}

async function annuler() {
  const ok = await confirmer({
    titre: t('reservations.detailDialog.cancelTitle'),
    message: t('reservations.detailDialog.cancelMessage'),
    ok: t('reservations.detailDialog.cancelReservation'),
    danger: true,
  });
  if (!ok) return;
  enCours.value = 'annuler';
  erreur.value = '';
  try {
    await api.delete(`/reservations/${props.reservation!.id}`, { silencieux: true });
    $q.notify({ type: 'positive', message: t('reservations.detailDialog.cancelled') });
    emit('change');
    emit('update:modelValue', false);
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? t('reservations.detailDialog.cancelFailed');
  } finally {
    enCours.value = '';
  }
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
  border-radius: var(--up-rayon-sm);
  text-transform: none;
  font-weight: 590;

  &--en_attente { background: $jaune-fond; color: $jaune-texte; }
  &--confirmee { background: $vert-fond; color: #{$vert}; }
  &--refusee,
  &--annulee { background: $rouge-fond; color: #{$rouge}; }
}

.detail-moi { color: var(--up-encre-douce); font-size: 0.8rem; }

.detail-section {
  border-top: var(--up-filet-fin);
  padding-top: var(--up-3);
}
</style>
