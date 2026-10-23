<template>
  <div class="row q-col-gutter-md">
    <div v-for="d in rows" :key="d.id" class="col-12 col-md-6 col-xl-4">
      <q-card flat bordered class="carte">
        <q-card-section class="row items-start q-pb-none">
          <div class="col">
            <div class="text-uppercase text-caption text-grey-7">{{ d.numero }}</div>
            <div class="text-subtitle1 text-weight-medium">{{ libelleType(d.type) }}</div>
            <div v-if="d.etudiant" class="text-caption text-grey-7">
              {{ d.etudiant.prenom }} {{ d.etudiant.nom }} · {{ d.etudiant.matricule }}
            </div>
          </div>
          <PastilleStatut domaine="demande" :statut="d.statut" />
        </q-card-section>
        <q-card-section class="q-pt-sm q-gutter-y-xs">
          <div class="row items-center">
            <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
            <span class="text-caption">{{ dateHeureLisible(d.createdAt) }}</span>
          </div>
          <div class="row items-center">
            <q-icon name="payments" size="16px" class="q-mr-sm text-grey-6" />
            <span class="text-caption chiffres">
              {{ montantLisible(d.frais) }} {{ d.devise }}
              <q-icon
                v-if="d.paiement?.statut === 'REUSSI'"
                name="check_circle"
                color="positive"
                size="14px"
                class="q-ml-xs"
              />
              <q-icon
                v-else-if="d.paiement?.statut === 'EN_ATTENTE'"
                name="hourglass_top"
                color="warning"
                size="14px"
                class="q-ml-xs"
              />
            </span>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-gutter-xs">
          <q-btn
            v-if="['PAYE', 'EN_TRAITEMENT'].includes(d.statut)"
            flat
            dense
            no-caps
            icon="play_arrow"
            :label="$t('demandeDocuments.cardActions.process')"
            :loading="enCours === 'traitement'"
            @click.stop="emit('lancerTraitement', d)"
          />
          <q-btn
            v-if="['PAYE', 'EN_TRAITEMENT'].includes(d.statut)"
            flat
            dense
            no-caps
            icon="check_circle"
            color="positive"
            :label="$t('demandeDocuments.cardActions.ready')"
            :loading="enCours === 'prete'"
            @click.stop="emit('marquerPrete', d)"
          />
          <q-btn
            v-if="d.statut === 'PRET'"
            flat
            dense
            no-caps
            icon="assignment_turned_in"
            color="positive"
            :label="$t('demandeDocuments.actionsColumn.handOver')"
            :loading="enCours === 'remettre'"
            @click.stop="emit('remettre', d)"
          />
          <actions-secondaires>
            <q-btn
              v-close-popup
              v-if="d.statut === 'EN_ATTENTE_PAIEMENT'"
              flat
              dense
              no-caps
              icon="verified"
              color="positive"
              :label="$t('common.actions.confirm')"
              :loading="enCours === 'confirmer'"
              @click.stop="emit('confirmerPaiement', d)"
            />
            <q-btn
              v-close-popup
              v-if="d.statut !== 'REMISE' && d.statut !== 'REJETE'"
              flat
              dense
              no-caps
              icon="block"
              color="negative"
              :label="$t('common.actions.reject')"
              :loading="enCours === 'rejeter'"
              @click.stop="emit('rejeter', d)"
            />
            <q-btn
              v-close-popup
              flat
              dense
              no-caps
              icon="visibility"
              :label="$t('common.actions.detail')"
              @click.stop="emit('selectionner', d)"
            />
          </actions-secondaires>
        </q-card-actions>
      </q-card>
    </div>
    <etat-vide
      v-if="!chargement && !rows.length"
      class="col-12"
      icone="description"
      :titre="$t('demandeDocuments.emptyState.message')"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Registre des demandes de documents, en lecture cartes.
 *
 * Même contrat que le tableau : aucune requête ici, la page détient la liste
 * et l'action en cours.
 */
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { LIBELLE_TYPE_DEMANDE, dateHeureLisible, montantLisible } from '@/shared/utils/libelles';
import type { DemandeDocument, TypeDemandeDocument } from '../types';

defineProps<{
  /** Demandes affichées. */
  rows: DemandeDocument[];
  /** Chargement en cours. */
  chargement: boolean;
  /** Action de workflow en cours (`traitement`, `prete`, `remettre`…). */
  enCours: string;
}>();

const emit = defineEmits<{
  selectionner: [demande: DemandeDocument];
  lancerTraitement: [demande: DemandeDocument];
  marquerPrete: [demande: DemandeDocument];
  remettre: [demande: DemandeDocument];
  confirmerPaiement: [demande: DemandeDocument];
  rejeter: [demande: DemandeDocument];
}>();

function libelleType(t: string) {
  return LIBELLE_TYPE_DEMANDE[t as TypeDemandeDocument] ?? t;
}
</script>
