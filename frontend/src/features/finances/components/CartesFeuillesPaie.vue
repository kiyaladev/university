<template>
  <div class="row q-col-gutter-md">
    <div v-for="f in lignes" :key="f.id" class="col-12 col-sm-6 col-md-4">
      <q-card flat bordered class="carte carte-feuille full-height" @click="emit('detail', f)">
        <q-card-section>
          <div class="row items-start no-wrap q-col-gutter-sm">
            <div class="col">
              <div class="text-h6">{{ f.libelle }}</div>
              <div class="text-caption text-grey-7">
                {{ dateLisible(f.dateDebut) }} {{ $t('common.format.emptyValue') }} {{ dateLisible(f.dateFin) }}
              </div>
            </div>
            <PastilleStatut domaine="paie" :statut="f.statut" />
          </div>
        </q-card-section>
        <q-card-section>
          <div class="row items-end justify-between">
            <div>
              <div class="text-caption text-grey-7">{{ $t('paie.card.totalAmount') }}</div>
              <div class="text-h6">{{ montantLisible(f.montantTotal) }} {{ $t('common.units.gnf') }}</div>
            </div>
            <div class="text-caption text-grey-7 text-right">
              {{ $t('paie.card.lignesCount', { count: f.lignes?.length ?? 0 }) }}<br />
              {{ f.creePar ? `${f.creePar.prenom} ${f.creePar.nom}` : '' }}
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <template v-if="peutCalculer(f)">
            <q-btn
              flat
              dense
              no-caps
              icon="refresh"
              :label="$t('common.actions.recalculate')"
              @click.stop="emit('recalculer', f)"
            />
          </template>
          <template v-if="peutValider(f)">
            <q-btn
              flat
              dense
              no-caps
              color="positive"
              icon="verified"
              :label="$t('common.actions.validate')"
              @click.stop="emit('valider', f)"
            />
          </template>
          <template v-if="peutPayer(f)">
            <q-btn flat dense no-caps icon="payments" :label="$t('paie.actions.markPaid')" @click.stop="emit('payer', f)" />
          </template>
          <q-btn
            v-if="peutImprimer"
            flat
            dense
            no-caps
            icon="print"
            :label="$t('common.actions.print')"
            @click.stop="emit('imprimer', f)"
          />
          <template v-if="peutSupprimer(f)">
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="delete"
              :aria-label="$t('paie.ariaLabels.delete', { libelle: f.libelle })"
              @click.stop="emit('supprimer', f)"
            />
          </template>
        </q-card-actions>
      </q-card>
    </div>
    <etat-vide
      v-if="!lignes.length && !chargement"
      class="col-12"
      icone="payments"
      :titre="$t('paie.emptyState.title')"
      :aide="`${$t('paie.emptyState.description')} ${aDesFiltres ? $t('paie.emptyState.filtered') : ''}`.trim()"
    >
      <template #action>
        <q-btn
          v-if="aDesFiltres"
          flat
          dense
          no-caps
          color="primary"
          icon="filter_alt_off"
          :label="$t('common.actions.clearFilters')"
          @click="emit('reinitialiser')"
        />
        <q-btn
          v-else-if="peutCreer"
          unelevated
          no-caps
          color="primary"
          icon="add"
          :label="$t('paie.actions.createFirst')"
          @click="emit('creer')"
        />
      </template>
    </etat-vide>
  </div>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { useAuthStore } from '@/stores/auth';
import {
  peutCalculerFeuille,
  peutPayerFeuille,
  peutSupprimerFeuille,
  peutValiderFeuille,
} from '../services/paie';
import { dateLisible, montantLisible } from '@/shared/utils/libelles';
import type { FeuillePaie } from '@/types';

defineProps<{
  lignes: FeuillePaie[];
  chargement: boolean;
  aDesFiltres: boolean;
  peutCreer: boolean;
  peutImprimer: boolean;
}>();

const emit = defineEmits<{
  detail: [FeuillePaie];
  recalculer: [FeuillePaie];
  valider: [FeuillePaie];
  payer: [FeuillePaie];
  imprimer: [FeuillePaie];
  supprimer: [FeuillePaie];
  reinitialiser: [];
  creer: [];
}>();

const auth = useAuthStore();

// Droits d'action, par rôle et par statut du cycle de vie.
const peutCalculer = (f: FeuillePaie) => peutCalculerFeuille(f, auth.peut('paie.calculer'));
const peutValider = (f: FeuillePaie) => peutValiderFeuille(f, auth.peut('paie.valider'));
const peutPayer = (f: FeuillePaie) => peutPayerFeuille(f, auth.peut('paie.payer'));
const peutSupprimer = (f: FeuillePaie) => peutSupprimerFeuille(f, auth.peut('paie.supprimer'));
</script>

<style scoped lang="scss">
.carte-feuille {
  cursor: pointer;
  transition: background var(--up-transition);

  &:hover {
    background: var(--up-craie);
  }
}
</style>
