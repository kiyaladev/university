<template>
  <div class="grille-cartes">
    <q-card v-for="e in enseignants" :key="e.id" flat bordered class="carte grille-cartes__carte">
      <q-card-section>
        <div class="row items-center q-mb-xs">
          <PastilleStatut domaine="enseignant" :statut="e.statut" />
          <q-badge v-if="!e.actif" color="grey-7">{{ $t('enseignants.table.inactive') }}</q-badge>
          <q-space />
          <div class="text-caption text-grey-7">{{ e.matricule }}</div>
        </div>
        <div class="text-subtitle1 text-weight-medium">{{ e.nom }} {{ e.prenom }}</div>
        <div class="text-caption text-grey-7">{{ e.grade || $t('enseignants.cards.gradeNonRenseigne') }}</div>
        <div class="text-caption text-grey-7">
          {{ e.departement?.nom ?? $t('enseignants.cards.sansDepartement') }}
        </div>
        <div class="text-caption text-grey-7 q-mt-sm">
          <q-icon name="call" size="14px" /> {{ e.telephone || '—' }}
          <span class="q-ml-sm">
            <q-icon
              :name="e.user ? 'check_circle' : 'remove_circle_outline'"
              :color="e.user ? 'positive' : 'grey-5'"
              size="14px"
            />
            {{ e.user ? $t('enseignants.cards.compteActif') : $t('enseignants.cards.sansCompte') }}
          </span>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn
          v-if="auth.peutPlanifier"
          flat
          dense
          no-caps
          icon="edit"
          :label="$t('common.actions.edit')"
          @click="emit('ouvrir', e)"
        />
        <actions-secondaires>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="assignment_ind"
            :label="$t('enseignants.cards.charges')"
            @click="emit('voirCharges', e)"
          />
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            color="primary"
            icon="verified_user"
            :label="$t('enseignants.cards.attestation')"
            @click="emit('ouvrirMoyens', e)"
          />
        </actions-secondaires>
      </q-card-actions>
    </q-card>
    <etat-vide v-if="!enseignants.length && !chargement" icone="person" :titre="messageVide">
      <template #action>
        <q-btn
          v-if="auth.peutPlanifier && !filtresActifs"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('enseignants.emptyState.createFirst')"
          @click="emit('ouvrir', null)"
        />
        <q-btn
          v-else-if="filtresActifs"
          flat
          no-caps
          icon="refresh"
          :label="$t('enseignants.emptyState.clearFilters')"
          @click="emit('reinitialiser')"
        />
      </template>
    </etat-vide>
  </div>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { useAuthStore } from '@/stores/auth';
import type { Enseignant } from '@/types';

/**
 * Vue en cartes des enseignants : une carte par enseignant, avec l'état, le
 * département et les actions principales. La page garde le registre (tableau),
 * les filtres et la pagination.
 */
defineProps<{
  /** Enseignants affichés. */
  enseignants: Enseignant[];
  /** Titre de l'état vide. */
  messageVide: string;
  /** Vrai quand un filtre réduit la liste. */
  filtresActifs: boolean;
  /** Vrai pendant un chargement : l'état vide attend. */
  chargement: boolean;
}>();

const emit = defineEmits<{
  ouvrir: [enseignant: Enseignant | null];
  voirCharges: [enseignant: Enseignant];
  ouvrirMoyens: [enseignant: Enseignant];
  reinitialiser: [];
}>();

const auth = useAuthStore();
</script>

<style scoped lang="scss">
.grille-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}

.grille-cartes__carte {
  background: var(--up-plaque);
}
</style>
