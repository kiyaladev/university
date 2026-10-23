<template>
  <div>
    <q-table
      flat
      bordered
      class="carte"
      :rows="lignes"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 10 }"
    >
      <template #top-left>
        <div class="text-subtitle1 text-weight-medium">
          {{ dsi ? $t('helpdesk.myTicketsTable.titleAll') : $t('helpdesk.myTicketsTable.titleMine') }}
        </div>
      </template>
      <template #no-data>
        <etat-vide
          icone="assignment_turned_in"
          :titre="dsi ? $t('helpdesk.myTicketsTable.emptyAll') : $t('helpdesk.myTicketsTable.emptyMine')"
          :aide="$t('helpdesk.myTicketsTable.emptyHint')"
        />
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="ticket" :statut="p.row.statut" />
        </q-td>
      </template>
      <template #body-cell-priorite="p">
        <q-td :props="p">
          <span class="ticket-champ" :class="`prio-champ--${p.row.priorite}`">
            <span class="pochoir">{{ libellePriorite(p.row.priorite) }}</span>
          </span>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet « Mes tickets » de l'assistance : la liste des tickets de l'agent
 * (ou tous les tickets pour la DSI), paginée par le tableau.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { dateHeureLisible } from '@/shared/utils/format';
import { LIBELLE_CATEGORIE_INCIDENT, LIBELLE_PRIORITE_TICKET } from '@/shared/utils/libelles';
import type { TicketSupport } from '@/types';

defineProps<{
  lignes: TicketSupport[];
  chargement: boolean;
  /** La DSI voit tous les tickets, l'agent seulement les siens. */
  dsi: boolean;
}>();

const { t } = useI18n();

const libellePriorite = (p: string) => LIBELLE_PRIORITE_TICKET[p] ?? p;
const libelleCategorie = (c: string) => LIBELLE_CATEGORIE_INCIDENT[c] ?? c;

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left', sortable: true },
  {
    name: 'categorie',
    label: t('common.fields.category'),
    field: (r: TicketSupport) => libelleCategorie(r.categorie),
    align: 'left',
  },
  {
    name: 'equipement',
    label: t('helpdesk.table.columns.equipment'),
    field: (r: TicketSupport) => r.equipement?.libelle ?? '—',
    align: 'left',
  },
  { name: 'description', label: t('common.fields.description'), field: 'description', align: 'left' },
  { name: 'priorite', label: t('common.fields.priority'), field: 'priorite', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  {
    name: 'createdAt',
    label: t('common.fields.date'),
    field: (r: TicketSupport) => dateHeureLisible(r.createdAt),
    align: 'left',
  },
]);
</script>

<style scoped lang="scss">
.ticket-champ {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: var(--up-encre);
  border-radius: var(--up-rayon-sm);

  &.prio-champ--BASSE {
    background: var(--up-gris-inerte);
    color: var(--up-encre);
    border: var(--up-filet);
    box-shadow: none;
  }
  &.prio-champ--NORMALE {
    background: $jaune-fond;
    color: $jaune-texte;
  }
  &.prio-champ--HAUTE {
    background: $rouge-fond;
    color: #{$rouge};
  }
}
</style>
