<template>
  <q-dialog :model-value="!!seance" @update:model-value="fermer">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section class="text-h6">{{ $t('seances.detail.title') }}</q-card-section>
      <q-card-section v-if="seance">
        <!-- Fiche à deux colonnes : le libellé tient sa colonne, la valeur la
             sienne. En dessous de 600 px les deux se superposent proprement
             au lieu de se marcher dessus. -->
        <dl class="fiche-detail">
          <dt class="pochoir">{{ $t('common.fields.teacher') }}</dt>
          <dd>{{ seance.affectation?.enseignant?.nom }} {{ seance.affectation?.enseignant?.prenom }}</dd>

          <dt class="pochoir">{{ $t('seances.detail.subjectPromotion') }}</dt>
          <dd>
            {{ seance.affectation?.matiere?.intitule }} {{ $t('common.format.emptyValue') }}
            {{ seance.affectation?.promotion?.nom }}
          </dd>

          <dt class="pochoir">{{ $t('seances.detail.courseType') }}</dt>
          <dd>{{ LIBELLE_TYPE_COURS[seance.type] ?? seance.type }}</dd>

          <dt class="pochoir">{{ $t('seances.detail.plannedSchedule') }}</dt>
          <dd class="chiffres">{{ seance.heureDebut }} – {{ seance.heureFin }}</dd>

          <dt class="pochoir">{{ $t('common.fields.room') }}</dt>
          <dd>
            <span v-if="seance.salle" class="plaque-salle">{{ seance.salle.code }}</span>
            <span v-else>{{ $t('common.format.emptyValue') }}</span>
          </dd>

          <dt class="pochoir">{{ $t('seances.detail.assignedController') }}</dt>
          <dd class="row items-center q-gutter-sm">
            <span>{{
              seance.controleurAssigne
                ? `${seance.controleurAssigne.prenom} ${seance.controleurAssigne.nom}`
                : $t('seances.detail.noAssignedController')
            }}</span>
            <q-btn
              v-if="peutAffecterControleur"
              flat
              dense
              no-caps
              icon="assignment_ind"
              :label="$t('seances.detail.assignController')"
              @click="emit('affecterControleur', seance)"
            />
          </dd>

          <template v-if="seance.justificatif">
            <dt class="pochoir">{{ $t('seances.detail.absenceJustification') }}</dt>
            <dd>
              {{ LIBELLE_STATUT_JUSTIFICATIF[seance.justificatif.statut] ?? seance.justificatif.statut }}
              <q-btn
                flat
                dense
                no-caps
                size="sm"
                icon="open_in_new"
                :label="$t('seances.detail.openFile')"
                :to="{ name: 'justificatifs', query: { statut: seance.justificatif.statut } }"
              />
            </dd>
          </template>

          <template v-if="seance.controle">
            <dt class="pochoir fiche-detail__coupure">{{ $t('seances.detail.actualCourse') }}</dt>
            <dd class="fiche-detail__coupure">
              <champ-statut :statut="seance.controle.statut" dense />
            </dd>

            <dt class="pochoir">{{ $t('seances.detail.actualSchedule') }}</dt>
            <dd class="chiffres">
              {{ seance.controle.heureArrivee ?? '—' }} → {{ seance.controle.heureFinReelle ?? '—' }} ({{
                dureeLisible(seance.controle.dureeMinutes)
              }})
            </dd>

            <dt class="pochoir">{{ $t('seances.detail.studentsPresent') }}</dt>
            <dd class="chiffres">{{ seance.controle.effectifPresent ?? '—' }}</dd>

            <dt class="pochoir">{{ $t('seances.detail.topicCovered') }}</dt>
            <dd>{{ seance.controle.thematiqueTraitee ?? '—' }}</dd>

            <dt class="pochoir">{{ $t('seances.detail.observation') }}</dt>
            <dd>{{ seance.controle.observation ?? '—' }}</dd>

            <dt class="pochoir">{{ $t('seances.detail.checkedBy') }}</dt>
            <dd>
              {{ seance.controle.controleur?.prenom }} {{ seance.controle.controleur?.nom }} ·
              <span class="chiffres">{{ dateHeureLisible(seance.controle.horodatage) }}</span>
            </dd>

            <dt class="pochoir">{{ $t('seances.detail.attestation') }}</dt>
            <dd>
              {{ LIBELLE_ATTESTATION[seance.controle.attestation ?? 'AUCUNE'] }}
              <span v-if="seance.controle.empreinteScore" class="chiffres">
                {{ $t('common.units.outOf100', { n: seance.controle.empreinteScore }) }}
              </span>
            </dd>

            <template v-if="seance.controle.signatureBase64">
              <dt class="pochoir">{{ $t('seances.detail.signature') }}</dt>
              <dd>
                <img
                  :src="seance.controle.signatureBase64"
                  class="signature-detail"
                  :alt="$t('seances.detail.signatureAlt')"
                />
              </dd>
            </template>
          </template>
        </dl>
      </q-card-section>
      <!-- Depuis une séance, on rejoint les deux lectures voisines : tout ce
           que cet enseignant a fait, et tout ce qui s'est tenu dans cette salle. -->
      <q-card-actions align="left" class="fiche-detail__liens">
        <q-btn
          v-if="seance?.affectation?.enseignantId"
          flat
          dense
          no-caps
          icon="person_pin"
          :label="$t('seances.detail.otherSessions')"
          @click="filtrer('enseignantId', seance.affectation!.enseignantId)"
        />
        <q-btn
          v-if="seance?.salle"
          flat
          dense
          no-caps
          icon="meeting_room"
          :label="$t('seances.detail.sessionsInRoom', { code: seance.salle.code })"
          @click="filtrer('salleId', seance.salle!.id)"
        />
      </q-card-actions>

      <q-card-actions align="right">
        <q-btn flat no-caps :label="$t('common.actions.close')" v-close-popup />
        <q-btn
          v-if="peutPointer && seance && seance.statut !== 'ANNULE'"
          unelevated
          color="primary"
          no-caps
          :label="seance?.controle ? $t('seances.detail.correctCheck') : $t('seances.detail.checkThisSession')"
          @click="pointer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import ChampStatut from './ChampStatut.vue';
import {
  LIBELLE_ATTESTATION,
  LIBELLE_STATUT_JUSTIFICATIF,
  LIBELLE_TYPE_COURS,
  dateHeureLisible,
  dureeLisible,
} from '@/shared/utils/libelles';
import type { Seance } from '@/types';

/**
 * Fiche d'une séance : ce qui était prévu, ce qui a été constaté.
 *
 * Le dialogue ne se ferme que par lui-même : le parent garde la séance
 * sélectionnée, c'est lui qui décide ce qu'il en fait ensuite.
 */
const props = defineProps<{
  seance: Seance | null;
  peutAffecterControleur: boolean;
  peutPointer: boolean;
}>();
const emit = defineEmits<{
  'update:seance': [Seance | null];
  affecterControleur: [Seance];
  pointer: [Seance];
  filtrer: [cle: 'enseignantId' | 'salleId', valeur: string];
}>();

function fermer() {
  emit('update:seance', null);
}

function pointer() {
  if (props.seance) emit('pointer', props.seance);
}

function filtrer(cle: 'enseignantId' | 'salleId', valeur: string) {
  emit('filtrer', cle, valeur);
}
</script>

<style scoped lang="scss">
// --------------------------------------------------------- fiche de détail
.fiche-detail {
  display: grid;
  grid-template-columns: minmax(112px, 33%) 1fr;
  gap: var(--up-2) var(--up-3);
  margin: 0;
  align-items: baseline;

  dt {
    color: var(--up-encre-douce);
    padding-top: 2px;
  }

  dd {
    margin: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .fiche-detail__coupure {
    border-top: var(--up-filet-fin);
    padding-top: var(--up-3);
  }
}

.fiche-detail__liens {
  border-top: var(--up-filet-fin);
  flex-wrap: wrap;
  gap: var(--up-2);
}

.signature-detail {
  max-height: 90px;
}

@media (max-width: 599px) {
  .fiche-detail {
    grid-template-columns: 1fr;
    gap: 2px;

    dd {
      text-align: left;
      margin-bottom: var(--up-2);
    }
  }
}
</style>
