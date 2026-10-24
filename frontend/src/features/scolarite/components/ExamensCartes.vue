<template>
  <div class="row q-col-gutter-md">
    <div v-for="e in rows" :key="e.id" class="col-12 col-sm-6 col-md-4">
      <q-card flat bordered class="carte carte-examen full-height" @click="emit('ouvrirFiche', e)">
        <q-card-section>
          <div class="row items-start no-wrap q-col-gutter-sm">
            <div class="col">
              <div class="text-caption text-grey-7">{{ e.codeExamen }}</div>
              <div class="text-subtitle1 text-weight-bold">{{ e.intitule }}</div>
              <div class="text-caption">{{ e.matiere?.intitule ?? '—' }} · {{ e.promotion?.nom ?? '—' }}</div>
            </div>
            <PastilleStatut domaine="examen" :statut="e.statut" />
          </div>
        </q-card-section>
        <q-card-section>
          <div class="row q-col-gutter-sm text-caption">
            <div class="col-6"><q-icon name="event" size="14px" /> {{ dateLisible(e.dateExamen) }}</div>
            <div class="col-6 text-right">
              <q-icon name="schedule" size="14px" /> {{ e.heureDebut }}–{{ e.heureFin }}
            </div>
            <div class="col-6"><q-icon name="meeting_room" size="14px" /> {{ e.salle?.code ?? '—' }}</div>
            <div class="col-6 text-right">
              <q-chip dense size="sm" :color="e.nbPresents >= e.nbInscrits ? 'positive' : 'primary'">
                {{ e.nbPresents }} / {{ e.nbInscrits }}
              </q-chip>
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            v-if="e.statut === 'PLANIFIE' && peutDemarrer"
            flat
            dense
            no-caps
            icon="play_arrow"
            color="positive"
            :label="$t('common.actions.start')"
            @click.stop="emit('demarrer', e)"
          />
          <actions-secondaires>
            <q-btn
              v-close-popup
              v-if="e.statut === 'EN_COURS' && peutTerminer"
              flat
              dense
              no-caps
              icon="stop"
              color="negative"
              :label="$t('examens.actions.finish')"
              @click.stop="emit('terminer', e)"
            />
            <q-btn
              v-close-popup
              v-if="peutVoirTirage"
              flat
              dense
              no-caps
              icon="local_printshop"
              :label="$t('examens.actions.drawShort')"
              @click.stop="emit('tirage', e)"
            />
            <q-btn
              v-close-popup
              flat
              dense
              no-caps
              icon="qr_code_scanner"
              :label="$t('examens.actions.scanner')"
              @click.stop="emit('scan', e)"
            />
            <q-btn
              v-close-popup
              v-if="e.statut === 'PLANIFIE' && peutAnnuler"
              flat
              dense
              no-caps
              icon="block"
              color="negative"
              :label="$t('examens.actions.cancelExam')"
              @click.stop="emit('annuler', e)"
            />
          </actions-secondaires>
        </q-card-actions>
      </q-card>
    </div>
    <div v-if="!rows.length" class="col-12">
      <etat-vide class="plaque" icone="quiz" :titre="messageVide">
        <template #action>
          <q-btn
            v-if="peutCreer && surOngletPlanifie"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('examens.actions.schedule')"
            @click="emit('planifier')"
          />
        </template>
      </etat-vide>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { dateLisible } from '@/shared/utils/libelles';
import type { Examen } from '@/types';

defineProps<{
  rows: Examen[];
  messageVide: string;
  peutCreer: boolean;
  surOngletPlanifie: boolean;
  peutDemarrer: boolean;
  peutTerminer: boolean;
  peutAnnuler: boolean;
  peutVoirTirage: boolean;
}>();

const emit = defineEmits<{
  ouvrirFiche: [Examen];
  demarrer: [Examen];
  terminer: [Examen];
  annuler: [Examen];
  scan: [Examen];
  tirage: [Examen];
  planifier: [];
}>();
</script>

<style scoped lang="scss">
// La plaque est déjà cernée d'un filet entier : un bandeau latéral en plus
// ferait de la carte une languette, ce que le monde refuse.
.carte-examen {
  cursor: pointer;
  transition: background var(--up-transition);
  &:hover {
    background: var(--up-craie);
  }
}
</style>
