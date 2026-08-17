<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)" @show="charger">
    <q-card style="width: 880px; max-width: 95vw">
      <q-card-section v-if="chargementInitial" class="text-center q-pa-xl">
        <q-spinner size="32px" />
      </q-card-section>
      <template v-else-if="courrier">
        <q-card-section class="row items-start no-wrap q-col-gutter-md">
          <div class="col">
            <div class="text-caption text-grey-7">{{ courrier.numero }}</div>
            <div class="text-h6">{{ courrier.objet }}</div>
            <div class="text-caption q-mt-xs">
              {{ courrier.type === 'ENTRANT' ? `Expéditeur : ${courrier.expediteur ?? '—'}` : `Destinataire : ${courrier.destinataire ?? '—'}` }}
            </div>
          </div>
          <span class="champ badge-statut" :class="classeStatut(courrier.statut)">
            {{ libelleStatut(courrier.statut) }}
          </span>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <workflow-stepper
            :etapes="etapesWorkflow"
            :actuel="etapeActuelle"
            :readonly="!aRoleAutorise"
            @transition="demanderTransition"
          />

          <q-markup-table dense flat bordered class="q-mt-md">
            <thead>
              <tr>
                <th class="text-left">#</th>
                <th class="text-left">Rôle</th>
                <th class="text-left">Valideur</th>
                <th class="text-left">Statut</th>
                <th class="text-left">Paraphé le</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(etape, idx) in courrier.circuits ?? []" :key="etape.id">
                <td>{{ etape.ordre }}</td>
                <td>{{ etape.roleValideur ?? '—' }}</td>
                <td>{{ etape.valideur ? `${etape.valideur.prenom} ${etape.valideur.nom}` : '' }}</td>
                <td>
                  <q-badge :color="couleurStatut(etape.statut)" :label="libelleStatut(etape.statut)" />
                </td>
                <td>{{ etape.parapheLe ? dateHeureLisible(etape.parapheLe) : '—' }}</td>
                <td class="text-right">
                  <q-btn
                    v-if="etape.statut === 'EN_CIRCUIT' && aRoleAutorise"
                    flat
                    dense
                    no-caps
                    icon="draw"
                    color="primary"
                    label="Parapher"
                    @click="ouvrirParapheDialog(etape)"
                  />
                </td>
              </tr>
              <tr v-if="!(courrier.circuits ?? []).length">
                <td colspan="6" class="text-center text-grey-7">Aucun circuit défini</td>
              </tr>
            </tbody>
          </q-markup-table>
        </q-card-section>

        <q-card-section v-if="courrier.notes" class="q-pt-none">
          <div class="text-caption text-grey-7">Notes</div>
          <div>{{ courrier.notes }}</div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat icon="print" no-caps label="Imprimer" @click="imprimer" />
          <q-btn
            v-if="peutCloturer"
            flat
            color="negative"
            icon="archive"
            no-caps
            label="Clôturer / archiver"
            @click="cloturer"
          />
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </template>
    </q-card>

    <q-dialog v-model="dialogParaphe">
      <q-card style="min-width: 460px">
        <q-card-section>
          <div class="text-h6">Parapher l'étape {{ etapeAParapher?.ordre }}</div>
          <div class="text-caption text-grey-7">{{ etapeAParapher?.roleValideur }}</div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="formParaphe.paraphe" outlined dense label="Empreinte du paraphe (SHA-256, optionnel)" />
          <q-input v-model="formParaphe.commentaire" outlined dense type="textarea" rows="3" label="Commentaire" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn unelevated color="primary" label="Valider" :loading="envoi" @click="validerParaphe" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import WorkflowStepper from './WorkflowStepper.vue';
import {
  LIBELLE_STATUT_COURRIER,
  dateHeureLisible,
} from '../utils/libelles';
import type { CircuitCourrier, Courrier } from '../types';

const props = defineProps<{
  modelValue: boolean;
  courrierId: string | null;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  modifie: [];
}>();

const $q = useQuasar();
const auth = useAuthStore();

const courrier = ref<Courrier | null>(null);
const chargementInitial = ref(false);
const dialogParaphe = ref(false);
const etapeAParapher = ref<CircuitCourrier | null>(null);
const envoi = ref(false);
const formParaphe = ref({ paraphe: '', commentaire: '' });

const etapesWorkflow = computed(() => [
  { identifiant: 'RECU', libelle: 'Reçu', icone: 'inbox' },
  { identifiant: 'EN_CIRCUIT', libelle: 'En circuit', icone: 'how_to_reg' },
  { identifiant: 'TRAITE', libelle: 'Traité', icone: 'task_alt' },
  { identifiant: 'CLASSE', libelle: 'Classé', icone: 'inventory_2' },
  { identifiant: 'ARCHIVE', libelle: 'Archivé', icone: 'archive' },
]);

const etapeActuelle = computed(() => courrier.value?.statut ?? 'RECU');
const aRoleAutorise = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION']));
const peutCloturer = computed(() => auth.role === 'ADMIN' && courrier.value
  && ['EN_CIRCUIT', 'TRAITE', 'CLASSE'].includes(courrier.value.statut));

function classeStatut(s: string) {
  switch (s) {
    case 'RECU':
    case 'ENREGISTRE':
      return 'champ--brouillon';
    case 'EN_CIRCUIT':
      return 'champ--orange';
    case 'TRAITE':
      return 'champ--validee';
    case 'CLASSE':
    case 'ARCHIVE':
      return 'champ--bleue';
    default:
      return 'champ--brouillon';
  }
}

function libelleStatut(s: string) {
  return LIBELLE_STATUT_COURRIER[s] ?? s;
}

function couleurStatut(s: string) {
  switch (s) {
    case 'EN_CIRCUIT':
      return 'orange';
    case 'TRAITE':
      return 'primary';
    case 'CLASSE':
      return 'blue';
    case 'ARCHIVE':
      return 'grey-7';
    default:
      return 'grey-5';
  }
}

async function charger() {
  if (!props.courrierId) return;
  chargementInitial.value = true;
  try {
    const { data } = await api.get(`/courrier/${props.courrierId}`);
    courrier.value = data;
  } finally {
    chargementInitial.value = false;
  }
}

function ouvrirParapheDialog(etape: CircuitCourrier) {
  etapeAParapher.value = etape;
  formParaphe.value = { paraphe: '', commentaire: '' };
  dialogParaphe.value = true;
}

async function validerParaphe() {
  if (!courrier.value || !etapeAParapher.value) return;
  envoi.value = true;
  try {
    await api.post(`/courrier/${courrier.value.id}/parapher/${etapeAParapher.value.id}`, formParaphe.value);
    $q.notify({ type: 'positive', message: 'Paraphe enregistré' });
    dialogParaphe.value = false;
    await charger();
    emit('modifie');
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Paraphe impossible' });
  } finally {
    envoi.value = false;
  }
}

function demanderTransition(cible: string) {
  if (cible === 'CLASSE' || cible === 'ARCHIVE') {
    cloturer();
  } else {
    $q.notify({ message: 'Le paraphe se fait sur une étape du circuit', type: 'info' });
  }
}

function cloturer() {
  if (!courrier.value) return;
  $q.dialog({
    title: 'Clôturer',
    message: `Clôturer « ${courrier.value.numero} » et avancer vers ${courrier.value.statut === 'CLASSE' ? 'ARCHIVE' : 'CLASSE'} ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Clôturer', unelevated: true },
  }).onOk(async () => {
    try {
      await api.post(`/courrier/${courrier.value!.id}/cloturer`, {});
      $q.notify({ type: 'positive', message: 'Courrier clôturé' });
      await charger();
      emit('modifie');
    } catch (e: any) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Clôture impossible' });
    }
  });
}

function imprimer() {
  if (!courrier.value) return;
  window.open(`${API_URL}/courrier/${courrier.value.id}/imprimer?token=${auth.token}`, '_blank');
}

watch(
  () => props.courrierId,
  () => {
    if (props.modelValue) charger();
  },
);
</script>

<style>
.champ.badge-statut {
  display: inline-flex;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.champ--brouillon {
  background: #cfd4d9;
  color: #33463f;
}
.champ--validee {
  background: #0f7a45;
  color: white;
}
.champ--orange {
  background: #ff9800;
  color: white;
}
.champ--bleue {
  background: #1565c0;
  color: white;
}
</style>
