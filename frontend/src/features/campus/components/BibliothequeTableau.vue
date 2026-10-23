<template>
  <q-table
    flat
    bordered
    class="carte"
    :rows="documents"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :rows-per-page-options="[0]"
    hide-bottom
  >
    <template #body-cell-type="p">
      <q-td :props="p">
        <q-chip dense outline color="primary" :label="LIBELLE_TYPE_DOCUMENT[p.row.type] ?? p.row.type" />
      </q-td>
    </template>
    <template #body-cell-titre="p">
      <q-td :props="p">
        <div class="text-weight-medium">{{ p.row.titre }}</div>
        <div v-if="p.row.auteurs" class="text-caption text-grey-7">{{ p.row.auteurs }}</div>
        <div v-if="p.row.motsClefs?.length" class="text-caption text-grey-7 q-mt-xs">
          <q-icon name="sell" size="13px" class="q-mr-xs" />
          <span v-for="(m, i) in p.row.motsClefs.slice(0, 4)" :key="m + i">
            {{ m }}<span v-if="i < Math.min(p.row.motsClefs.length, 4) - 1"> · </span>
          </span>
          <span v-if="p.row.motsClefs.length > 4"> +{{ p.row.motsClefs.length - 4 }}</span>
        </div>
      </q-td>
    </template>
    <template #body-cell-departement="p">
      <q-td :props="p">{{ p.row.departement?.nom ?? '—' }}</q-td>
    </template>
    <template #body-cell-taille="p">
      <q-td :props="p" class="text-right">
        <span v-if="p.row.tailleKo">{{
          $t('common.units.megabytes', { n: (p.row.tailleKo / 1024).toFixed(1) })
        }}</span>
        <span v-else>{{ $t('common.format.emptyValue') }}</span>
      </q-td>
    </template>
    <template #body-cell-publie="p">
      <q-td :props="p">
        <q-icon :name="p.row.public ? 'visibility' : 'visibility_off'" :color="p.row.public ? 'positive' : 'orange'" size="20px">
          <q-tooltip>{{
            p.row.public ? $t('bibliotheque.status.published') : $t('bibliotheque.status.unpublished')
          }}</q-tooltip>
        </q-icon>
      </q-td>
    </template>
    <template #body-cell-plagiat="p">
      <q-td :props="p">
        <q-badge
          v-if="p.row.indicePlagiat !== null && p.row.indicePlagiat !== undefined"
          :color="couleurPlagiat(p.row.indicePlagiat)"
          text-color="white"
          dense
        >
          <q-icon :name="iconePlagiat(p.row.indicePlagiat)" size="14px" class="q-mr-xs" />
          {{ p.row.indicePlagiat }}
          <q-tooltip v-if="p.row.indicePlagiat > 50" class="bg-negative text-white">
            {{ $t('bibliotheque.riskHighTooltip') }}
          </q-tooltip>
        </q-badge>
        <span v-else class="text-grey-6 text-caption">{{ $t('common.format.emptyValue') }}</span>
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          v-if="p.row.fichier"
          flat
          dense
          round
          icon="download"
          :aria-label="$t('bibliotheque.actionsColumn.downloadAria')"
          @click="emit('telecharger', p.row)"
        >
          <q-tooltip>{{ $t('common.actions.download') }}</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          round
          icon="visibility"
          :aria-label="$t('bibliotheque.actionsColumn.previewAria')"
          @click="emit('apercu', p.row)"
        >
          <q-tooltip>{{ $t('bibliotheque.actionsColumn.previewTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutGerer"
          flat
          dense
          round
          icon="edit"
          :aria-label="$t('bibliotheque.actionsColumn.editAria')"
          @click="emit('modifier', p.row)"
        >
          <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutGerer"
          flat
          dense
          round
          :icon="p.row.public ? 'visibility_off' : 'visibility'"
          :color="p.row.public ? 'orange' : 'primary'"
          :aria-label="
            p.row.public ? $t('bibliotheque.actionsColumn.unpublishAria') : $t('bibliotheque.actionsColumn.publishAria')
          "
          @click="emit('basculer', p.row)"
        >
          <q-tooltip>{{ p.row.public ? $t('common.actions.unpublish') : $t('common.actions.publish') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutVoirPlagiat && (p.row.indicePlagiat ?? 0) > 0"
          flat
          dense
          round
          icon="policy"
          :color="couleurPlagiat(p.row.indicePlagiat ?? 0)"
          :aria-label="$t('bibliotheque.actionsColumn.viewScoreAria')"
          @click="emit('score', p.row)"
        >
          <q-tooltip>{{ $t('bibliotheque.actionsColumn.viewScoreTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="estAdmin"
          flat
          dense
          round
          color="negative"
          icon="delete"
          :aria-label="$t('bibliotheque.actionsColumn.deleteAria')"
          @click="emit('supprimer', p.row)"
        >
          <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
/**
 * Vue tableau du fonds documentaire. La page garde la liste et les actions :
 * ce composant présente les lignes et rend les clics.
 */
import type { QTableColumn } from 'quasar';
import { LIBELLE_TYPE_DOCUMENT } from '@/shared/utils/libelles';
import { couleurPlagiat, iconePlagiat } from './BibliothequeAffiche';
import type { DocumentDepot } from '@/types';

defineProps<{
  documents: DocumentDepot[];
  colonnes: QTableColumn[];
  chargement: boolean;
  /** Modifier ou (dé)publier un document. */
  peutGerer: boolean;
  /** Voir le score de plagiat. */
  peutVoirPlagiat: boolean;
  /** Supprimer un document. */
  estAdmin: boolean;
}>();

const emit = defineEmits<{
  telecharger: [document: DocumentDepot];
  apercu: [document: DocumentDepot];
  modifier: [document: DocumentDepot];
  basculer: [document: DocumentDepot];
  score: [document: DocumentDepot];
  supprimer: [document: DocumentDepot];
}>();
</script>
