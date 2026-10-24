<template>
  <q-table
    v-if="mode === 'tableau'"
    flat
    bordered
    class="carte"
    :rows="rows"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :rows-per-page-options="[0]"
    :hide-bottom="chargement || rows.length > 0"
    @row-click="(_, row) => emit('ouvrir', row)"
  >
    <template #no-data>
      <etat-vide icone="forum" :titre="$t('reclamations.emptyState.message')" />
    </template>
    <template #body-cell-numero="p">
      <q-td :props="p" class="text-weight-medium">{{ p.row.numero }}</q-td>
    </template>
    <template #body-cell-type="p">
      <q-td :props="p">{{ libelleType(p.row.type) }}</q-td>
    </template>
    <template #body-cell-priorite="p">
      <q-td :props="p">
        <span class="reclamation-prio" :class="`prio-${p.row.priorite}`">
          <span class="pochoir">{{ libellePriorite(p.row.priorite) }}</span>
        </span>
      </q-td>
    </template>
    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="reclamation" :statut="p.row.statut" />
      </q-td>
    </template>
    <template #body-cell-auteur="p">
      <q-td :props="p">
        <span v-if="p.row.anonyme">{{ $t('reclamations.fields.anonyme') }}</span>
        <span v-else-if="p.row.etudiant"> {{ p.row.etudiant.prenom }} {{ p.row.etudiant.nom }} </span>
        <span v-else-if="p.row.nomAuteur">{{ p.row.nomAuteur }}</span>
        <span v-else class="text-grey-7">{{ $t('common.format.emptyValue') }}</span>
      </q-td>
    </template>
    <template #body-cell-activite="p">
      <q-td :props="p">
        <div>{{ dateHeureLisible(p.row.createdAt) }}</div>
        <div v-if="p.row.escaladeLe" class="text-caption text-warning">
          <q-icon name="priority_high" size="14px" />
          {{ $t('reclamations.fields.escaladeeLe', { date: dateHeureLisible(p.row.escaladeLe) }) }}
        </div>
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          round
          icon="visibility"
          :aria-label="$t('reclamations.ariaLabels.openDetail')"
          @click.stop="emit('ouvrir', p.row)"
        >
          <q-tooltip>{{ $t('reclamations.tooltips.detail') }}</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutEscalader && p.row.statut !== 'FERME' && p.row.statut !== 'REJETE' && p.row.statut !== 'RESOLU'"
          flat
          dense
          round
          icon="priority_high"
          color="warning"
          :aria-label="$t('reclamations.ariaLabels.escalate')"
          @click.stop="emit('escalader', p.row)"
        >
          <q-tooltip>{{ $t('reclamations.tooltips.escalate') }}</q-tooltip>
        </q-btn>
      </q-td>
    </template>
  </q-table>

  <div v-else class="row q-col-gutter-md">
    <div v-for="r in rows" :key="r.id" class="col-12 col-md-6 col-xl-4">
      <q-card flat bordered class="carte reclamation-carte">
        <q-card-section class="row items-start q-pb-sm">
          <div class="col">
            <div class="text-uppercase text-caption text-grey-7">{{ r.numero }}</div>
            <div class="text-subtitle1 text-weight-medium">
              {{ r.sujet }}
            </div>
            <div class="text-caption text-grey-7 q-mt-xs">{{ libelleType(r.type) }}</div>
          </div>
          <div class="column items-end q-gutter-xs">
            <PastilleStatut domaine="reclamation" :statut="r.statut" />
            <span class="reclamation-prio" :class="`prio-${r.priorite}`">
              <span class="pochoir">{{ libellePriorite(r.priorite) }}</span>
            </span>
          </div>
        </q-card-section>
        <q-card-section class="q-pt-none q-gutter-y-xs">
          <div class="row items-center">
            <q-icon name="person" size="16px" class="q-mr-sm text-grey-6" />
            <span class="text-caption">
              <span v-if="r.anonyme">{{ $t('reclamations.fields.anonyme') }}</span>
              <span v-else-if="r.etudiant">{{ r.etudiant.prenom }} {{ r.etudiant.nom }}</span>
              <span v-else>{{ $t('common.format.emptyValue') }}</span>
            </span>
          </div>
          <div v-if="r.departement" class="row items-center">
            <q-icon name="account_balance" size="16px" class="q-mr-sm text-grey-6" />
            <span class="text-caption">{{ r.departement.nom }}</span>
          </div>
          <div class="row items-center">
            <q-icon name="chat" size="16px" class="q-mr-sm text-grey-6" />
            <span class="text-caption">{{
              $t('reclamations.fields.messagesCount', { count: r._count?.messages ?? 0 })
            }}</span>
          </div>
          <div class="row items-center">
            <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
            <span class="text-caption">{{ dateHeureLisible(r.createdAt) }}</span>
          </div>
          <div v-if="r.escaladeLe" class="row items-center text-warning">
            <q-icon name="priority_high" size="16px" class="q-mr-sm" />
            <span class="text-caption">{{
              $t('reclamations.fields.escaladeeLe', { date: dateHeureLisible(r.escaladeLe) })
            }}</span>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-px-md">
          <q-btn flat dense no-caps icon="visibility" :label="$t('common.actions.detail')" @click="emit('ouvrir', r)" />
          <q-btn
            v-if="peutEscalader && r.statut !== 'FERME' && r.statut !== 'REJETE' && r.statut !== 'RESOLU'"
            flat
            dense
            no-caps
            color="warning"
            icon="priority_high"
            :label="$t('reclamations.actions.escalate')"
            @click="emit('escalader', r)"
          />
        </q-card-actions>
      </q-card>
    </div>
    <etat-vide
      v-if="!chargement && !rows.length"
      class="col-12"
      icone="forum"
      :titre="$t('reclamations.emptyState.message')"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Registre des réclamations, en lecture tableau ou en lecture cartes.
 *
 * Le composant ne fait aucune requête : la page détient la liste et le droit
 * d'escalader, la liste ne fait qu'afficher et remonter les intentions
 * (ouverture de la fiche, escalade).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type QTableColumn } from 'quasar';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { LIBELLE_PRIORITE_RECLAMATION, LIBELLE_TYPE_RECLAMATION, dateHeureLisible } from '@/shared/utils/libelles';
import type { PrioriteReclamation, Reclamation, TypeReclamation } from '../types';

defineProps<{
  /** Réclamations affichées. */
  rows: Reclamation[];
  /** Chargement en cours. */
  chargement: boolean;
  /** Présentation retenue : le tableau ou les cartes. */
  mode: 'tableau' | 'cartes';
  /** Seuls l'administration et la direction peuvent escalader. */
  peutEscalader: boolean;
}>();

const emit = defineEmits<{
  ouvrir: [reclamation: Reclamation];
  escalader: [reclamation: Reclamation];
}>();

const { t } = useI18n();

function libelleType(t: string) {
  return LIBELLE_TYPE_RECLAMATION[t as TypeReclamation] ?? t;
}
function libellePriorite(p: string) {
  return LIBELLE_PRIORITE_RECLAMATION[p as PrioriteReclamation] ?? p;
}

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left', sortable: true },
  { name: 'sujet', label: t('reclamations.table.columns.sujet'), field: 'sujet', align: 'left' },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'priorite', label: t('common.fields.priority'), field: 'priorite', align: 'left' },
  { name: 'auteur', label: t('reclamations.table.columns.auteur'), field: 'auteur', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  { name: 'activite', label: t('reclamations.table.columns.activite'), field: 'createdAt', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);
</script>

<style scoped lang="scss">
$encre: #1d1d1f;
$chaux-claire: #ffffff;
$vert: #007a4d;
$jaune-fonce: #8a6300;
$rouge: #ce1126;

.reclamation-prio {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  border-radius: var(--up-rayon-sm);
  font-size: 11px;
  font-weight: 590;
  letter-spacing: -0.01em;

  &.prio-BASSE {
    background: var(--up-gris-inerte);
    color: var(--up-encre);
    border: var(--up-filet);
  }
  &.prio-NORMALE {
    background: $jaune-fond;
    color: $jaune-texte;
  }
  &.prio-HAUTE {
    background: $rouge-fond;
    color: #{$rouge};
  }
  &.prio-URGENTE {
    background: $rouge-fond;
    color: #{$rouge};
    color: var(--up-encre);
    animation: clignote 1.4s ease-in-out infinite;
  }
}

.reclamation-carte {
  background: var(--up-plaque);
}

@keyframes clignote {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>
