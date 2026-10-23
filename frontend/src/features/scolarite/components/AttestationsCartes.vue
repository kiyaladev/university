<template>
  <div class="attestations-cartes">
    <q-card
      v-for="a in lignes"
      :key="a.id"
      flat
      bordered
      class="carte attestations-cartes__carte"
      @click="emit('detail', a)"
    >
      <q-card-section>
        <div class="row items-center q-mb-xs">
          <PastilleStatut domaine="attestation" :statut="a.statut" />
          <q-space />
          <div class="text-caption text-grey-7">{{ a.numero }}</div>
        </div>
        <div class="text-subtitle1 text-weight-medium">{{ a.etudiant?.nom }} {{ a.etudiant?.prenom }}</div>
        <div class="text-caption text-grey-7">{{ a.etudiant?.matricule }}</div>
        <div class="q-mt-sm text-caption">
          {{ LIBELLE_TYPE_ATTESTATION[a.type] ?? a.type }} · {{ a.annee?.libelle ?? '—'
          }}{{ a.promotion?.nom ? ` · ${a.promotion.nom}` : '' }}
        </div>
        <div class="text-caption text-grey-7 q-mt-xs">
          {{ $t('attestations.card.issuedOn', { date: dateLisible(a.emiseLe), count: a._count?.verifications ?? 0 }) }}
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn
          flat
          dense
          no-caps
          icon="qr_code_2"
          :label="$t('attestations.actions.qr')"
          @click.stop="emit('detail', a)"
        />
        <actions-secondaires>
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="print"
            :label="$t('common.actions.print')"
            @click.stop="emit('imprimer', a)"
          />
          <q-btn
            v-close-popup
            v-if="peutRevoquer && a.statut === 'EMIS'"
            flat
            dense
            no-caps
            color="negative"
            icon="block"
            :label="$t('common.actions.revoke')"
            @click.stop="emit('revoquer', a)"
          />
        </actions-secondaires>
      </q-card-actions>
    </q-card>
    <etat-vide
      v-if="!chargement && !lignes.length"
      class="plaque"
      icone="verified_user"
      :titre="$t('attestations.emptyState.title')"
    />
  </div>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { LIBELLE_TYPE_ATTESTATION } from '@/shared/utils/libelles';
import { dateLisible } from '@/shared/utils/format';
import type { Attestation } from '@/types';

defineProps<{
  lignes: Attestation[];
  chargement: boolean;
  peutRevoquer: boolean;
}>();

const emit = defineEmits<{
  detail: [attestation: Attestation];
  imprimer: [attestation: Attestation];
  revoquer: [attestation: Attestation];
}>();
</script>

<style scoped lang="scss">
.attestations-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.attestations-cartes__carte {
  cursor: pointer;
}
</style>
