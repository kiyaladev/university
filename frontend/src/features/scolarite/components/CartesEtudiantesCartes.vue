<template>
  <div class="row q-col-gutter-md">
    <div v-for="c in rows" :key="c.id" class="col-12 col-sm-6 col-md-4">
      <q-card class="carte-carte">
        <q-card-section class="row items-center q-gutter-sm">
          <q-avatar size="56px" color="grey-3" text-color="primary">
            <img v-if="c.photoUrl" :src="c.photoUrl" :alt="`${c.etudiant?.prenom}`" />
            <q-icon v-else name="person" size="32px" />
          </q-avatar>
          <div class="col">
            <div class="text-weight-bold">{{ c.etudiant?.prenom }} {{ c.etudiant?.nom }}</div>
            <div class="text-caption text-grey-7">
              {{ $t('carteEtudiante.table.columns.matricule') }} <code>{{ c.etudiant?.matricule }}</code>
            </div>
          </div>
          <PastilleStatut domaine="carte" :statut="c.statut" />
        </q-card-section>
        <q-separator />
        <q-card-section class="text-caption">
          {{ $t('carteEtudiante.card.issuedOn', { date: dateLisible(c.dateEmission) }) }}<br />
          {{ $t('carteEtudiante.card.validUntil', { date: dateLisible(c.dateValidite) }) }}
          <div v-if="c.motifRevocation" class="text-grey-7 q-mt-xs">
            {{ $t('carteEtudiante.card.revocationReason', { motif: c.motifRevocation }) }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            flat
            dense
            icon="qr_code_2"
            :label="$t('carteEtudiante.cardActions.qr')"
            no-caps
            @click="emit('detail', c)"
          />
          <actions-secondaires>
            <q-btn
              v-close-popup
              flat
              dense
              icon="print"
              :label="$t('common.actions.print')"
              no-caps
              @click="emit('imprimer', c)"
            />
            <q-btn
              v-close-popup
              v-if="peutModifier && c.statut === 'EMIS'"
              flat
              dense
              icon="edit"
              :label="$t('common.actions.edit')"
              no-caps
              @click="emit('modifier', c)"
            />
            <q-btn
              v-close-popup
              v-if="c.statut === 'EMIS' && peutRevoquer"
              flat
              dense
              icon="block"
              color="negative"
              :label="$t('common.actions.revoke')"
              no-caps
              @click="emit('revoquer', c)"
            />
          </actions-secondaires>
        </q-card-actions>
      </q-card>
    </div>
    <etat-vide
      v-if="!chargement && !rows.length"
      class="col-12"
      icone="badge"
      :titre="$t('carteEtudiante.emptyState.message')"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Registre des cartes étudiantes, en lecture cartes.
 *
 * Le composant ne fait aucune requête : la page détient la liste, les filtres
 * et les droits ; les cartes ne font que les afficher et remonter les
 * intentions (QR, impression, édition, révocation).
 */
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { dateLisible } from '@/shared/utils/format';
import type { CarteEtudiante } from '@/types';

defineProps<{
  rows: CarteEtudiante[];
  chargement: boolean;
  /** Droit de modifier une carte. */
  peutModifier: boolean;
  /** Droit de révoquer une carte. */
  peutRevoquer: boolean;
}>();

const emit = defineEmits<{
  /** Ouverture de la fiche QR d'une carte. */
  detail: [carte: CarteEtudiante];
  imprimer: [carte: CarteEtudiante];
  modifier: [carte: CarteEtudiante];
  revoquer: [carte: CarteEtudiante];
}>();
</script>

<style scoped>
/* Pas d'arrondi : la carte est une plaque, comme partout ailleurs. */
.carte-carte {
  border: var(--up-filet-fin);
  height: 100%;
  background: var(--up-plaque);
}
</style>
