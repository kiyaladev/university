<template>
  <q-table
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
    <template #no-data>
      <etat-vide icone="verified_user" :titre="$t('attestations.emptyState.title')">
        <template v-if="peutEmettre" #action>
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('attestations.actions.issue')"
            class="q-mt-sm"
            @click="emit('emettre')"
          />
        </template>
      </etat-vide>
    </template>

    <template #body-cell-etudiant="p">
      <q-td :props="p">
        <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
        <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
      </q-td>
    </template>

    <template #body-cell-type="p">
      <q-td :props="p">{{ LIBELLE_TYPE_ATTESTATION[p.row.type] ?? p.row.type }}</q-td>
    </template>

    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="attestation" :statut="p.row.statut" />
      </q-td>
    </template>

    <template #body-cell-parcours="p">
      <q-td :props="p">
        <div>{{ p.row.annee?.libelle ?? '—' }}</div>
        <div class="text-caption text-grey-7">{{ p.row.promotion?.nom ?? '' }}</div>
      </q-td>
    </template>

    <template #body-cell-verifications="p">
      <q-td :props="p" class="text-center">
        <q-btn
          v-if="estAdmin"
          flat
          dense
          no-caps
          :label="String(p.row._count?.verifications ?? 0)"
          icon="qr_code_scanner"
          :aria-label="$t('attestations.actionsColumn.verificationsAria')"
          @click.stop="emit('verifications', p.row)"
        >
          <q-tooltip>{{ $t('attestations.actionsColumn.verificationsTooltip') }}</q-tooltip>
        </q-btn>
        <span v-else class="chiffres">{{ p.row._count?.verifications ?? 0 }}</span>
      </q-td>
    </template>

    <template #body-cell-emiseLe="p">
      <q-td :props="p">
        <div>{{ dateLisible(p.row.emiseLe) }}</div>
        <div class="text-caption text-grey-7">
          {{ p.row.emisePar ? `${p.row.emisePar.prenom} ${p.row.emisePar.nom}` : '—' }}
        </div>
      </q-td>
    </template>

    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          no-caps
          icon="qr_code_2"
          :aria-label="$t('attestations.actionsColumn.detailAria')"
          :label="$t('attestations.actionsColumn.detailAria')"
          @click.stop="emit('detail', p.row)"
        >
          <q-tooltip>{{ $t('attestations.actionsColumn.detailTooltip') }}</q-tooltip>
        </q-btn>
        <actions-secondaires>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="print"
            :aria-label="$t('attestations.actionsColumn.printAria')"
            :label="$t('attestations.actionsColumn.printAria')"
            @click.stop="emit('imprimer', p.row)"
          >
            <q-tooltip>{{ $t('attestations.actionsColumn.printTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="peutRevoquer && p.row.statut === 'EMIS'"
            flat
            dense
            no-caps
            color="negative"
            icon="block"
            :aria-label="$t('attestations.actionsColumn.revokeAria')"
            :label="$t('attestations.actionsColumn.revokeAria')"
            @click.stop="emit('revoquer', p.row)"
          >
            <q-tooltip>{{ $t('attestations.actionsColumn.revokeTooltip') }}</q-tooltip>
          </q-btn>
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import type { QTableColumn } from 'quasar';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { LIBELLE_TYPE_ATTESTATION } from '@/shared/utils/libelles';
import { dateLisible } from '@/shared/utils/format';
import type { Attestation } from '@/types';

defineProps<{
  lignes: Attestation[];
  colonnes: QTableColumn[];
  chargement: boolean;
  /** L'émission est proposée dans l'état vide quand l'utilisateur en a le droit. */
  peutEmettre: boolean;
  peutRevoquer: boolean;
  /** Le journal des vérifications n'est consultable que par un administrateur. */
  estAdmin: boolean;
}>();

const emit = defineEmits<{
  detail: [attestation: Attestation];
  verifications: [attestation: Attestation];
  imprimer: [attestation: Attestation];
  revoquer: [attestation: Attestation];
  emettre: [];
}>();
</script>
