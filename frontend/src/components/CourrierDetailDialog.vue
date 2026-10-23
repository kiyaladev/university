<template>
  <q-dialog v-model="ouvert" @show="charger">
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
              {{ $t(courrier.type === 'ENTRANT' ? 'courrier.detail.sender' : 'courrier.detail.recipient', { name: courrier.type === 'ENTRANT' ? courrier.expediteur ?? '—' : courrier.destinataire ?? '—' }) }}
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
            :readonly="!peutCloturer"
            @transition="demanderTransition"
          />

          <q-markup-table dense flat bordered class="q-mt-md">
            <thead>
              <tr>
                <th class="text-left">#</th>
                <th class="text-left">{{ $t('common.fields.role') }}</th>
                <th class="text-left">{{ $t('courrier.detail.approver') }}</th>
                <th class="text-left">{{ $t('common.fields.status') }}</th>
                <th class="text-left">{{ $t('courrier.detail.stampedOn') }}</th>
                <th class="text-right">{{ $t('common.actions.actions') }}</th>
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
                    v-if="peutParapher(etape)"
                    flat
                    dense
                    no-caps
                    icon="draw"
                    color="primary"
                    :label="$t('courrier.detail.stamp')"
                    @click="ouvrirParapheDialog(etape)"
                  />
                </td>
              </tr>
              <tr v-if="!(courrier.circuits ?? []).length">
                <td colspan="6" class="text-center text-grey-7">{{ $t('courrier.detail.noWorkflow') }}</td>
              </tr>
            </tbody>
          </q-markup-table>
        </q-card-section>

        <q-card-section v-if="courrier.notes" class="q-pt-none">
          <div class="text-caption text-grey-7">{{ $t('common.fields.notes') }}</div>
          <div>{{ courrier.notes }}</div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat icon="print" no-caps :label="$t('common.actions.print')" @click="imprimer" />
          <q-btn
            v-if="peutCloturer"
            flat
            color="negative"
            icon="archive"
            no-caps
            :label="$t('courrier.actionsColumn.closeTooltip')"
            @click="cloturer"
          />
          <q-btn flat :label="$t('common.actions.close')" v-close-popup />
        </q-card-actions>
      </template>
    </q-card>

    <dialogue-formulaire
      v-model="dialogParaphe"
      taille="s"
      :titre="$t('courrier.detail.stampStep', { order: etapeAParapher?.ordre })"
      :sous-titre="etapeAParapher?.roleValideur ?? undefined"
      :libelle-valider="$t('common.actions.validate')"
      :envoi="envoi"
      @valider="validerParaphe"
    >
      <div class="q-gutter-md">
        <q-input v-model="formParaphe.paraphe" outlined dense :label="$t('courrier.detail.signatureHash')" />
        <q-input v-model="formParaphe.commentaire" outlined dense type="textarea" rows="3" :label="$t('common.fields.comment')" />
      </div>
    </dialogue-formulaire>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import WorkflowStepper from './WorkflowStepper.vue';
import DialogueFormulaire from './DialogueFormulaire.vue';
import { useConfirmation } from '../composables/useConfirmation';
import {
  LIBELLE_STATUT_COURRIER,
  dateHeureLisible,
} from '../utils/libelles';
import type { CircuitCourrier, Courrier } from '../types';
import { ouvrirImpression } from '../services/impression';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ courrierId: string | null }>();
const emit = defineEmits<{ modifie: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const { confirmer } = useConfirmation();

const courrier = ref<Courrier | null>(null);
const chargementInitial = ref(false);
const dialogParaphe = ref(false);
const etapeAParapher = ref<CircuitCourrier | null>(null);
const envoi = ref(false);
const formParaphe = ref({ paraphe: '', commentaire: '' });

const etapesWorkflow = computed(() => [
  { identifiant: 'RECU', libelle: t('courrier.detail.status.received'), icone: 'inbox' },
  { identifiant: 'EN_CIRCUIT', libelle: t('courrier.detail.status.inWorkflow'), icone: 'how_to_reg' },
  { identifiant: 'TRAITE', libelle: t('courrier.detail.status.processed'), icone: 'task_alt' },
  { identifiant: 'CLASSE', libelle: t('courrier.detail.status.filed'), icone: 'inventory_2' },
  { identifiant: 'ARCHIVE', libelle: t('courrier.detail.status.archived'), icone: 'archive' },
]);

const etapeActuelle = computed(() => courrier.value?.statut ?? 'RECU');
const peutCloturer = computed(() => auth.role === 'ADMIN' && courrier.value
  && ['EN_CIRCUIT', 'TRAITE', 'CLASSE'].includes(courrier.value.statut));

function peutParapher(etape: CircuitCourrier) {
  if (courrier.value?.statut !== 'EN_CIRCUIT' || etape.statut !== 'EN_CIRCUIT') return false;
  if (courrier.value.circuits.some(e => e.ordre < etape.ordre && e.statut !== 'TRAITE')) return false;
  if (auth.aRole(['ADMIN', 'DIRECTION'])) return true;
  const roles: Record<string, string[]> = {
    SCOLARITE: ['Secrétariat', 'Secrétariat général', 'Scolarité', 'Archives'],
    CHEF_DEPARTEMENT: ['Chef département', 'Chef de département'],
  };
  return (roles[auth.role || ''] || []).includes(etape.roleValideur || '');
}

/** Mêmes peintures que l'écran du courrier — voir `css/_champs-admin.scss`. */
function classeStatut(s: string) {
  switch (s) {
    case 'EN_CIRCUIT':
      return 'champ--en-cours';
    case 'TRAITE':
      return 'champ--validee';
    case 'CLASSE':
    case 'ARCHIVE':
      return 'champ--close';
    default:
      return 'champ--brouillon';
  }
}

function libelleStatut(s: string) {
  return LIBELLE_STATUT_COURRIER[s] ?? s;
}

/**
 * Étape du circuit : les rôles Quasar sont déjà réglés sur les peintures du
 * panneau (accent = jaune de l'attente, secondary = vert de l'acquis,
 * primary = encre de la fin). Aucune teinte Material n'entre ici.
 */
function couleurStatut(s: string) {
  switch (s) {
    case 'EN_CIRCUIT':
      return 'accent';
    case 'TRAITE':
      return 'secondary';
    case 'CLASSE':
    case 'ARCHIVE':
      return 'primary';
    default:
      return 'grey-7';
  }
}

async function charger() {
  if (!props.courrierId) return;
  chargementInitial.value = true;
  try {
    const { data } = await api.get(`/courrier/${props.courrierId}`);
    courrier.value = data;
  } catch {
    /* notifié par l'intercepteur */
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
    $q.notify({ type: 'positive', message: t('courrier.detail.stamped') });
    dialogParaphe.value = false;
    await charger();
    emit('modifie');
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    envoi.value = false;
  }
}

function demanderTransition(cible: string) {
  if (cible === 'CLASSE' || cible === 'ARCHIVE') {
    void cloturer();
  } else {
    $q.notify({ message: t('courrier.detail.stampOnStep'), type: 'info' });
  }
}

async function cloturer() {
  const c = courrier.value;
  if (!c) return;
  const ok = await confirmer({
    titre: t('common.actions.closeOut'),
    message: t('courrier.detail.closeMessage', { number: c.numero, next: c.statut === 'CLASSE' ? 'ARCHIVE' : c.statut === 'TRAITE' ? 'CLASSE' : 'TRAITE' }),
    ok: t('common.actions.closeOut'),
    danger: true,
  });
  if (!ok) return;
  try {
    await api.post(`/courrier/${c.id}/cloturer`, {});
    $q.notify({ type: 'positive', message: t('courrier.messages.closed') });
    await charger();
    emit('modifie');
  } catch {
    /* notifié par l'intercepteur */
  }
}

function imprimer() {
  if (!courrier.value) return;
  void ouvrirImpression(`/courrier/${courrier.value.id}/imprimer`);
}

watch(
  () => props.courrierId,
  () => {
    if (ouvert.value) void charger();
  },
);
</script>

<style scoped lang="scss">
// Le champ de statut du courrier : une seule définition, partagée avec
// CourrierPage et la paie.
@use '../css/champs-admin' as *;
</style>
