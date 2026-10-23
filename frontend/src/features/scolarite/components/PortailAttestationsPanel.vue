<template>
  <q-expansion-item
    class="plaque carte-portail carte-portail--large"
    :label="$t('portail.sections.attestations.title')"
  >
    <ul v-if="attestations.length" class="carte-portail__liste">
      <li
        v-for="a in attestations"
        :key="a.id"
        class="carte-portail__ligne"
        :class="{ 'carte-portail__ligne--revokee': a.statut === 'REVOQUE' }"
      >
        <span class="carte-portail__item-texte">
          <span class="lettrage carte-portail__item-titre">{{ LIBELLE_TYPE_ATTESTATION[a.type] }}</span>
          <span class="pochoir pochoir--brut chiffres carte-portail__date">
            {{ a.numero }} · {{ dateLisible(a.emiseLe) }}
            <span v-if="a.statut === 'REVOQUE'" class="text-negative">
              · {{ $t('portail.sections.attestations.revoked') }}</span
            >
          </span>
        </span>
        <q-btn
          unelevated
          color="primary"
          dense
          no-caps
          icon="visibility"
          :label="$t('portail.actions.view')"
          @click="emit('voir', a)"
        >
          <q-tooltip>{{ $t('portail.sections.attestations.viewTooltip') }}</q-tooltip>
        </q-btn>
      </li>
    </ul>
    <p v-else class="carte-portail__aucune">
      {{ $t('portail.sections.attestations.empty') }}
      <router-link to="/demandes-docs/mes" class="carte-portail__lien">
        {{ $t('portail.sections.attestations.emptyLink') }} </router-link
      >.
    </p>
    <p class="carte-portail__note">
      {{ $t('portail.sections.attestations.note') }}
      <router-link to="/verification" class="carte-portail__lien">
        {{ $t('portail.sections.attestations.noteLink') }} </router-link
      >.
    </p>
  </q-expansion-item>
</template>

<script setup lang="ts">
/**
 * Attestations de scolarité de l'étudiant : liste, statut et impression.
 *
 * Le composant ne fait aucune requête : la page détient les attestations et
 * ouvre l'impression sur demande.
 */
import { dateLisible } from '@/shared/utils/format';
import { LIBELLE_TYPE_ATTESTATION } from '@/shared/utils/libelles';
import type { AttestationPortail } from '../types';

defineProps<{
  attestations: AttestationPortail[];
}>();

const emit = defineEmits<{
  /** Demande d'ouverture de l'impression d'une attestation. */
  voir: [attestation: AttestationPortail];
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

.carte-portail--large {
  grid-column: 1 / -1;
}

.carte-portail__liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.carte-portail__ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-2);
  flex-wrap: wrap;
  font-size: 0.95rem;
}

.carte-portail__date {
  color: var(--up-encre-douce);
}

.carte-portail__aucune {
  color: var(--up-encre-douce);
  font-size: 0.9rem;
  margin: 0;
}

// ---------------------------------------------------------- attestations
.carte-portail__item-texte {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.carte-portail__item-titre {
  font-size: 0.92rem;
}

.carte-portail__ligne--revokee {
  opacity: 0.55;
}

.carte-portail__note {
  color: var(--up-encre-douce);
  font-size: 0.85rem;
  margin: var(--up-2) 0 0;
  border-top: var(--up-filet-fin);
  padding-top: var(--up-2);
}

.carte-portail__lien {
  color: inherit;
  text-decoration: underline;

  &:hover,
  &:focus-visible {
    color: var(--up-encre);
  }
}
</style>
