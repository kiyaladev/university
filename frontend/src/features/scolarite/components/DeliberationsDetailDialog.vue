<template>
  <q-dialog v-model="ouvert" :maximized="$q.screen.lt.md">
    <q-card style="width: 900px; max-width: 95vw">
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-h6">
            {{ $t('deliberations.detail.title', { promotion: detail?.promotion?.nom ?? '—' }) }}
          </div>
          <div class="text-caption text-grey-7">
            {{ LIBELLE_SESSION_DELIBERATION[detail?.session ?? 'NORMALE'] }} · {{ detail?.annee?.libelle ?? '—' }} ·
            {{ LIBELLE_STATUT_DELIBERATION[detail?.statut ?? 'BROUILLON'] }}
          </div>
        </div>
        <div class="col-auto">
          <q-btn
            v-if="peutVoirBulletins"
            outline
            no-caps
            icon="school"
            :label="$t('deliberations.actions.reportCards')"
            @click="emit('bulletins', detail)"
          />
        </div>
        <div class="col-auto">
          <q-btn
            outline
            no-caps
            icon="print"
            :label="$t('deliberations.actions.pv')"
            @click="emit('imprimer-pv', detail)"
          />
        </div>
        <div class="col-auto">
          <q-btn flat round dense icon="close" :aria-label="$t('deliberations.ariaLabels.close')" v-close-popup />
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-linear-progress v-if="chargementDetail" indeterminate color="primary" class="q-mb-sm" />
        <q-table flat bordered :rows="detailLignes" :columns="colonnes" row-key="id" :pagination="{ rowsPerPage: 0 }">
          <template #no-data>
            <etat-vide icone="how_to_reg" :titre="$t('deliberations.detail.emptyLines')" />
          </template>
          <template #body-cell-moyenne="p">
            <q-td :props="p" class="text-center chiffres">
              {{ p.row.moyenne !== null && p.row.moyenne !== undefined ? p.row.moyenne.toFixed(2) : '—' }}
            </q-td>
          </template>
          <template #body-cell-decision="p">
            <q-td :props="p">
              <PastilleStatut domaine="decision" :statut="p.row.decision" />
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                flat
                dense
                round
                icon="print"
                :aria-label="$t('deliberations.ariaLabels.printBulletin')"
                @click="emit('imprimer-bulletin', p.row)"
              >
                <q-tooltip>{{ $t('deliberations.tooltips.bulletinIndividuel') }}</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { LIBELLE_SESSION_DELIBERATION, LIBELLE_STATUT_DELIBERATION } from '@/shared/utils/libelles';
import type { DeliberationLigne } from '@/types';
import type { DeliberationListe } from '@/features/scolarite/types';

const $q = useQuasar();

const props = defineProps<{
  /** Délibération ouverte ; `null` tant que le détail n'est pas chargé. */
  detail: DeliberationListe | null;
  colonnes: QTableColumn[];
  /** Vrai pendant le rechargement du détail. */
  chargementDetail: boolean;
  peutVoirBulletins: boolean;
}>();

const emit = defineEmits<{
  bulletins: [deliberation: DeliberationListe | null];
  'imprimer-pv': [deliberation: DeliberationListe | null];
  'imprimer-bulletin': [ligne: DeliberationLigne];
}>();

const ouvert = defineModel<boolean>({ required: true });

const detailLignes = computed<DeliberationLigne[]>(() => props.detail?.lignes ?? []);
</script>
