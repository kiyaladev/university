<template>
  <section class="plaque carte-portail">
    <h2 class="pochoir section-titre">{{ $t('portail.sections.inscription.title') }}</h2>
    <template v-if="inscription">
      <div class="carte-portail__ligne">
        <span class="pochoir carte-portail__libelle">{{ $t('common.fields.status') }}</span>
        <PastilleStatut domaine="inscription" :statut="inscription.statut" />
      </div>
      <div class="carte-portail__ligne">
        <span class="pochoir carte-portail__libelle">{{ $t('portail.sections.inscription.promotion') }}</span>
        <span>{{ inscription.promotion.nom }}</span>
      </div>
      <div class="carte-portail__ligne">
        <span class="pochoir carte-portail__libelle">{{ $t('common.fields.year') }}</span>
        <span>{{ inscription.annee.libelle }}</span>
      </div>
      <div v-if="inscription.promotion.filiere" class="carte-portail__ligne">
        <span class="pochoir carte-portail__libelle">{{ $t('common.fields.filiere') }}</span>
        <span>{{ inscription.promotion.filiere }}</span>
      </div>
    </template>
    <p v-else class="carte-portail__vide">{{ $t('portail.sections.inscription.empty') }}</p>
  </section>
</template>

<script setup lang="ts">
/**
 * Inscription en cours de l'étudiant : promotion, année et filière.
 *
 * Le composant ne fait aucune requête : la page détient le dossier et lui
 * passe l'inscription (absente quand l'étudiant n'est inscrit nulle part).
 */
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import type { PortailProfil } from '../types';

defineProps<{
  inscription: PortailProfil['inscription'];
}>();
</script>

<style scoped lang="scss">
.carte-portail {
  padding: var(--up-4);
  display: flex;
  flex-direction: column;
  gap: var(--up-2);

  .section-titre {
    margin: 0 0 var(--up-2);
  }
}

.carte-portail__ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-2);
  flex-wrap: wrap;
  font-size: 0.95rem;
}

.carte-portail__libelle {
  color: var(--up-encre-douce);
}

.carte-portail__vide {
  color: var(--up-encre-douce);
  font-size: 0.9rem;
  margin: 0;
}
</style>
