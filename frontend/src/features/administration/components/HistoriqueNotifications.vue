<template>
  <barre-filtres
    v-model="filtresHistorique"
    :placeholder="$t('notifications.history.searchPlaceholder')"
    :recherche="true"
    @reinitialiser="reinitialiserHistorique"
  >
    <template #avances>
      <q-select
        v-model="filtresHistorique.statut"
        :options="optionsStatuts"
        dense
        outlined
        clearable
        emit-value
        map-options
        :label="$t('common.fields.status')"
      />
      <champ-date v-model="filtresHistorique.dateDebut" :label="$t('common.actions.from')" />
      <champ-date v-model="filtresHistorique.dateFin" :label="$t('common.actions.to')" />
    </template>
  </barre-filtres>

  <div class="text-caption text-grey-7 q-mb-sm">
    {{ $t('notifications.history.countLabel', { n: hist.total, periode: legendePeriode }) }}
  </div>

  <!-- Graphique de répartition -->
  <q-card v-if="chartConfig" flat bordered class="carte q-mb-md">
    <q-card-section>
      <div class="text-subtitle1 text-weight-medium">
        {{ $t('notifications.history.chart.title') }}
      </div>
      <div class="text-caption text-grey-7 q-mb-sm">
        {{ $t('notifications.history.chart.subtitle') }}
      </div>
      <graphique :config="chartConfig" :hauteur="220" role="img" :aria-label="resumeRepartition" />
    </q-card-section>
  </q-card>

  <q-table
    flat
    bordered
    class="carte"
    :rows="hist.lignes"
    :columns="colonnes"
    row-key="id"
    :loading="hist.chargement"
    :rows-per-page-options="[0]"
    :hide-bottom="hist.chargement || hist.lignes.length > 0"
  >
    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="notification" :statut="p.row.statut" />
        <q-tooltip v-if="p.row.erreur" class="notif-erreur">
          {{ p.row.erreur }}
        </q-tooltip>
      </q-td>
    </template>

    <template #body-cell-message="p">
      <q-td :props="p">
        <q-btn flat dense no-caps align="left" class="notifications__message">
          <span class="notifications__message-texte">{{ p.row.message }}</span>
          <q-tooltip :offset="[0, 8]" class="notifications__message-complet">{{ p.row.message }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>

    <template #body-cell-destinataire="p">
      <q-td :props="p">
        <div class="notifications__qui">
          <span v-if="p.row.destinataireNom">{{ p.row.destinataireNom }}</span>
          <span class="pochoir pochoir--brut chiffres">{{ p.row.telephone }}</span>
          <span v-if="p.row.etudiant?.matricule" class="pochoir pochoir--brut">
            {{ p.row.etudiant.matricule }}
          </span>
        </div>
      </q-td>
    </template>

    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          v-if="p.row.statut === 'ECHOUE'"
          flat
          dense
          round
          color="primary"
          icon="refresh"
          :aria-label="t('notifications.history.table.resendAria', { telephone: p.row.telephone })"
          :loading="renvoiEnCours === p.row.id"
          @click="renvoyer(p.row)"
        >
          <q-tooltip>{{ $t('notifications.history.table.resendTooltip') }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>

    <template #no-data>
      <etat-vide icone="sms" :titre="$t('notifications.history.emptyState.title')" :aide="aideVideHistorique">
        <template #action>
          <q-btn
            v-if="aDesFiltresHistorique"
            flat
            dense
            no-caps
            color="primary"
            icon="filter_alt_off"
            :label="$t('common.actions.clearFilters')"
            @click="reinitialiserHistorique"
          />
          <q-btn
            v-else
            flat
            dense
            no-caps
            color="primary"
            icon="campaign"
            :label="$t('notifications.history.emptyState.goToBroadcast')"
            @click="emit('allerDiffusion')"
          />
        </template>
      </etat-vide>
    </template>
  </q-table>

  <barre-pagination v-model:page="hist.page" v-model:page-size="hist.pageSize" :total="hist.total" :show-all="false" />
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import type { ChartConfiguration } from 'chart.js';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import Graphique from '@/shared/components/Graphique.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { LIBELLE_STATUT_NOTIFICATION, dateHeureLisible, dateLisible } from '@/shared/utils/libelles';
import type { Notification, StatutNotification, FiltresPage } from '@/types';
import { notificationsService } from '@/features/administration/services/notifications';

/**
 * Historique des notifications envoyées : filtres, graphique de répartition et
 * registre paginé.
 *
 * Le panneau expose `recharger()` : la page s'en sert pour remettre l'historique
 * à jour après un envoi venu du panneau de diffusion.
 */
defineProps<{
  /** Configuration du graphique de répartition des envois. */
  chartConfig?: ChartConfiguration | null;
  /** Alternative textuelle du graphique, pour qui ne voit pas les barres. */
  resumeRepartition?: string;
}>();

const emit = defineEmits<{ renvoi: []; allerDiffusion: [] }>();

const $q = useQuasar();
const { t } = useI18n();

// ------------------------------------------------------------- historique
const filtresHistorique = ref<FiltresPage>({ recherche: '', statut: null, dateDebut: '', dateFin: '' });
const hist = reactive(
  useListePaginee<Notification>({
    filtres: filtresHistorique,
    pageSize: 25,
    charger: ({ filtres: f, ...p }) =>
      notificationsService.historique({
        ...pageApi(p),
        statut: f.statut || undefined,
        search: texteApi(f.recherche),
        dateDebut: f.dateDebut || undefined,
        dateFin: f.dateFin || undefined,
      }),
  }),
);

const optionsStatuts = Object.entries(LIBELLE_STATUT_NOTIFICATION).map(([value, label]) => ({
  value: value as StatutNotification,
  label,
}));

const colonnes = computed<QTableColumn[]>(() => [
  {
    name: 'date',
    label: t('common.fields.date'),
    field: (r: Notification) => r.createdAt,
    format: (v: string) => dateHeureLisible(v),
    align: 'left',
    sortable: true,
  },
  {
    name: 'destinataire',
    label: t('notifications.history.table.columns.destinataire'),
    field: (r: Notification) => `${r.destinataireNom ?? ''} ${r.telephone}`,
    align: 'left',
  },
  { name: 'motif', label: t('common.fields.motif'), field: (r: Notification) => r.motif ?? '—', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: (r: Notification) => r.statut, align: 'left' },
  {
    name: 'message',
    label: t('notifications.history.table.columns.message'),
    field: (r: Notification) => r.message,
    align: 'left',
  },
  {
    name: 'envoyePar',
    label: t('notifications.history.table.columns.envoyePar'),
    field: (r: Notification) => r.envoyePar?.prenom ?? '',
    align: 'left',
  },
  {
    name: 'actions',
    label: '',
    field: 'id',
    align: 'right',
  },
]);

const aDesFiltresHistorique = computed(() => {
  const f = filtresHistorique.value;
  return !!(f.recherche || f.statut || f.dateDebut || f.dateFin);
});

const aideVideHistorique = computed(
  () =>
    `${t('notifications.history.emptyState.detail')} ${
      aDesFiltresHistorique.value
        ? t('notifications.history.emptyState.noneMatchFilters')
        : t('notifications.history.emptyState.startBroadcast')
    }`,
);

const legendePeriode = computed(() => {
  const f = filtresHistorique.value;
  if (f.dateDebut && f.dateFin) {
    return t('notifications.history.period.range', {
      debut: dateLisible(f.dateDebut),
      fin: dateLisible(f.dateFin),
    });
  }
  if (f.dateDebut) return t('notifications.history.period.since', { debut: dateLisible(f.dateDebut) });
  if (f.dateFin) return t('notifications.history.period.until', { fin: dateLisible(f.dateFin) });
  return t('notifications.history.period.all');
});

function reinitialiserHistorique() {
  hist.reinitialiser([]);
}

const renvoiEnCours = ref<string | null>(null);

/**
 * Renvoyer, c'est réémettre le même message au même numéro : la passerelle ne
 * sait pas rejouer un envoi consigné, on repasse donc par la diffusion
 * manuelle. La ligne échouée reste au registre — elle est l'historique — et le
 * nouvel envoi s'y ajoute.
 */
async function renvoyer(n: Notification) {
  renvoiEnCours.value = n.id;
  try {
    const data = await notificationsService.envoyer({
      message: n.message,
      motif: n.motif ?? 'AUTRE',
      mode: 'manuel',
      destinatairesTelephones: [n.telephone],
    });
    $q.notify({
      type: data.echouees ? 'warning' : 'positive',
      message: data.echouees
        ? t('notifications.messages.resendFailedAgain', { telephone: n.telephone })
        : t('notifications.messages.resendSuccess', { telephone: n.telephone }),
    });
    emit('renvoi');
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    renvoiEnCours.value = null;
  }
}

/** Recharge le registre — appelé par la page après un envoi. */
function recharger() {
  return hist.recharger();
}

defineExpose({ recharger });
</script>

<style scoped lang="scss">
.notifications__qui {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notifications__message {
  max-width: 340px;
  font-size: 0.86rem;
  text-transform: none;
  letter-spacing: 0;
}

.notifications__message-texte {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.notifications__message-complet {
  max-width: 420px;
  white-space: pre-wrap;
  font-size: 12px;
  text-transform: none;
  letter-spacing: 0;
}
</style>
