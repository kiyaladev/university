<template>
  <q-dialog v-model="ouvert">
    <q-card style="width: 640px; max-width: 96vw">
      <q-card-section v-if="demande" class="row items-center no-wrap">
        <div class="col">
          <div class="text-h6">{{ demande.numero }}</div>
          <div class="text-caption text-grey-7">{{ libelleType(demande.type) }}</div>
        </div>
        <PastilleStatut domaine="demande" :statut="demande.statut" />
      </q-card-section>
      <q-card-section v-if="demande" class="q-pt-none">
        <etapes-circuit :etapes="ETAPES_DEMANDE" :actuel="demande.statut" :readonly="true" />
        <div class="demande-meta q-mt-md">
          <div>
            <span class="pochoir">{{ $t('common.fields.student') }}</span>
            <span v-if="demande.etudiant">
              {{ demande.etudiant.prenom }} {{ demande.etudiant.nom }} ({{ demande.etudiant.matricule }})
              <q-btn
                flat
                dense
                no-caps
                size="sm"
                icon="badge"
                :label="$t('demandeDocuments.detail.theirCard')"
                @click="emit('ouvrirCarte', demande)"
              />
            </span>
            <span v-else>{{ $t('common.format.emptyValue') }}</span>
          </div>
          <div>
            <span class="pochoir">{{ $t('demandeDocuments.detail.enrollment') }}</span>
            <span>{{ demande.inscription?.numero ?? '—' }}</span>
          </div>
          <div>
            <span class="pochoir">{{ $t('demandeDocuments.detail.fees') }}</span>
            <span class="chiffres"> {{ montantLisible(demande.frais) }} {{ demande.devise }} </span>
          </div>
          <div>
            <span class="pochoir">{{ $t('common.fields.payment') }}</span>
            <span v-if="demande.paiement">
              {{ demande.paiement.reference }} · {{ libellePaiement(demande.paiement.statut) }}
            </span>
            <span v-else class="text-grey-7">{{ $t('demandeDocuments.detail.paymentNotStarted') }}</span>
          </div>
          <div>
            <span class="pochoir">{{ $t('demandeDocuments.detail.processedBy') }}</span>
            <span v-if="demande.traitePar"> {{ demande.traitePar.prenom }} {{ demande.traitePar.nom }} </span>
            <span v-else>{{ $t('common.format.emptyValue') }}</span>
          </div>
          <div>
            <span class="pochoir">{{ $t('common.fields.createdOn') }}</span>
            <span>{{ dateHeureLisible(demande.createdAt) }}</span>
          </div>
          <div v-if="demande.remiseLe">
            <span class="pochoir">{{ $t('demandeDocuments.detail.handedOverOn') }}</span>
            <span>{{ dateHeureLisible(demande.remiseLe) }}</span>
          </div>
        </div>
        <div v-if="demande.motif" class="q-mt-md">
          <span class="section-titre">{{ $t('common.fields.motif') }}</span>
          <div class="demande-motif" style="white-space: pre-wrap">{{ demande.motif }}</div>
        </div>
        <div v-if="demande.notes" class="q-mt-md">
          <span class="section-titre">{{ $t('common.fields.notes') }}</span>
          <div class="demande-notes" style="white-space: pre-wrap">{{ demande.notes }}</div>
        </div>
        <div v-if="demande.notification" class="q-mt-md">
          <span class="section-titre">{{ $t('demandeDocuments.detail.smsNotification') }}</span>
          <div class="demande-notification" style="white-space: pre-wrap">{{ demande.notification }}</div>
        </div>
        <div class="row q-mt-md q-gutter-sm">
          <q-btn
            v-if="demande.statut === 'EN_ATTENTE_PAIEMENT'"
            unelevated
            color="positive"
            no-caps
            icon="verified"
            :label="$t('demandeDocuments.actionsColumn.confirmPayment')"
            :loading="enCours === 'confirmer'"
            @click="emit('confirmerPaiement', demande)"
          />
          <q-btn
            v-if="['PAYE', 'EN_TRAITEMENT'].includes(demande.statut)"
            unelevated
            color="primary"
            no-caps
            icon="play_arrow"
            :label="$t('demandeDocuments.actionsColumn.startProcessing')"
            :loading="enCours === 'traitement'"
            @click="emit('lancerTraitement', demande)"
          />
          <q-btn
            v-if="['PAYE', 'EN_TRAITEMENT'].includes(demande.statut)"
            unelevated
            color="positive"
            no-caps
            icon="check_circle"
            :label="$t('demandeDocuments.actionsColumn.markReady')"
            :loading="enCours === 'prete'"
            @click="emit('marquerPrete', demande)"
          />
          <q-btn
            v-if="demande.statut === 'PRET'"
            unelevated
            color="positive"
            no-caps
            icon="assignment_turned_in"
            :label="$t('demandeDocuments.actionsColumn.handOver')"
            :loading="enCours === 'remettre'"
            @click="emit('remettre', demande)"
          />
          <q-btn
            v-if="demande.statut !== 'REMISE' && demande.statut !== 'REJETE'"
            outline
            color="negative"
            no-caps
            icon="block"
            :label="$t('common.actions.reject')"
            :loading="enCours === 'rejeter'"
            @click="emit('rejeter', demande)"
          />
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Fiche d'une demande de document : le circuit de traitement, les métadonnées
 * et les actions de workflow.
 *
 * Le composant ne fait aucune requête : la page exécute les actions et
 * rafraîchit la fiche.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import EtapesCircuit from '@/shared/components/EtapesCircuit.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import {
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_TYPE_DEMANDE,
  dateHeureLisible,
  montantLisible,
} from '@/shared/utils/libelles';
import type { StatutPaiement } from '@/types';
import type { DemandeDocument, TypeDemandeDocument } from '../types';

const ouvert = defineModel<boolean>({ required: true });

defineProps<{
  /** Demande ouverte dans la fiche. */
  demande: DemandeDocument | null;
  /** Action de workflow en cours (`traitement`, `prete`, `remettre`…). */
  enCours: string;
}>();

const emit = defineEmits<{
  confirmerPaiement: [demande: DemandeDocument];
  lancerTraitement: [demande: DemandeDocument];
  marquerPrete: [demande: DemandeDocument];
  remettre: [demande: DemandeDocument];
  rejeter: [demande: DemandeDocument];
  ouvrirCarte: [demande: DemandeDocument];
}>();

const { t } = useI18n();

const ETAPES_DEMANDE = computed(() => [
  { identifiant: 'EN_ATTENTE_PAIEMENT', libelle: t('common.fields.payment'), icone: 'payments' },
  { identifiant: 'PAYE', libelle: t('demandeDocuments.steps.paid'), icone: 'verified' },
  { identifiant: 'EN_TRAITEMENT', libelle: t('demandeDocuments.steps.processing'), icone: 'build' },
  { identifiant: 'PRET', libelle: t('demandeDocuments.steps.ready'), icone: 'check_circle' },
  { identifiant: 'REMISE', libelle: t('demandeDocuments.steps.handedOver'), icone: 'task_alt' },
]);

function libelleType(t: string) {
  return LIBELLE_TYPE_DEMANDE[t as TypeDemandeDocument] ?? t;
}
function libellePaiement(s: StatutPaiement | string) {
  return LIBELLE_STATUT_PAIEMENT[s] ?? s;
}
</script>

<style scoped lang="scss">
.demande-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--up-2);
  background: rgba(16, 37, 30, 0.04);
  padding: var(--up-2);
  border-left: var(--up-filet);

  .pochoir {
    display: block;
    color: var(--up-encre-douce);
    margin-bottom: 2px;
  }
}

.demande-motif,
.demande-notes,
.demande-notification {
  background: var(--up-craie);
  border: var(--up-filet-fin);
  padding: var(--up-2);
  border-radius: var(--up-rayon-sm);
  font-size: 0.95rem;
}
</style>
