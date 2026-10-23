<template>
  <div class="paiements-cartes">
    <q-card v-for="p in lignes" :key="p.id" flat bordered class="carte paiements-cartes__carte">
      <q-card-section>
        <div class="row items-center q-mb-xs">
          <PastilleStatut domaine="paiement" :statut="p.statut" />
          <span class="champ badge-source q-ml-xs" :class="`badge-source--${sourceDe(p).toLowerCase()}`">
            {{ libelleSource(p) }}
          </span>
          <q-space />
          <div class="text-caption text-grey-7">{{ p.reference }}</div>
        </div>
        <div class="text-subtitle1 text-weight-medium">{{ p.etudiant?.nom }} {{ p.etudiant?.prenom }}</div>
        <div class="text-caption text-grey-7">
          {{ p.etudiant?.matricule }}
          <span v-if="p.inscription?.numero"> · {{ p.inscription.numero }}</span>
        </div>
        <div class="row q-mt-sm q-col-gutter-sm">
          <div class="col-6">
            <div class="text-caption text-grey-7">{{ $t('paiements.cards.mode') }}</div>
            <div class="text-weight-medium">
              {{ LIBELLE_MODE_PAIEMENT[p.mode] ?? p.mode }}
            </div>
            <div class="text-caption text-grey-7">
              {{ p.operateur ? (LIBELLE_OPERATEUR_MM[p.operateur] ?? p.operateur) : '—' }}
            </div>
          </div>
          <div class="col-6 text-right">
            <div class="text-caption text-grey-7">{{ $t('common.fields.amount') }}</div>
            <div class="text-weight-medium lettrage chiffres">{{ montantLisible(p.montant) }} {{ p.devise }}</div>
          </div>
        </div>
        <div class="text-caption text-grey-7 q-mt-xs">
          {{ dateHeureLisible(p.horodatage) }}
        </div>
        <div v-if="p.transactionId" class="text-caption text-grey-7">
          {{ $t('paiements.cards.transaction', { id: p.transactionId }) }}
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-gutter-xs">
        <q-btn
          flat
          dense
          color="primary"
          icon="info"
          no-caps
          :label="$t('common.actions.details')"
          @click="emit('detail', p)"
        />
        <actions-secondaires>
          <q-btn
            v-close-popup
            v-if="moduleOuvert(p)"
            flat
            dense
            color="primary"
            icon="open_in_new"
            no-caps
            :label="$t('paiements.cards.openModule', { module: libelleSource(p) })"
            @click="emit('module', p)"
          />
          <q-btn
            v-close-popup
            v-if="peutSimuler(p)"
            flat
            dense
            color="positive"
            icon="check"
            no-caps
            :label="$t('paiements.cards.success')"
            @click="emit('simuler', p, 'REUSSI')"
          />
          <q-btn
            v-close-popup
            v-if="peutSimuler(p)"
            flat
            dense
            color="negative"
            icon="close"
            no-caps
            :label="$t('paiements.cards.failed')"
            @click="emit('simuler', p, 'ECHOUE')"
          />
          <q-btn
            v-close-popup
            v-if="peutAnnuler(p)"
            flat
            dense
            color="negative"
            icon="block"
            no-caps
            :label="$t('common.actions.cancel')"
            @click="emit('annuler', p)"
          />
          <q-btn
            v-close-popup
            v-if="p.inscription || p.inscriptionId"
            flat
            dense
            icon="how_to_reg"
            no-caps
            :label="$t('paiements.cards.enrollment')"
            @click="emit('inscription', p)"
          />
          <q-btn
            v-close-popup
            v-if="p.etudiant"
            flat
            dense
            icon="person"
            no-caps
            :label="$t('common.fields.student')"
            @click="emit('etudiant', p)"
          />
        </actions-secondaires>
      </q-card-actions>
    </q-card>
    <etat-vide v-if="!lignes.length" icone="payments" :titre="messageVide">
      <template #action>
        <div class="q-gutter-sm">
          <q-btn
            v-if="filtresActifs"
            outline
            no-caps
            icon="refresh"
            :label="$t('common.actions.reset_filters')"
            @click="emit('reinitialiser')"
          />
          <q-btn
            v-if="peutCreer"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('paiements.actions.new')"
            @click="emit('creer')"
          />
        </div>
      </template>
    </etat-vide>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import { useAuthStore } from '@/stores/auth';
import { peutAnnulerPaiement, peutSimulerPaiement, routeModule, sourceDe } from '../services/paiements';
import { LIBELLE_MODE_PAIEMENT, LIBELLE_OPERATEUR_MM, dateHeureLisible, montantLisible } from '@/shared/utils/libelles';
import type { Paiement } from '@/types';

const props = defineProps<{
  lignes: Paiement[];
  messageVide: string;
  filtresActifs: boolean;
  peutCreer: boolean;
  /** Écrans de gestion ouverts au rôle, par portefeuille. */
  modulesOuverts: Record<string, boolean>;
}>();

const emit = defineEmits<{
  detail: [Paiement];
  inscription: [Paiement];
  etudiant: [Paiement];
  module: [Paiement];
  simuler: [Paiement, 'REUSSI' | 'ECHOUE'];
  annuler: [Paiement];
  reinitialiser: [];
  creer: [];
}>();

const auth = useAuthStore();
const { t } = useI18n();

const libelleSource = (p: Paiement) => t(`paiements.sources.${sourceDe(p)}`);

/** Lien vers le module qui gère le paiement, si l'utilisateur peut l'ouvrir. */
const moduleOuvert = (p: Paiement) => routeModule(p, props.modulesOuverts);

const peutSimuler = (p: Paiement) => peutSimulerPaiement(p, auth.peut('paiements.simuler'));
const peutAnnuler = (p: Paiement) => peutAnnulerPaiement(p, auth.peut('paiements.annuler'));
</script>

<style scoped lang="scss">
.paiements-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--up-3);
}
.paiements-cartes__carte {
  background: var(--up-plaque);
}

.champ.badge-source {
  display: inline-flex;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 590;
  white-space: nowrap;
  background: #e8e8ed;
  color: #33463f;
}
.badge-source--inscription {
  background: #e3ecf7;
  color: #15518f;
}
</style>
