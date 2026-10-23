<template>
  <q-dialog v-model="ouvert">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ paiement?.reference }}</div>
        <div class="text-caption text-grey-7">
          {{
            paiement
              ? `${LIBELLE_MODE_PAIEMENT[paiement.mode] ?? paiement.mode} · ${LIBELLE_STATUT_PAIEMENT[paiement.statut] ?? paiement.statut}`
              : ''
          }}
        </div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-list separator dense>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('paiements.detail.studentFile') }}</q-item-label>
              <q-item-label>
                {{ paiement?.etudiant ? `${paiement.etudiant.nom} ${paiement.etudiant.prenom}` : '—' }}
                {{ paiement?.inscription?.numero ? ` · ${paiement.inscription.numero}` : '' }}
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('common.fields.amount') }}</q-item-label>
              <q-item-label>{{ montantLisible(paiement?.montant) }} {{ paiement?.devise }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('paiements.detail.transaction') }}</q-item-label>
              <q-item-label>{{ paiement?.transactionId ?? $t('paiements.detail.transactionNone') }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('paiements.detail.operatorPhone') }}</q-item-label>
              <q-item-label>
                {{ paiement?.operateur ? (LIBELLE_OPERATEUR_MM[paiement.operateur] ?? paiement.operateur) : '—' }}
                · {{ paiement?.telephone ?? '—' }}
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('common.fields.motif') }}</q-item-label>
              <q-item-label>{{ paiement?.motif ?? '—' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('paiements.detail.timestamp') }}</q-item-label>
              <q-item-label>{{ paiement ? dateHeureLisible(paiement.horodatage) : '—' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('paiements.detail.createdBy') }}</q-item-label>
              <q-item-label>
                {{
                  paiement?.creePar
                    ? `${paiement.creePar.prenom} ${paiement.creePar.nom}`
                    : $t('paiements.detail.createdByFallback')
                }}
                {{
                  paiement?.completeLe
                    ? $t('paiements.detail.completedOn', { date: dateHeureLisible(paiement.completeLe) })
                    : ''
                }}
                {{
                  paiement?.motifAnnulation
                    ? $t('paiements.detail.cancelReason', { reason: paiement.motifAnnulation })
                    : ''
                }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_OPERATEUR_MM,
  LIBELLE_STATUT_PAIEMENT,
  dateHeureLisible,
  montantLisible,
} from '@/shared/utils/libelles';
import type { Paiement } from '@/types';

defineProps<{
  paiement: Paiement | null;
}>();

const ouvert = defineModel<boolean>('ouvert', { required: true });
</script>
