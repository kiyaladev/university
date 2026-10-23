<template>
  <q-dialog v-model="ouvert">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section class="row items-center">
        <div class="col">
          <div class="text-h6">{{ etudiant?.nom }} {{ etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">
            {{ etudiant?.matricule }}
          </div>
        </div>
        <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" v-close-popup />
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-linear-progress
          :aria-label="$t('common.messages.loading')"
          v-if="chargement"
          indeterminate
          color="primary"
        />
        <div v-else-if="!etudiant" class="text-center q-pa-md text-grey-7">
          {{ $t('inscriptions.studentDialog.unavailable') }}
        </div>
        <q-list v-else separator dense>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('inscriptions.studentDialog.sex') }}</q-item-label>
              <q-item-label>{{ etudiant?.sexe ?? '—' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('inscriptions.studentDialog.birthDate') }}</q-item-label>
              <q-item-label>{{ dateLisible(etudiant?.dateNaissance) }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('common.fields.phone') }}</q-item-label>
              <q-item-label>{{ etudiant?.telephone ?? '—' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('common.fields.emailShort') }}</q-item-label>
              <q-item-label>{{ etudiant?.email ?? '—' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('inscriptions.studentDialog.address') }}</q-item-label>
              <q-item-label>{{ etudiant?.adresse ?? '—' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('inscriptions.studentDialog.portalAccount') }}</q-item-label>
              <q-item-label>
                {{ etudiant?.user ? etudiant.user.email : $t('inscriptions.studentDialog.none') }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat no-caps :label="$t('common.actions.close')" v-close-popup />
        <q-btn
          v-if="etudiant"
          flat
          no-caps
          icon="groups"
          :label="$t('inscriptions.studentDialog.registry')"
          @click="emit('ouvrirRegistre')"
        />
        <q-btn
          v-if="etudiant && peutGerer"
          flat
          no-caps
          icon="payments"
          :label="$t('inscriptions.studentDialog.hisPayments')"
          @click="emit('voirPaiements')"
        />
        <q-btn
          v-if="peutGerer && etudiant"
          color="primary"
          unelevated
          no-caps
          icon="edit"
          :label="$t('inscriptions.studentDialog.editRecord')"
          @click="emit('modifier')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Aperçu de la fiche d'un étudiant, ouvert depuis un dossier d'inscription.
 *
 * Le composant ne fait aucune requête : la page charge la fiche et décide des
 * Suites (registre, paiements, modification).
 */
import { dateLisible } from '@/shared/utils/libelles';
import type { Etudiant } from '@/types';

const ouvert = defineModel<boolean>({ required: true });

defineProps<{
  /** Fiche affichée ; `null` tant que le chargement n'a pas abouti. */
  etudiant: Etudiant | null;
  /** Chargement de la fiche en cours. */
  chargement: boolean;
  /** Droit d'encaisser et de modifier la fiche. */
  peutGerer: boolean;
}>();

const emit = defineEmits<{
  ouvrirRegistre: [];
  voirPaiements: [];
  modifier: [];
}>();
</script>
