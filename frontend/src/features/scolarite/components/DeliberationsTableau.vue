<template>
  <q-table
    :grid="$q.screen.lt.md"
    flat
    bordered
    class="carte"
    :rows="lignes"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :pagination="{ rowsPerPage: 0 }"
    @row-click="(_, row) => emit('detail', row)"
  >
    <template #item="p">
      <div class="col-12 q-pb-sm">
        <q-card flat bordered class="carte">
          <q-card-section>
            <div v-for="c in colonnesSansActions(p.cols)" :key="c.name" class="q-mb-sm">
              <div class="text-caption text-grey-7">{{ c.label }}</div>
              <template v-if="c.name === 'session'">{{
                LIBELLE_SESSION_DELIBERATION[p.row.session] ?? p.row.session
              }}</template>
              <template v-else-if="c.name === 'statut'">{{
                LIBELLE_STATUT_DELIBERATION[p.row.statut] ?? p.row.statut
              }}</template>
              <template v-else-if="c.name === 'taux'">{{
                p.row.tauxReussite == null ? '—' : pourcentLisible(p.row.tauxReussite)
              }}</template>
              <template v-else-if="c.name === 'effectif'">{{ p.row._count?.lignes ?? 0 }}</template>
              <template v-else-if="c.name === 'creeLe'">{{ dateLisible(p.row.creeLe) }}</template>
              <span v-else>{{ c.value }}</span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              dense
              no-caps
              icon="visibility"
              :aria-label="$t('deliberations.ariaLabels.detail')"
              :label="$t('deliberations.ariaLabels.detail')"
              @click.stop="emit('detail', p.row)"
            >
              <q-tooltip>{{ $t('deliberations.tooltips.detail') }}</q-tooltip>
            </q-btn>
            <actions-secondaires>
              <q-btn
                v-close-popup
                v-if="p.row.statut === 'BROUILLON' && peutSaisir"
                flat
                dense
                no-caps
                icon="replay"
                color="primary"
                :aria-label="$t('deliberations.ariaLabels.recalculate')"
                :label="$t('deliberations.ariaLabels.recalculate')"
                @click.stop="emit('calculer', p.row)"
              >
                <q-tooltip>{{ $t('deliberations.tooltips.recalculate') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-close-popup
                v-if="p.row.statut === 'BROUILLON' && estJury"
                flat
                dense
                no-caps
                icon="verified_user"
                color="positive"
                :label="$t('deliberations.actions.validateJury')"
                @click.stop="emit('valider', p.row)"
              />
              <q-btn
                v-if="peutVoirBulletins"
                v-close-popup
                flat
                dense
                no-caps
                icon="school"
                color="primary"
                :aria-label="$t('deliberations.ariaLabels.reportCards')"
                :label="$t('deliberations.ariaLabels.reportCards')"
                @click.stop="emit('bulletins', p.row)"
              >
                <q-tooltip>{{ $t('deliberations.tooltips.reportCards') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-close-popup
                flat
                dense
                no-caps
                icon="print"
                :aria-label="$t('deliberations.ariaLabels.printPv')"
                :label="$t('deliberations.ariaLabels.printPv')"
                @click.stop="emit('imprimer-pv', p.row)"
              >
                <q-tooltip>{{ $t('deliberations.tooltips.printPv') }}</q-tooltip>
              </q-btn>
            </actions-secondaires>
          </q-card-actions>
        </q-card>
      </div>
    </template>
    <template #no-data>
      <etat-vide icone="gavel" :titre="$t('deliberations.emptyState.message')">
        <template #action>
          <q-btn
            v-if="peutSaisir"
            unelevated
            color="primary"
            no-caps
            icon="gavel"
            :label="$t('deliberations.actions.newDeliberation')"
            @click="emit('creer')"
          />
        </template>
      </etat-vide>
    </template>

    <template #body-cell-session="p">
      <q-td :props="p">{{ LIBELLE_SESSION_DELIBERATION[p.row.session] ?? p.row.session }}</q-td>
    </template>

    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="deliberation" :statut="p.row.statut" />
      </q-td>
    </template>

    <template #body-cell-taux="p">
      <q-td :props="p" class="text-center">
        <template v-if="p.row.tauxReussite !== null && p.row.tauxReussite !== undefined">
          {{ pourcentLisible(p.row.tauxReussite) }}
        </template>
        <template v-else>{{ $t('common.format.emptyValue') }}</template>
      </q-td>
    </template>

    <template #body-cell-effectif="p">
      <q-td :props="p" class="text-center chiffres">{{ p.row._count?.lignes ?? 0 }}</q-td>
    </template>

    <template #body-cell-creeLe="p">
      <q-td :props="p">{{ dateLisible(p.row.creeLe) }}</q-td>
    </template>

    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          no-caps
          icon="visibility"
          :aria-label="$t('deliberations.ariaLabels.detail')"
          :label="$t('deliberations.ariaLabels.detail')"
          @click.stop="emit('detail', p.row)"
        >
          <q-tooltip>{{ $t('deliberations.tooltips.detail') }}</q-tooltip>
        </q-btn>
        <actions-secondaires>
          <q-btn
            v-close-popup
            v-if="p.row.statut === 'BROUILLON' && peutSaisir"
            flat
            dense
            no-caps
            icon="replay"
            color="primary"
            :aria-label="$t('deliberations.ariaLabels.recalculate')"
            :label="$t('deliberations.ariaLabels.recalculate')"
            @click.stop="emit('calculer', p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.recalculate') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="p.row.statut === 'BROUILLON' && estJury"
            flat
            dense
            no-caps
            icon="verified_user"
            color="positive"
            :label="$t('deliberations.actions.validateJury')"
            @click.stop="emit('valider', p.row)"
          />
          <q-btn
            v-if="peutVoirBulletins"
            v-close-popup
            flat
            dense
            no-caps
            icon="school"
            color="primary"
            :aria-label="$t('deliberations.ariaLabels.reportCards')"
            :label="$t('deliberations.ariaLabels.reportCards')"
            @click.stop="emit('bulletins', p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.reportCards') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="print"
            :aria-label="$t('deliberations.ariaLabels.printPv')"
            :label="$t('deliberations.ariaLabels.printPv')"
            @click.stop="emit('imprimer-pv', p.row)"
          >
            <q-tooltip>{{ $t('deliberations.tooltips.printPv') }}</q-tooltip>
          </q-btn>
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { useQuasar, type QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { LIBELLE_SESSION_DELIBERATION, LIBELLE_STATUT_DELIBERATION } from '@/shared/utils/libelles';
import { colonnesSansActions } from '@/shared/utils/colonnes';
import { dateLisible, pourcentLisible } from '@/shared/utils/format';
import type { DeliberationListe } from '@/features/scolarite/types';

const $q = useQuasar();

defineProps<{
  lignes: DeliberationListe[];
  colonnes: QTableColumn[];
  chargement: boolean;
  /** Le jury peut recalculer une délibération encore brouillon. */
  peutSaisir: boolean;
  /** Le jury valide les résultats. */
  estJury: boolean;
  peutVoirBulletins: boolean;
}>();

const emit = defineEmits<{
  detail: [deliberation: DeliberationListe];
  calculer: [deliberation: DeliberationListe];
  valider: [deliberation: DeliberationListe];
  bulletins: [deliberation: DeliberationListe];
  'imprimer-pv': [deliberation: DeliberationListe];
  creer: [];
}>();
</script>
