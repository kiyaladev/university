<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 760px; max-width: 96vw; max-height: 90vh" class="column">
      <q-card-section v-if="reclamation" class="row items-center no-wrap">
        <div class="col">
          <div class="text-h6">
            {{ reclamation.numero }} {{ $t('common.format.emptyValue') }} {{ reclamation.sujet }}
          </div>
          <div class="text-caption text-grey-7">
            {{
              reclamation.etudiant
                ? reclamation.etudiant.nom + ' ' + reclamation.etudiant.prenom
                : reclamation.nomAuteur || (reclamation.anonyme ? $t('reclamations.dialog.detail.anonymous') : '—')
            }}
            <span v-if="reclamation.etudiant"> · {{ reclamation.etudiant.matricule }}</span>
            <span v-if="reclamation.departement"> · {{ reclamation.departement.nom }}</span>
          </div>
          <div v-if="peutOuvrirDossier && reclamation.etudiant" class="q-mt-xs">
            <q-btn
              flat
              dense
              no-caps
              size="sm"
              icon="description"
              :label="$t('reclamations.dialog.detail.documentRequests')"
              @click="ouvrirDossier('demandes-docs')"
            />
            <q-btn
              flat
              dense
              no-caps
              size="sm"
              icon="badge"
              :label="$t('reclamations.dialog.detail.studentCard')"
              @click="ouvrirDossier('cartes-etudiantes')"
            />
          </div>
        </div>
        <PastilleStatut v-if="reclamation" domaine="reclamation" :statut="reclamation.statut" />
      </q-card-section>

      <q-card-section v-if="reclamation" class="q-pt-none col-grow scroll">
        <!-- Stepper du cycle de vie -->
        <etapes-circuit
          :etapes="ETAPES_RECLAMATION"
          :actuel="reclamation.statut"
          :transitions="transitionsAutorisees"
          @transition="changerStatut"
        />

        <!-- Métadonnées -->
        <div class="reclamation-meta q-mt-md">
          <div>
            <span class="pochoir reclamation-meta__libelle">{{ $t('common.fields.type') }}</span>
            <span>{{ libelleType(reclamation.type) }}</span>
          </div>
          <div>
            <span class="pochoir reclamation-meta__libelle">{{ $t('common.fields.priority') }}</span>
            <span class="reclamation-champ reclamation-champ--prio" :class="`prio-${reclamation.priorite}`">
              {{ libellePriorite(reclamation.priorite) }}
            </span>
          </div>
          <div>
            <span class="pochoir reclamation-meta__libelle">{{ $t('reclamations.filters.assigneA') }}</span>
            <span>{{ reclamation.assigneA ? reclamation.assigneA.prenom + ' ' + reclamation.assigneA.nom : '—' }}</span>
          </div>
          <div>
            <span class="pochoir reclamation-meta__libelle">{{ $t('common.fields.createdOn') }}</span>
            <span>{{ dateHeureLisible(reclamation.creeLe) }}</span>
          </div>
          <div v-if="reclamation.escaladeLe">
            <span class="pochoir reclamation-meta__libelle">{{ $t('reclamations.dialog.detail.escalatedOn') }}</span>
            <span class="text-warning">{{ dateHeureLisible(reclamation.escaladeLe) }}</span>
          </div>
          <div v-if="reclamation.fermeLe">
            <span class="pochoir reclamation-meta__libelle">{{ $t('reclamations.dialog.detail.closedOn') }}</span>
            <span>{{ dateHeureLisible(reclamation.fermeLe) }}</span>
          </div>
          <div v-if="reclamation.delaiEscaladeHeures">
            <span class="pochoir reclamation-meta__libelle">{{
              $t('reclamations.dialog.detail.escalationDelay')
            }}</span>
            <span>{{ $t('common.units.hours', { n: reclamation.delaiEscaladeHeures }) }}</span>
          </div>
        </div>

        <!-- Description initiale -->
        <div class="q-mt-md">
          <span class="section-titre">{{ $t('common.fields.description') }}</span>
          <div class="reclamation-description" style="white-space: pre-wrap">
            {{ reclamation.description }}
          </div>
        </div>

        <!-- Fil de messages -->
        <div class="q-mt-md">
          <span class="section-titre">{{
            $t('reclamations.dialog.detail.messageThread', {
              count: reclamation._count?.messages ?? reclamation.messages?.length ?? 0,
            })
          }}</span>
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
                    <q-icon name="attach_file" size="16px" /> {{ $t('reclamations.dialog.detail.attachment') }}
                  </a>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <p v-else class="text-caption text-grey-7 q-mt-sm">{{ $t('reclamations.dialog.detail.noMessages') }}</p>
        </div>

        <!-- Notes internes : réservées au personnel, jamais montrées à l'étudiant -->
        <div v-if="estStaff && reclamation.notes" class="q-mt-md">
          <span class="section-titre">{{ $t('reclamations.dialog.detail.internalNotes') }}</span>
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
          :placeholder="
            peutPoster
              ? $t('reclamations.dialog.detail.replyPlaceholder')
              : $t('reclamations.dialog.detail.closedPlaceholder')
          "
        />
        <div class="row items-center q-mt-sm q-gutter-sm">
          <q-btn
            v-if="
              estStaff &&
              reclamation.statut !== 'FERME' &&
              reclamation.statut !== 'REJETE' &&
              reclamation.statut !== 'RESOLU'
            "
            outline
            color="primary"
            no-caps
            icon="person_add"
            :label="$t('reclamations.dialog.detail.assign')"
            :loading="enCours === 'assigner'"
            @click="ouvrirAssigner"
          />
          <q-btn
            v-if="
              auth.aRole(['ADMIN', 'DIRECTION']) &&
              reclamation.statut !== 'FERME' &&
              reclamation.statut !== 'REJETE' &&
              reclamation.statut !== 'RESOLU'
            "
            outline
            color="warning"
            no-caps
            icon="priority_high"
            :label="$t('reclamations.actions.escalate')"
            :loading="enCours === 'escalader'"
            @click="declencherEscalade"
          />
          <q-btn
            v-if="
              auth.aRole(['ADMIN', 'DIRECTION']) &&
              (reclamation.statut === 'RESOLU' || reclamation.statut === 'FERME' || reclamation.statut === 'REJETE')
            "
            outline
            color="positive"
            no-caps
            icon="task_alt"
            :label="$t('reclamations.dialog.detail.addClosingNote')"
            :loading="enCours === 'cloturer'"
            @click="cloturer"
          />
          <q-space />
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="send"
            :label="$t('reclamations.dialog.detail.reply')"
            :loading="enCours === 'message'"
            :disable="!peutPoster || !messageCourant.trim()"
            @click="posterMessage"
          />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { api } from '@/boot/axios';
import EtapesCircuit, { type Transition } from '@/shared/components/EtapesCircuit.vue';
import { useAuthStore } from '@/stores/auth';
import {
  LIBELLE_PRIORITE_RECLAMATION,
  LIBELLE_ROLE,
  LIBELLE_STATUT_RECLAMATION,
  LIBELLE_TYPE_RECLAMATION,
  dateHeureLisible,
} from '@/shared/utils/libelles';
import type { PrioriteReclamation, Reclamation, StatutReclamation, TypeReclamation, Utilisateur } from '@/types';

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
const { t: $t } = useI18n();
const auth = useAuthStore();
const router = useRouter();

/** Rebond vers le dossier de l'étudiant concerné, filtré sur lui. */
function ouvrirDossier(nomRoute: 'demandes-docs' | 'cartes-etudiantes') {
  const etudiantId = props.reclamation?.etudiant?.id;
  if (!etudiantId) return;
  emit('update:modelValue', false);
  void router.push({ name: nomRoute, query: { etudiantId } });
}

const enCours = ref('');
const messageCourant = ref('');

/** Le personnel voit les notes internes et les liens vers le dossier étudiant. */
const estStaff = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE']));
const peutOuvrirDossier = computed(() => auth.peut('reclamations.ouvrirDossier'));

const ETAPES_RECLAMATION = computed(() => [
  { identifiant: 'OUVERT', libelle: $t('reclamations.dialog.detail.opened'), icone: 'inbox' },
  { identifiant: 'EN_COURS', libelle: $t('reclamations.dialog.detail.inProgress'), icone: 'autorenew' },
  { identifiant: 'EN_ATTENTE_REPONSE', libelle: $t('reclamations.dialog.detail.awaitingReply'), icone: 'forum' },
  { identifiant: 'RESOLU', libelle: $t('reclamations.dialog.detail.resolved'), icone: 'check_circle' },
]);

const peutPoster = computed(() => {
  if (!props.reclamation) return false;
  const clos: StatutReclamation[] = ['RESOLU', 'FERME', 'REJETE'];
  return !clos.includes(props.reclamation.statut);
});

const transitionsAutorisees = computed<Transition[]>(() => {
  if (!props.reclamation) return [];
  if (!estStaff.value) return [];
  const clos: StatutReclamation[] = ['RESOLU', 'FERME', 'REJETE'];
  if (clos.includes(props.reclamation.statut)) return [];

  const possibles: Transition[] = [];
  if (props.reclamation.statut === 'OUVERT') {
    possibles.push({ cible: 'EN_COURS', label: $t('reclamations.dialog.detail.takeOwnership'), icone: 'autorenew' });
  }
  if (props.reclamation.statut === 'EN_COURS') {
    possibles.push({ cible: 'EN_ATTENTE_REPONSE', label: $t('reclamations.dialog.detail.awaitReply'), icone: 'forum' });
    possibles.push({
      cible: 'RESOLU',
      label: $t('reclamations.dialog.detail.markResolved'),
      icone: 'check_circle',
      couleur: 'positive',
    });
    possibles.push({
      cible: 'REJETE',
      label: $t('common.actions.reject'),
      icone: 'block',
      couleur: 'negative',
      requireMotif: true,
    });
  }
  if (props.reclamation.statut === 'EN_ATTENTE_REPONSE') {
    possibles.push({ cible: 'EN_COURS', label: $t('common.actions.resume'), icone: 'autorenew' });
    possibles.push({
      cible: 'RESOLU',
      label: $t('reclamations.dialog.detail.markResolved'),
      icone: 'check_circle',
      couleur: 'positive',
    });
    possibles.push({
      cible: 'REJETE',
      label: $t('common.actions.reject'),
      icone: 'block',
      couleur: 'negative',
      requireMotif: true,
    });
  }
  return possibles;
});

function libelleStatut(s: string) {
  return LIBELLE_STATUT_RECLAMATION[s as StatutReclamation] ?? s;
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
    $q.notify({ type: 'positive', message: $t('reclamations.dialog.detail.messageSent') });
  } finally {
    enCours.value = '';
  }
}

async function changerStatut(cible: StatutReclamation) {
  if (!props.reclamation) return;
  let commentaire = '';
  if (cible === 'REJETE') {
    // Le motif est celui saisi dans l'invite : il arrive par le callback,
    // jamais en relisant le DOM d'un dialogue déjà fermé.
    const motif = await new Promise<string | null>((resolve) => {
      $q.dialog({
        title: $t('reclamations.dialog.detail.rejectTitle'),
        message: $t('reclamations.dialog.detail.rejectPrompt'),
        prompt: { model: '', isValid: (v: string) => v.trim().length >= 3, type: 'textarea' },
        cancel: true,
        ok: { label: $t('common.actions.reject'), color: 'negative' },
      })
        .onOk((valeur: string) => resolve(valeur))
        .onCancel(() => resolve(null));
    });
    if (motif === null || !motif.trim()) return;
    commentaire = motif.trim();
  }
  enCours.value = 'statut';
  try {
    const { data } = await api.put(`/reclamations/${props.reclamation.id}/statut`, {
      statut: cible,
      ...(commentaire ? { commentaire } : {}),
    });
    $q.notify({
      type: cible === 'REJETE' ? 'warning' : 'positive',
      message: $t('reclamations.dialog.detail.statusChanged', { status: libelleStatut(cible) }),
    });
    emit('change', data as Reclamation);
    Object.assign(props.reclamation, data);
  } finally {
    enCours.value = '';
  }
}

function ouvrirAssigner() {
  if (!props.membresStaff?.length) {
    $q.notify({ type: 'warning', message: $t('reclamations.dialog.detail.noAssignableStaff') });
    return;
  }
  $q.dialog({
    title: $t('reclamations.dialog.detail.assignTitle'),
    message: $t('reclamations.dialog.detail.assignPrompt'),
    options: {
      type: 'radio',
      model: props.reclamation?.assigneAId ?? null,
      items: props.membresStaff.map((u) => ({
        label: `${u.prenom} ${u.nom}`,
        value: u.id,
      })),
    },
    cancel: true,
    ok: { label: $t('reclamations.dialog.detail.assign'), color: 'primary' },
  }).onOk(async (assigneAId: string | null) => {
    if (!props.reclamation || !assigneAId) return;
    enCours.value = 'assigner';
    try {
      const { data } = await api.put(`/reclamations/${props.reclamation.id}/assigner`, { assigneAId });
      $q.notify({ type: 'positive', message: $t('reclamations.dialog.detail.assigned') });
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
    $q.notify({ type: 'warning', message: $t('reclamations.dialog.detail.escalated') });
    emit('escalade', data as Reclamation);
    Object.assign(props.reclamation, data);
  } finally {
    enCours.value = '';
  }
}

function cloturer() {
  if (!props.reclamation) return;
  $q.dialog({
    title: $t('reclamations.dialog.detail.closingNoteTitle'),
    message: $t('reclamations.dialog.detail.closingNotePrompt'),
    prompt: { model: '', isValid: (v: string) => v.trim().length >= 3, type: 'textarea' },
    cancel: true,
    ok: { label: $t('reclamations.dialog.detail.record'), color: 'positive' },
  }).onOk(async (noteClotureValue: string) => {
    if (!props.reclamation || !noteClotureValue.trim()) return;
    enCours.value = 'cloturer';
    try {
      const { data } = await api.post(`/reclamations/${props.reclamation.id}/cloturer`, {
        noteCloture: noteClotureValue.trim(),
      });
      $q.notify({ type: 'positive', message: $t('reclamations.dialog.detail.closingNoteRecorded') });
      emit('cloture', data as Reclamation);
      Object.assign(props.reclamation, data);
    } finally {
      enCours.value = '';
    }
  });
}
</script>

<style scoped lang="scss">
$encre: #1d1d1f;
$chaux-claire: #ffffff;
$blanc-craie: #ffffff;
$vert: #007a4d;
$jaune-fonce: #8a6300;
$rouge: #ce1126;

.reclamation-champ {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: var(--up-encre);
  border-radius: var(--up-rayon-sm);
  font-size: 11px;
  font-weight: 590;
  letter-spacing: -0.01em;

  &--prio {
    box-shadow: none;
    &.prio-BASSE {
      background: var(--up-gris-inerte);
      color: var(--up-encre);
      border: var(--up-filet);
    }
    &.prio-NORMALE {
      background: $jaune-fond;
      color: $jaune-texte;
    }
    &.prio-HAUTE {
      background: $rouge-fond;
      color: #{$rouge};
    }
    &.prio-URGENTE {
      background: $rouge-fond;
      color: #{$rouge};
      animation: clignote 1.4s ease-in-out infinite;
    }
  }
}

@keyframes clignote {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
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
  border-radius: var(--up-rayon-sm);
  font-size: 0.95rem;
}

// Qui parle se lit à l'aplat et au filet complet du message, pas à un bandeau
// latéral coloré.
.reclamation-message {
  background: var(--up-craie);
  border: var(--up-filet-fin);

  &--staff {
    background: var(--up-plaque);
    border-color: $vert;
  }
}
</style>
