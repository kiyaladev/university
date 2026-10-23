<template>
  <div class="bulletins-cartes">
    <q-card
      v-for="l in lignes"
      :key="l.inscriptionId"
      flat
      bordered
      class="carte bulletins-cartes__carte"
      @click="emit('selectionner', l)"
    >
      <q-card-section>
        <div class="row items-center q-mb-xs">
          <PastilleStatut v-if="l.decision" domaine="decision" :statut="l.decision" />
          <q-badge v-else color="grey-6" :label="$t('bulletins.table.nonDelibere')" />
          <q-space />
          <div class="text-caption text-grey-7">{{ l.matricule }}</div>
        </div>
        <div class="text-subtitle1 text-weight-medium">{{ l.nom }} {{ l.prenom }}</div>
        <div class="row items-baseline q-gutter-md q-mt-sm">
          <div class="chiffres text-h6">
            {{ l.moyenne !== null ? l.moyenne.toFixed(2) : '—'
            }}<span class="text-caption">{{ $t('common.units.outOf20') }}</span>
          </div>
          <div class="text-caption text-grey-7">
            {{ $t('bulletins.cards.rang', { rang: l.rang ?? '—' }) }}{{ l.mention ? ` · ${l.mention}` : '' }}
          </div>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn
          flat
          dense
          no-caps
          icon="visibility"
          :label="$t('bulletins.cards.bulletin')"
          @click.stop="emit('selectionner', l)"
        />
        <actions-secondaires>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="picture_as_pdf"
            :label="$t('common.actions.print')"
            :disable="!l.deliberationId"
            @click.stop="emit('imprimer', l)"
          />
          <q-btn
            v-close-popup
            v-if="l.decision === 'ADMIS'"
            flat
            dense
            no-caps
            color="secondary"
            icon="verified_user"
            :label="$t('bulletins.cards.attestation')"
            @click.stop="emit('aller-attestation', l)"
          />
        </actions-secondaires>
      </q-card-actions>
    </q-card>
    <etat-vide v-if="!lignes.length" class="plaque" icone="school" :titre="$t('bulletins.table.emptyState')" />
  </div>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import type { LigneBulletin } from '@/features/scolarite/types';

defineProps<{
  lignes: LigneBulletin[];
}>();

const emit = defineEmits<{
  selectionner: [ligne: LigneBulletin];
  imprimer: [ligne: LigneBulletin];
  'aller-attestation': [ligne: LigneBulletin];
}>();
</script>

<style scoped lang="scss">
.bulletins-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.bulletins-cartes__carte {
  cursor: pointer;
}
</style>
