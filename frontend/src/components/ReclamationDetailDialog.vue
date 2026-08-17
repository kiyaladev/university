<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 760px; max-width: 96vw; max-height: 90vh" class="column">
      <q-card-section v-if="reclamation" class="row items-center no-wrap">
        <div class="col">
          <div class="text-h6">{{ reclamation.numero }} — {{ reclamation.sujet }}</div>
          <div class="text-caption text-grey-7">
            {{ reclamation.etudiant ? reclamation.etudiant.nom + ' ' + reclamation.etudiant.prenom : (reclamation.anonyme ? 'Anonyme' : '—') }}
            <span v-if="reclamation.departement"> · {{ reclamation.departement.nom }}</span>
          </div>
        </div>
        <span
          v-if="reclamation"
          class="reclamation-champ"
          :class="`reclamation-champ--${reclamation.statut}`"
        >
          {{ libelleStatut(reclamation.statut) }}
        </span>
      </q-card-section>

      <q-card-section v-if="reclamation" class="q-pt-none col-grow scroll">
        <!-- Stepper du cycle de vie -->
        <workflow-stepper
          :etapes="ETAPES_RECLAMATION"
          :actuel="reclamation.statut"
          :transitions="transitionsAutorisees"
          @transition="changerStatut"
        />

        <!-- Métadonnées -->
        <div class="reclamation-meta q-mt-md">
          <div>
            <span class="pochoir reclamation-meta__libelle">Type</span>
            <span>{{ libelleType(reclamation.type) }}</span>
          </div>
          <div>
            <span class="pochoir reclamation-meta__libelle">Priorité</span>
            <span
              class="reclamation-champ reclamation-champ--prio"
              :class="`prio-${reclamation.priorite}`"
            >
              {{ libellePriorite(reclamation.priorite) }}
            </span>
          </div>
          <div>
            <span class="pochoir reclamation-meta__libelle">Assigné à</span>
            <span>{{ reclamation.assigneA ? reclamation.assigneA.prenom + ' ' + reclamation.assigneA.nom : '—' }}</span>
          </div>
          <div>
            <span class="pochoir reclamation-meta__libelle">Créée le</span>
            <span>{{ dateHeureLisible(reclamation.creeLe) }}</span>
          </div>
          <div v-if="reclamation.escaladeLe">
            <span class="pochoir reclamation-meta__libelle">Escaladée le</span>
            <span class="text-warning">{{ dateHeureLisible(reclamation.escaladeLe) }}</span>
          </div>
          <div v-if="reclamation.fermeLe">
            <span class="pochoir reclamation-meta__libelle">Fermée le</span>
            <span>{{ dateHeureLisible(reclamation.fermeLe) }}</span>
          </div>
          <div v-if="reclamation.delaiEscaladeHeures">
            <span class="pochoir reclamation-meta__libelle">Délai d'escalade</span>
            <span>{{ reclamation.delaiEscaladeHeures }} h</span>
          </div>
        </div>

        <!-- Description initiale -->
        <div class="q-mt-md">
          <span class="section-titre">Description</span>
          <div class="reclamation-description" style="white-space: pre-wrap">
            {{ reclamation.description }}
          </div>
        </div>

        <!-- Fil de messages -->
        <div class="q-mt-md">
          <span class="section-titre">Fil ({{ reclamation.messages?.length ?? 0 }})</span>
          <q-list v-if="reclamation.messages?.length" separator>
            <q-item
              v-for="m in reclamation.messages"
              :key="m.id"
              class="reclamation-message"
              :class="{ 'reclamation-message--staff': m.auteur?.role && m.auteur.role !== 'ETUDIANT' }"
            >
              <q-item-section avatar>
                <q-avatar size="32px" color="secondary" text-color="white">
                  {{ initiales(m.nomAffichage ?? m.auteur?.nom ?? '?') }}
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">
                  {{ m.nomAffichage ?? (m.auteur ? m.auteur.prenom + ' ' + m.auteur.nom : 'Anonyme') }}
                  <span v-if="m.auteur" class="text-caption text-grey-7 q-ml-xs">
                    {{ libelleRoleCourt(m.auteur.role) }}
                  </span>
                </q-item-label>
                <q-item-label caption>{{ dateHeureLisible(m.creeLe) }}</q-item-label>
                <div class="q-mt-xs" style="white-space: pre-wrap">{{ m.contenu }}</div>
                <div v-if="m.joint" class="q-mt-xs">
                  <a :href="m.joint" target="_blank" rel="noopener">
                    <q-icon name="attach_file" size="16px" /> Pièce jointe
                  </a>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <p v-else class="text-caption text-grey-7 q-mt-sm">Aucun message pour le moment.</p>
        </div>

        <!-- Notes internes -->
        <div v-if="reclamation.notes" class="q-mt-md">
          <span class="section-titre">Notes internes</span>
          <div class="reclamation-notes" style="white-space: pre-wrap">{{ reclamation.notes }}</div>
        </div>
      </q-card-section>

      <q-separator />

      <!-- Zone de réponse -->
      <q-card-section v-if="reclamation" class="q-pb-sm">
        <q-input
          v-model="messageCourant"
          outlined
          dense
          type="textarea"
          rows="2"
          :disable="!peutPoster"
          :placeholder="peutPoster ? 'Votre réponse…' : 'Cette réclamation est close.'"
        />
        <div class="row items-center q-mt-sm q-gutter-sm">
          <q-btn
            v-if="auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']) && reclamation.statut !== 'FERMEE' && reclamation.statut !== 'REJETEE' && reclamation.statut !== 'RESOLUE'"
            outline
            color="primary"
            no-caps
            icon="person_add"
            label="Assigner"
            :loading="enCours === 'assigner'"
            @click="ouvrirAssigner"
          />
          <q-btn
            v-if="auth.aRole(['ADMIN', 'DIRECTION']) && reclamation.statut !== 'FERMEE' && reclamation.statut !== 'REJETEE' && reclamation.statut !== 'RESOLUE'"
            outline
            color="warning"
            no-caps
            icon="priority_high"
            label="Escalader"
            :loading="enCours === 'escalader'"
            @click="declencherEscalade"
          />
          <q-btn
            v-if="auth.aRole(['ADMIN', 'DIRECTION']) && (reclamation.statut === 'RESOLUE' || reclamation.statut === 'FERMEE' || reclamation.statut === 'REJETEE')"
            outline
            color="positive"
            no-caps
            icon="task_alt"
            label="Ajouter une note de clôture"
            :loading="enCours === 'cloturer'"
            @click="cloturer"
          />
          <q-space />
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="send"
            label="Répondre"
            :loading="enCours === 'message'"
            :disable="!peutPoster || !messageCourant.trim()"
            @click="posterMessage"
          />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Fermer" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import WorkflowStepper, { type Transition } from './WorkflowStepper.vue';
import { useAuthStore } from '../stores/auth';
import { LIBELLE_ROLE, dateHeureLisible } from '../utils/libelles';
import type {
  PrioriteReclamation,
  Reclamation,
  StatutReclamation,
  TypeReclamation,
  Utilisateur,
} from '../types';

const props = defineProps<{
  modelValue: boolean;
  reclamation: Reclamation | null;
  membresStaff?: Utilisateur[];
}>();
const emit = defineEmits<{
  'update:modelValue': [boolean];
  change: [Reclamation];
  assigne: [Reclamation];
  escalade: [Reclamation];
  cloture: [Reclamation];
}>();

const $q = useQuasar();
const auth = useAuthStore();

const enCours = ref('');
const messageCourant = ref('');
const noteCloture = ref('');
const assigneDialogOuvert = ref(false);
const assigneCible = ref<string | null>(null);
const clotureDialogOuvert = ref(false);

const LIBELLE_STATUT: Record<StatutReclamation, string> = {
  OUVERTE: 'Ouverte',
  EN_COURS: 'En cours',
  EN_ATTENTE_REPONSE: 'Attente réponse',
  RESOLUE: 'Résolue',
  FERMEE: 'Fermée',
  REJETEE: 'Rejetée',
};

const LIBELLE_TYPE_RECLAMATION: Record<TypeReclamation, string> = {
  NOTE_MANQUANTE: 'Note manquante',
  ERREUR_SAISIE: 'Erreur de saisie',
  INSCRIPTION: 'Inscription',
  ENSEIGNEMENT: 'Enseignement',
  SCOLARITE: 'Scolarité',
  TECHNIQUE: 'Technique',
  AUTRE: 'Autre',
};

const LIBELLE_PRIORITE_RECLAMATION: Record<PrioriteReclamation, string> = {
  BASSE: 'Basse',
  NORMALE: 'Normale',
  HAUTE: 'Haute',
  URGENTE: 'Urgente',
};

const ETAPES_RECLAMATION = [
  { identifiant: 'OUVERTE', libelle: 'Ouverte', icone: 'inbox' },
  { identifiant: 'EN_COURS', libelle: 'En cours', icone: 'autorenew' },
  { identifiant: 'EN_ATTENTE_REPONSE', libelle: 'Attente réponse', icone: 'forum' },
  { identifiant: 'RESOLUE', libelle: 'Résolue', icone: 'check_circle' },
];

const peutPoster = computed(() => {
  if (!props.reclamation) return false;
  const clos: StatutReclamation[] = ['RESOLUE', 'FERMEE', 'REJETEE'];
  return !clos.includes(props.reclamation.statut);
});

const transitionsAutorisees = computed<Transition[]>(() => {
  if (!props.reclamation) return [];
  if (!auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE'])) return [];
  const clos: StatutReclamation[] = ['RESOLUE', 'FERMEE', 'REJETEE'];
  if (clos.includes(props.reclamation.statut)) return [];

  const possibles: Transition[] = [];
  if (props.reclamation.statut === 'OUVERTE') {
    possibles.push({ cible: 'EN_COURS', label: 'Prendre en charge', icone: 'autorenew' });
  }
  if (props.reclamation.statut === 'EN_COURS') {
    possibles.push({ cible: 'EN_ATTENTE_REPONSE', label: 'En attente de réponse', icone: 'forum' });
    possibles.push({ cible: 'RESOLUE', label: 'Marquer résolu', icone: 'check_circle', couleur: 'positive' });
    possibles.push({ cible: 'REJETEE', label: 'Rejeter', icone: 'block', couleur: 'negative', requireMotif: true });
  }
  if (props.reclamation.statut === 'EN_ATTENTE_REPONSE') {
    possibles.push({ cible: 'EN_COURS', label: 'Reprendre', icone: 'autorenew' });
    possibles.push({ cible: 'RESOLUE', label: 'Marquer résolu', icone: 'check_circle', couleur: 'positive' });
    possibles.push({ cible: 'REJETEE', label: 'Rejeter', icone: 'block', couleur: 'negative', requireMotif: true });
  }
  return possibles;
});

function libelleStatut(s: string) {
  return LIBELLE_STATUT[s as StatutReclamation] ?? s;
}
function libelleType(t: string) {
  return LIBELLE_TYPE_RECLAMATION[t as TypeReclamation] ?? t;
}
function libellePriorite(p: string) {
  return LIBELLE_PRIORITE_RECLAMATION[p as PrioriteReclamation] ?? p;
}
function libelleRoleCourt(role: string) {
  return LIBELLE_ROLE[role as keyof typeof LIBELLE_ROLE] ?? role;
}
function initiales(nom: string) {
  const parts = nom.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    messageCourant.value = '';
  },
);

async function posterMessage() {
  if (!props.reclamation || !messageCourant.value.trim()) return;
  enCours.value = 'message';
  try {
    await api.post(`/reclamations/${props.reclamation.id}/messages`, {
      contenu: messageCourant.value.trim(),
    });
    const maj = await api.get(`/reclamations/${props.reclamation.id}`);
    props.reclamation.messages = (maj.data as Reclamation).messages;
    props.reclamation.statut = (maj.data as Reclamation).statut;
    messageCourant.value = '';
    $q.notify({ type: 'positive', message: 'Message envoyé' });
  } finally {
    enCours.value = '';
  }
}

async function changerStatut(cible: StatutReclamation) {
  if (!props.reclamation) return;
  let commentaire = '';
  if (cible === 'REJETEE') {
    commentaire = '';
    const ok = await new Promise<boolean>((resolve) => {
      $q.dialog({
        title: 'Rejeter la réclamation',
        message: 'Indiquez le motif du rejet (obligatoire) :',
        prompt: { model: '', isValid: (v: string) => v.trim().length >= 3, type: 'text' },
        cancel: true,
        ok: { label: 'Rejeter', color: 'negative' },
      }).onOk(() => resolve(true)).onCancel(() => resolve(false));
    });
    if (!ok) return;
    commentaire = (document.querySelector('.q-dialog input') as HTMLInputElement | null)?.value ?? '';
  }
  enCours.value = 'statut';
  try {
    const { data } = await api.put(`/reclamations/${props.reclamation.id}/statut`, {
      statut: cible,
      ...(commentaire ? { commentaire } : {}),
    });
    $q.notify({
      type: cible === 'REJETEE' ? 'warning' : 'positive',
      message: `Réclamation passée à « ${libelleStatut(cible)} »`,
    });
    emit('change', data as Reclamation);
    Object.assign(props.reclamation, data);
  } finally {
    enCours.value = '';
  }
}

function ouvrirAssigner() {
  if (!props.membresStaff?.length) {
    $q.notify({ type: 'warning', message: 'Aucun agent assignable disponible.' });
    return;
  }
  $q.dialog({
    title: 'Assigner à un agent',
    message: 'Choisissez la personne qui prendra la réclamation en charge.',
    options: {
      type: 'radio',
      model: props.reclamation?.assigneAId ?? null,
      items: props.membresStaff.map((u) => ({
        label: `${u.prenom} ${u.nom}`,
        value: u.id,
      })),
    },
    cancel: true,
    ok: { label: 'Assigner', color: 'primary' },
  }).onOk(async (assigneAId: string | null) => {
    if (!props.reclamation || !assigneAId) return;
    enCours.value = 'assigner';
    try {
      const { data } = await api.put(`/reclamations/${props.reclamation.id}/assigner`, { assigneAId });
      $q.notify({ type: 'positive', message: 'Réclamation assignée' });
      emit('assigne', data as Reclamation);
      Object.assign(props.reclamation, data);
    } finally {
      enCours.value = '';
    }
  });
}

async function declencherEscalade() {
  if (!props.reclamation) return;
  enCours.value = 'escalader';
  try {
    const { data } = await api.post(`/reclamations/${props.reclamation.id}/escalader`);
    $q.notify({ type: 'warning', message: 'Réclamation escaladée à la direction' });
    emit('escalade', data as Reclamation);
    Object.assign(props.reclamation, data);
  } finally {
    enCours.value = '';
  }
}

function cloturer() {
  if (!props.reclamation) return;
  $q.dialog({
    title: 'Note de clôture',
    message: 'Indiquez la note qui figurera dans le dossier.',
    prompt: { model: '', isValid: (v: string) => v.trim().length >= 3, type: 'textarea' },
    cancel: true,
    ok: { label: 'Consigner', color: 'positive' },
  }).onOk(async (noteClotureValue: string) => {
    if (!props.reclamation || !noteClotureValue.trim()) return;
    enCours.value = 'cloturer';
    try {
      const { data } = await api.post(`/reclamations/${props.reclamation.id}/cloturer`, {
        noteCloture: noteClotureValue.trim(),
      });
      $q.notify({ type: 'positive', message: 'Note de clôture consignée' });
      emit('cloture', data as Reclamation);
      Object.assign(props.reclamation, data);
    } finally {
      enCours.value = '';
    }
  });
}
</script>

<style scoped lang="scss">
$encre: #10251E;
$encre-douce: #33463F;
$chaux-claire: #F2F3EE;
$blanc-craie: #FAFAF7;
$vert: #0F7A45;
$jaune-fonce: #C98A00;
$rouge: #C4122E;

.reclamation-champ {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: #fff;
  border-radius: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &--OUVERTE { background: $jaune-fonce; }
  &--EN_COURS { background: $encre; }
  &--EN_ATTENTE_REPONSE { background: #6b7280; }
  &--RESOLUE { background: $vert; }
  &--FERMEE { background: #4b5563; }
  &--REJETEE { background: $rouge; }

  &--prio {
    box-shadow: none;
    &.prio-BASSE {
      background: $chaux-claire;
      color: $encre;
      border: 2px solid rgba(16, 37, 30, 0.45);
    }
    &.prio-NORMALE { background: #EFB700; color: $encre; }
    &.prio-HAUTE { background: $rouge; }
    &.prio-URGENTE {
      background: $rouge;
      animation: clignote 1.4s ease-in-out infinite;
    }
  }
}

@keyframes clignote {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.reclamation-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--up-2);
  background: rgba(16, 37, 30, 0.04);
  padding: var(--up-2);
  border-left: var(--up-filet);

  &__libelle {
    display: block;
    color: var(--up-encre-douce);
    margin-bottom: 2px;
  }
}

.reclamation-description,
.reclamation-notes {
  background: $blanc-craie;
  border: var(--up-filet-fin);
  padding: var(--up-2);
  border-radius: 0;
  font-size: 0.95rem;
}

.reclamation-message {
  background: rgba(16, 37, 30, 0.04);
  border-left: 3px solid var(--up-encre-douce);

  &--staff {
    background: rgba(15, 122, 69, 0.06);
    border-left-color: $vert;
  }
}
</style>