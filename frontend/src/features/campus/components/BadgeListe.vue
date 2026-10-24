<script setup lang="ts">
/**
 * Présentation des badges : le tableau pour les grands écrans, la grille de
 * cartes pour les écrans étroits. La page passe les lignes et reçoit les
 * clics ; le statut affiché (expiration calculée) est ici, car les deux
 * vues doivent dire la même chose.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { LIBELLE_TYPE_BADGE, dateLisible } from '@/shared/utils/libelles';
import type { BadgeAcces } from '@/types';

defineProps<{
  /** Badges à afficher (page du serveur). */
  badges: BadgeAcces[];
  /** Chargement en cours : l'état vide ne s'affiche qu'une fois la liste vide. */
  chargement: boolean;
  /** Droits d'écriture : sans eux, seuls l'impression et la lecture restent. */
  peutEditer: boolean;
}>();

const emit = defineEmits<{
  imprimer: [b: BadgeAcces];
  'ouvrir-edition': [b: BadgeAcces];
  'ouvrir-rallonge': [b: BadgeAcces];
  'ouvrir-annulation': [b: BadgeAcces];
}>();

const { t } = useI18n();
const modeVue = usePresentationListe();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left' },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'identite', label: t('common.fields.identity'), field: 'nom', align: 'left' },
  {
    name: 'organisation',
    label: t('badges.table.columns.organization'),
    field: 'organisation',
    align: 'left',
  },
  { name: 'validite', label: t('badges.table.columns.validity'), field: 'dateValidite', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

/**
 * La liste renvoie le statut stocké : le passage à EXPIRE n'est calculé par
 * l'API qu'à l'ouverture d'un badge. On applique ici la même règle pour ne pas
 * afficher « Actif » sur un badge dont la date est passée.
 */
function statutEffectif(b: BadgeAcces): string {
  if (b.statut === 'ANNULE') return 'ANNULE';
  return new Date(b.dateValidite) < new Date() ? 'EXPIRE' : 'ACTIF';
}
</script>

<template>
  <q-table
    v-if="modeVue === 'tableau'"
    flat
    bordered
    class="carte"
    :rows="badges"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :rows-per-page-options="[0]"
    :hide-bottom="chargement || badges.length > 0"
  >
    <template #no-data>
      <etat-vide icone="how_to_reg" :titre="$t('badges.emptyState.message')" />
    </template>
    <template #body-cell-type="p">
      <q-td :props="p">{{ LIBELLE_TYPE_BADGE[p.row.type] ?? p.row.type }}</q-td>
    </template>
    <template #body-cell-identite="p">
      <q-td :props="p">
        <strong>{{ p.row.prenom }} {{ p.row.nom }}</strong>
        <div v-if="p.row.fonction" class="text-caption text-grey-7">{{ p.row.fonction }}</div>
      </q-td>
    </template>
    <template #body-cell-organisation="p">
      <q-td :props="p">{{ p.row.organisation ?? '—' }}</q-td>
    </template>
    <template #body-cell-validite="p">
      <q-td :props="p"> {{ dateLisible(p.row.dateDelivrance) }} → {{ dateLisible(p.row.dateValidite) }} </q-td>
    </template>
    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="badge" :statut="statutEffectif(p.row)" />
        <div v-if="p.row.statut === 'ANNULE' && p.row.motif" class="text-caption text-grey-7">
          {{ p.row.motif }}
        </div>
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          no-caps
          dense
          icon="print"
          :aria-label="$t('badges.aria.printBadge')"
          :label="$t('badges.aria.printBadge')"
          @click="emit('imprimer', p.row)"
        >
          <q-tooltip>{{ $t('common.actions.print') }}</q-tooltip>
        </q-btn>
        <actions-secondaires>
          <q-btn
            v-close-popup
            v-if="peutEditer"
            flat
            no-caps
            dense
            icon="edit"
            :aria-label="$t('badges.aria.editBadge')"
            :label="$t('badges.aria.editBadge')"
            @click="emit('ouvrir-edition', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="peutEditer && p.row.statut !== 'ANNULE'"
            flat
            no-caps
            dense
            icon="schedule"
            :aria-label="$t('badges.aria.extendBadge')"
            :label="$t('badges.aria.extendBadge')"
            @click="emit('ouvrir-rallonge', p.row)"
          >
            <q-tooltip>{{ $t('badges.tooltips.extend') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="peutEditer && p.row.statut !== 'ANNULE'"
            flat
            no-caps
            dense
            icon="block"
            color="negative"
            :aria-label="$t('badges.aria.cancelBadge')"
            :label="$t('badges.aria.cancelBadge')"
            @click="emit('ouvrir-annulation', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.cancel') }}</q-tooltip>
          </q-btn>
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>

  <div v-else class="row q-col-gutter-md">
    <div v-for="b in badges" :key="b.id" class="col-12 col-sm-6 col-md-4">
      <q-card class="badge-carte">
        <q-card-section class="row items-center q-gutter-sm">
          <q-avatar size="56px" color="grey-3" text-color="primary">
            <img v-if="b.photoUrl" :src="b.photoUrl" :alt="`${b.prenom} ${b.nom}`" />
            <q-icon v-else name="badge" size="32px" />
          </q-avatar>
          <div class="col">
            <div class="text-weight-bold">{{ b.prenom }} {{ b.nom }}</div>
            <div class="text-caption text-grey-7">{{ b.organisation ?? '—' }}</div>
          </div>
          <PastilleStatut domaine="badge" :statut="statutEffectif(b)" />
        </q-card-section>
        <q-separator />
        <q-card-section class="text-caption">
          <q-chip dense :color="b.type === 'VIP' ? 'amber-7' : 'primary'" text-color="white">
            {{ LIBELLE_TYPE_BADGE[b.type] ?? b.type }}
          </q-chip>
          <div class="q-mt-sm">
            {{ $t('badges.card.issuedOn', { date: dateLisible(b.dateDelivrance) }) }}<br />
            <i18n-t keypath="badges.card.validUntil" tag="span">
              <template #date
                ><strong>{{ dateLisible(b.dateValidite) }}</strong></template
              >
            </i18n-t>
          </div>
          <div class="q-mt-sm">
            <code>{{ b.numero }}</code>
          </div>
          <div v-if="b.statut === 'ANNULE' && b.motif" class="q-mt-sm text-grey-7">
            {{ $t('badges.card.cancelReason', { reason: b.motif }) }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat dense icon="print" :label="$t('common.actions.print')" no-caps @click="emit('imprimer', b)" />
          <actions-secondaires>
            <q-btn
              v-close-popup
              v-if="peutEditer"
              flat
              dense
              icon="edit"
              :label="$t('badges.actions.edit')"
              no-caps
              @click="emit('ouvrir-edition', b)"
            />
            <q-btn
              v-close-popup
              v-if="peutEditer && b.statut !== 'ANNULE'"
              flat
              dense
              icon="schedule"
              :label="$t('badges.actions.extend')"
              no-caps
              @click="emit('ouvrir-rallonge', b)"
            />
            <q-btn
              v-close-popup
              v-if="peutEditer && b.statut !== 'ANNULE'"
              flat
              dense
              icon="block"
              color="negative"
              :label="$t('common.actions.cancel')"
              no-caps
              @click="emit('ouvrir-annulation', b)"
            />
          </actions-secondaires>
        </q-card-actions>
      </q-card>
    </div>
    <etat-vide
      v-if="!chargement && !badges.length"
      class="col-12"
      icone="how_to_reg"
      :titre="$t('badges.emptyState.message')"
    />
  </div>
</template>

<style scoped>
/* Pas d'arrondi : le badge est une plaque, comme les cartes étudiantes. */
.badge-carte {
  border: var(--up-filet-fin);
  height: 100%;
  background: var(--up-plaque);
}
</style>
