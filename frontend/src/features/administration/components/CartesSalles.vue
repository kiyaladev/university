<template>
  <div class="row q-col-gutter-md">
    <div v-for="s in salles" :key="s.id" class="col-12 col-sm-6 col-md-4 col-lg-3">
      <q-card flat bordered class="carte full-height">
        <q-card-section class="row items-start">
          <div class="col">
            <div class="text-h6">{{ s.code }}</div>
            <div class="text-caption text-grey-7">{{ s.nom }}</div>
            <div class="text-caption text-grey-7">{{ s.batiment ?? '—' }}</div>
          </div>
          <q-badge :color="s.actif ? 'positive' : 'grey-7'">
            {{ s.actif ? $t('salles.card.active') : $t('salles.card.inactive') }}
          </q-badge>
        </q-card-section>

        <q-card-section v-if="peutGerer" class="text-center q-pt-none">
          <canvas :ref="(el) => enregistrerCanvas(el, s)" :aria-label="$t('salles.card.qrAria', { code: s.code })" />
          <div class="text-caption text-grey-6 ellipsis">{{ s.qrToken }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none text-caption">
          <div><q-icon name="groups" size="14px" /> {{ s.capacite }} {{ $t('salles.card.capacitySuffix') }}</div>
          <div v-if="s.latitude">
            <q-icon name="my_location" size="14px" />
            {{ s.latitude.toFixed(4) }}, {{ s.longitude?.toFixed(4) }}
            {{ $t('common.units.radius', { n: s.rayonMetres }) }}
          </div>
          <div v-else class="text-grey-6">
            <q-icon name="location_off" size="14px" /> {{ $t('salles.card.noGpsMark') }}
          </div>
        </q-card-section>

        <q-separator />
        <q-card-actions align="right">
          <q-btn
            flat
            dense
            round
            icon="event_note"
            :aria-label="$t('salles.roomActions.viewSessionsAria')"
            @click="emit('voir-seances', s)"
          >
            <q-tooltip>{{ $t('salles.roomActions.viewSessionsTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            :aria-label="$t('salles.roomActions.printPosterAria')"
            @click="emit('imprimer', s.id)"
          >
            <q-tooltip>{{ $t('salles.roomActions.printPosterTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="autorenew"
            :aria-label="$t('salles.roomActions.regenerateAria')"
            @click="emit('regenerer', s)"
          >
            <q-tooltip>{{ $t('salles.roomActions.regenerateTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('salles.roomActions.editAria')"
            @click="emit('modifier', s)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutSupprimer"
            flat
            dense
            round
            color="negative"
            icon="delete"
            :aria-label="$t('salles.roomActions.deleteAria')"
            @click="emit('supprimer', s)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-card>
    </div>
    <etat-vide
      v-if="!salles.length && !chargement"
      class="col-12"
      icone="meeting_room"
      :titre="titreVide"
    >
      <template #action>
        <q-btn
          v-if="peutGerer && !filtresActifs"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('salles.emptyState.createFirst')"
          @click="emit('creer')"
        />
        <q-btn
          v-else-if="filtresActifs"
          flat
          no-caps
          icon="refresh"
          :label="$t('common.actions.reset_filters')"
          @click="emit('reinitialiser')"
        />
      </template>
    </etat-vide>
  </div>
</template>

<script setup lang="ts">
import { nextTick, watch } from 'vue';
import QRCode from 'qrcode';
import EtatVide from '@/shared/components/EtatVide.vue';
import type { Salle } from '@/types';

/**
 * Vue cartes des salles : chaque plaque montre le QR tel qu'il sera affiché
 * à l'entrée de la salle.
 */
const props = defineProps<{
  salles: Salle[];
  chargement: boolean;
  peutGerer: boolean;
  peutSupprimer: boolean;
  titreVide: string;
  filtresActifs: boolean;
}>();

const emit = defineEmits<{
  creer: [];
  reinitialiser: [];
  'voir-seances': [salle: Salle];
  imprimer: [salleId: string];
  regenerer: [salle: Salle];
  modifier: [salle: Salle];
  supprimer: [salle: Salle];
}>();

/** Dessine le QR de la salle dans sa carte. */
const canvasParSalle = new Map<string, HTMLCanvasElement>();

function enregistrerCanvas(el: unknown, salle: Salle) {
  if (!el) {
    canvasParSalle.delete(salle.id);
    return;
  }
  canvasParSalle.set(salle.id, el as HTMLCanvasElement);
  void QRCode.toCanvas(el as HTMLCanvasElement, salle.qrToken, { width: 132, margin: 1 });
}

function dessinerTousLesQr() {
  for (const salle of props.salles) {
    const el = canvasParSalle.get(salle.id);
    if (el) void QRCode.toCanvas(el, salle.qrToken, { width: 132, margin: 1 });
  }
}

// Les jetons changent (régénération) ou la page affichée change : on redessine.
watch(
  () => props.salles.map((s) => `${s.id}:${s.qrToken}`).join('|'),
  () => void nextTick(dessinerTousLesQr),
);
</script>
