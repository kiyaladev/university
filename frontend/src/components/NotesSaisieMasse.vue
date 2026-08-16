<script setup lang="ts">
/**
 * Saisie des notes « en masse » : gros tableau éditable de type tableur.
 *
 *   ┌──────────────────┬─────────┬────────────┬─────────┐
 *   │ Étudiant         │ N° ins. │ Présent    │ Note /20│
 *   ├──────────────────┼─────────┼────────────┼─────────┤
 *   │ Dupont (L3-MATH) │ I-0001  │ [checkbox] │ [input] │
 *   └──────────────────┴─────────┴────────────┴─────────┘
 *
 * Raccourcis : Tab pour passer à la cellule suivante, Enter pour valider la
 * ligne courante, ↑/↓ pour naviguer entre lignes. Indicateur visuel par ligne
 * (chip « modifié » / « enregistré ») et par groupe (compteur X/Y).
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';

export interface LigneSaisie {
  inscriptionId: string;
  numero: string;
  matricule: string;
  nom: string;
  prenom: string;
  note: number | null;
  present: boolean;
  /** Note brute venant du serveur (null si jamais saisie) */
  noteOriginale: number | null;
}

const props = withDefaults(defineProps<{
  evaluationId: string;
  inscriptions: Array<{
    inscriptionId: string;
    numero: string;
    matricule: string;
    nom: string;
    prenom: string;
    note?: number | null;
    present?: boolean;
  }>;
  notesExistantes?: Array<{ inscriptionId: string; note?: number | null; present?: boolean }>;
  /** Lecture seule (évaluation clôturée, ou utilisateur non autorisé) */
  lectureSeule?: boolean;
  /** Raison affichée si lecture seule */
  motifLectureSeule?: string;
}>(), {
  notesExistantes: () => [],
  lectureSeule: false,
  motifLectureSeule: '',
});

const emit = defineEmits<{
  'enregistrer': [payload: { evaluationId: string; notes: Array<{ inscriptionId: string; note: number | null; present: boolean }> }];
}>();

const lignes = ref<LigneSaisie[]>([]);
const selection = ref<{ ligne: number; colonne: 'present' | 'note' } | null>(null);
const sauvegardeEnCours = ref(false);
const sauvegardeFaite = ref(false);

function construireLignes() {
  const mapExist = new Map(props.notesExistantes.map((n) => [n.inscriptionId, n]));
  lignes.value = props.inscriptions.map((ins) => {
    const existant = mapExist.get(ins.inscriptionId);
    const note = existant?.note ?? ins.note ?? null;
    const present = existant?.present ?? ins.present ?? true;
    return {
      inscriptionId: ins.inscriptionId,
      numero: ins.numero,
      matricule: ins.matricule,
      nom: ins.nom,
      prenom: ins.prenom,
      note,
      present,
      noteOriginale: note,
    };
  });
  sauvegardeFaite.value = false;
}

watch(
  () => [props.inscriptions, props.notesExistantes, props.evaluationId],
  () => construireLignes(),
  { deep: true },
);

onMounted(construireLignes);

const lignesModifiees = computed(() =>
  lignes.value.filter((l) => l.note !== l.noteOriginale || false),
);

const remplies = computed(
  () => lignes.value.filter((l) => l.present && l.note !== null).length,
);
const presentes = computed(
  () => lignes.value.filter((l) => l.present).length,
);
const absents = computed(
  () => lignes.value.filter((l) => !l.present).length,
);
const progression = computed(() =>
  lignes.value.length ? remplies.value / lignes.value.length : 0,
);

function borner(l: LigneSaisie) {
  if (l.note === null || l.note === undefined) return;
  if (l.note < 0) l.note = 0;
  if (l.note > 20) l.note = 20;
}

function surFocus(ligneIdx: number, colonne: 'present' | 'note') {
  selection.value = { ligne: ligneIdx, colonne };
}

function surKeynote(ev: KeyboardEvent, ligneIdx: number) {
  if (!selection.value) return;
  if (ev.key === 'ArrowDown' || ev.key === 'Enter') {
    ev.preventDefault();
    const next = Math.min(lignes.value.length - 1, ligneIdx + 1);
    const cible = next === ligneIdx ? ligneIdx : next;
    focusCellule(cible, 'note');
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    const prev = Math.max(0, ligneIdx - 1);
    focusCellule(prev, 'note');
  }
}

async function focusCellule(idx: number, colonne: 'present' | 'note') {
  await nextTick();
  const el = document.querySelector<HTMLElement>(
    `[data-cellule="${idx}-${colonne}"] input, [data-cellule="${idx}-${colonne}"] .q-checkbox__inner`,
  );
  el?.focus();
  selection.value = { ligne: idx, colonne };
}

async function enregistrer() {
  if (sauvegardeEnCours.value) return;
  sauvegardeEnCours.value = true;
  try {
    emit('enregistrer', {
      evaluationId: props.evaluationId,
      notes: lignes.value.map((l) => ({
        inscriptionId: l.inscriptionId,
        note: l.note,
        present: l.present,
      })),
    });
    sauvegardeFaite.value = true;
  } finally {
    sauvegardeEnCours.value = false;
  }
}

function marquerToutPresent() {
  for (const l of lignes.value) l.present = true;
}
function marquerToutAbsent() {
  for (const l of lignes.value) {
    l.present = false;
    l.note = null;
  }
}

const peutEditer = computed(() => !props.lectureSeule);
</script>

<template>
  <div class="saisie-masse">
    <div class="saisie-masse__entete">
      <div class="saisie-masse__stats">
        <q-chip outline color="primary" icon="edit_note" :label="`${lignes.length} étudiants`" />
        <q-chip outline color="positive" icon="check" :label="`${remplies} notés`" />
        <q-chip outline color="secondary" icon="person" :label="`${presentes} présents`" />
        <q-chip outline color="grey-7" icon="person_off" :label="`${absents} absents`" />
        <q-chip
          v-if="lignesModifiees.length"
          color="warning"
          icon="edit"
          :label="`${lignesModifiees.length} modifié${lignesModifiees.length > 1 ? 's' : ''}`"
        />
      </div>
      <div class="saisie-masse__progression">
        <q-linear-progress
          :value="progression"
          size="14px"
          color="primary"
          track-color="grey-3"
          rounded
          class="saisie-masse__barre"
        >
          <div class="saisie-masse__progress-texte">
            {{ remplies }} / {{ lignes.length }} notes saisies
          </div>
        </q-linear-progress>
      </div>
    </div>

    <div v-if="lectureSeule" class="saisie-masse__alerte q-mb-sm">
      <q-banner dense class="note--info">
        <template #avatar><q-icon name="lock" /></template>
        {{ motifLectureSeule || 'Saisie désactivée pour cette évaluation.' }}
      </q-banner>
    </div>

    <div class="saisie-masse__tableau-carte">
      <div class="saisie-masse__tableau-entete">
        <div class="col-num">N° inscription</div>
        <div class="col-mat">Matricule</div>
        <div class="col-etu">Étudiant</div>
        <div class="col-pres">Présent</div>
        <div class="col-note">Note /20</div>
        <div class="col-eta">État</div>
      </div>

      <div
        v-for="(l, idx) in lignes"
        :key="l.inscriptionId"
        class="saisie-masse__ligne"
        :class="{ 'saisie-masse__ligne--mod': l.note !== l.noteOriginale }"
      >
        <div class="col-num chiffres">{{ l.numero }}</div>
        <div class="col-mat chiffres">{{ l.matricule }}</div>
        <div class="col-etu">
          <div class="text-weight-medium">{{ l.prenom }} {{ l.nom }}</div>
        </div>
        <div
          class="col-pres"
          :data-cellule="`${idx}-present`"
          @click="surFocus(idx, 'present')"
        >
          <q-checkbox
            v-model="l.present"
            :disable="!peutEditer"
            dense
            color="primary"
            @update:model-value="(v) => { l.present = !!v; if (!v) l.note = null; }"
            @focus="surFocus(idx, 'present')"
          />
        </div>
        <div
          class="col-note"
          :data-cellule="`${idx}-note`"
          @click="surFocus(idx, 'note')"
        >
          <q-input
            v-model.number="l.note"
            :disable="!peutEditer || !l.present"
            dense
            outlined
            type="number"
            min="0"
            max="20"
            step="0.25"
            input-class="text-center chiffres"
            :placeholder="l.present ? '/20' : 'absent'"
            @update:model-value="borner(l)"
            @focus="surFocus(idx, 'note')"
            @keydown="(ev) => surKeynote(ev, idx)"
          />
        </div>
        <div class="col-eta">
          <q-badge
            v-if="l.note === null && l.present"
            color="warning"
            label="manquante"
          />
          <q-badge
            v-else-if="!l.present"
            color="grey-6"
            label="absent"
          />
          <q-badge
            v-else-if="l.note !== l.noteOriginale"
            color="warning"
            icon="edit"
            label="modifié"
          />
          <q-badge
            v-else
            color="positive"
            icon="task_alt"
            label="enregistré"
          />
        </div>
      </div>

      <div v-if="!lignes.length" class="saisie-masse__vide">
        Aucun étudiant à noter.
      </div>
    </div>

    <div class="saisie-masse__actions">
      <div class="row q-gutter-sm">
        <q-btn
          v-if="peutEditer"
          flat
          dense
          no-caps
          icon="done_all"
          label="Tous présents"
          @click="marquerToutPresent"
        />
        <q-btn
          v-if="peutEditer"
          flat
          dense
          no-caps
          icon="person_off"
          label="Tous absents"
          @click="marquerToutAbsent"
        />
      </div>
      <q-space />
      <q-btn
        v-if="peutEditer"
        unelevated
        color="primary"
        no-caps
        icon="save"
        label="Enregistrer tout"
        :loading="sauvegardeEnCours"
        :disable="!lignesModifiees.length"
        @click="enregistrer"
      >
        <q-tooltip v-if="!lignesModifiees.length && sauvegardeFaite">
          Aucune note modifiée depuis le dernier enregistrement
        </q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.saisie-masse {
  display: grid;
  gap: var(--up-3);
}

.saisie-masse__entete {
  display: flex;
  flex-wrap: wrap;
  gap: var(--up-3);
  align-items: center;
  justify-content: space-between;
}

.saisie-masse__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--up-2);
}

.saisie-masse__progression {
  flex: 1 1 260px;
  max-width: 360px;
}

.saisie-masse__barre {
  border: var(--up-filet-fin);
}

.saisie-masse__progress-texte {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--up-craie);
}

.saisie-masse__tableau-carte {
  background: var(--up-craie);
  border: var(--up-filet);
}

.saisie-masse__tableau-entete,
.saisie-masse__ligne {
  display: grid;
  grid-template-columns: 110px 110px 1fr 80px 110px 130px;
  align-items: center;
  gap: var(--up-2);
  padding: 8px 12px;
}

.saisie-masse__tableau-entete {
  background: var(--up-encre);
  color: var(--up-craie);
  font-family: 'Anton', 'Archivo Variable', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 11px;
  font-weight: 400;
}

.saisie-masse__ligne + .saisie-masse__ligne {
  border-top: var(--up-filet-fin);
}

.saisie-masse__ligne:hover {
  background: rgba(16, 37, 30, 0.04);
}

.saisie-masse__ligne--mod {
  background: rgba(239, 183, 0, 0.12);
}

.col-pres,
.col-note {
  display: flex;
  justify-content: center;
}

.col-note :deep(.q-field) {
  width: 100%;
  max-width: 110px;
}

.col-eta {
  display: flex;
  justify-content: center;
}

.saisie-masse__vide {
  padding: var(--up-5);
  text-align: center;
  color: var(--up-encre-douce);
}

.saisie-masse__actions {
  display: flex;
  align-items: center;
  gap: var(--up-2);
}

@media (max-width: 599px) {
  .saisie-masse__tableau-entete,
  .saisie-masse__ligne {
    grid-template-columns: 1fr 1fr;
    gap: var(--up-2);
  }
  .col-num,
  .col-mat,
  .col-pres,
  .col-eta {
    display: none;
  }
}
</style>