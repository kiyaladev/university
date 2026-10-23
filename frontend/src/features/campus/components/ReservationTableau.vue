<template>
  <q-table
    :grid="$q.screen.lt.md"
    flat
    bordered
    class="carte"
    :rows="reservations"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :rows-per-page-options="[0]"
    :hide-bottom="chargement || reservations.length > 0"
  >
    <template #item="p">
      <div class="col-12 q-pb-sm">
        <q-card flat bordered class="carte">
          <q-card-section>
            <div v-for="c in p.cols.filter((c) => c.name !== 'actions')" :key="c.name" class="q-mb-sm">
              <div class="text-caption text-grey-7">{{ c.label }}</div>
              <template v-if="c.name === 'creneau'">
                {{ dateLisible(p.row.dateJour) }} · {{ p.row.heureDebut }}–{{ p.row.heureFin }}
              </template>
              <template v-else-if="c.name === 'salle'">{{ p.row.salle?.code }} · {{ p.row.salle?.nom }}</template>
              <template v-else-if="c.name === 'statut'">{{ LIBELLE_STATUT_RESERVATION[p.row.statut] }}</template>
              <span v-else>{{ c.value }}</span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              dense
              round
              icon="visibility"
              :aria-label="$t('reservations.table.viewDetail')"
              @click="emit('ouvrir', p.row)"
            >
              <q-tooltip>{{ $t('reservations.table.viewDetailTooltip') }}</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
    </template>
    <template #body-cell-creneau="p">
      <q-td :props="p">
        <div class="chiffres">{{ p.row.heureDebut }}–{{ p.row.heureFin }}</div>
        <div class="text-caption text-grey-7">{{ dateLisible(p.row.dateJour) }}</div>
      </q-td>
    </template>
    <template #body-cell-salle="p">
      <q-td :props="p">
        <div class="text-weight-medium">{{ p.row.salle?.code }}</div>
        <div class="text-caption text-grey-7">{{ p.row.salle?.nom }}</div>
      </q-td>
    </template>
    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="reservation" :statut="p.row.statut" />
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          round
          icon="visibility"
          :aria-label="$t('reservations.table.viewDetail')"
          @click="emit('ouvrir', p.row)"
        >
          <q-tooltip>{{ $t('reservations.table.viewDetailTooltip') }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>
    <template #no-data>
      <etat-vide
        icone="event_busy"
        :titre="$t('reservations.emptyState.title')"
        :aide="$t('reservations.emptyState.description')"
      >
        <template #action>
          <q-btn
            v-if="peutReserver"
            flat
            no-caps
            color="primary"
            icon="event_available"
            :label="$t('reservations.actions.reserve')"
            @click="emit('reserver')"
          />
        </template>
      </etat-vide>
    </template>
  </q-table>
</template>

<script setup lang="ts">
/**
 * Vue tableau de la liste des réservations de la période.
 *
 * Le composant ne connaît que la liste à afficher : la page garde l'état
 * (filtres, période, chargement) et n'écoute que deux événements — l'ouverture
 * du détail et la demande de réservation depuis l'état vide.
 */
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { dateLisible } from '@/shared/utils/format';
import { LIBELLE_STATUT_RESERVATION } from '@/shared/utils/libelles';
import type { ReservationSalle } from '@/types';

defineProps<{
  /** Réservations de la période, déjà triées. */
  reservations: ReservationSalle[];
  /** Chargement en cours. */
  chargement: boolean;
  /** L'utilisateur courant a-t-il le droit de déposer une demande ? */
  peutReserver: boolean;
}>();

const emit = defineEmits<{ ouvrir: [ReservationSalle]; reserver: [] }>();

const $q = useQuasar();
const { t } = useI18n();

const colonnes = computed(() => [
  { name: 'creneau', label: t('reservations.table.columns.slot'), field: 'dateJour', align: 'left' as const },
  { name: 'salle', label: t('common.fields.room'), field: 'salle', align: 'left' as const },
  { name: 'motif', label: t('common.fields.motif'), field: 'motif', align: 'left' as const },
  {
    name: 'organisme',
    label: t('reservations.table.columns.organization'),
    field: 'organisme',
    align: 'left' as const,
  },
  {
    name: 'responsable',
    label: t('reservations.table.columns.responsible'),
    field: 'responsable',
    align: 'left' as const,
  },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
]);
</script>
