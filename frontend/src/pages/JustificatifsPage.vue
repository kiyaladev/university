<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('justificatifs.title')" :subtitle="$t('justificatifs.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutDeposer"
          unelevated
          color="primary"
          no-caps
          icon="post_add"
          :label="$t('justificatifs.actions.record')"
          @click="ouvrirDepot"
        />
      </template>
    </page-header>

    <!-- Un enseignant ne dépose pas lui-même : il doit savoir par où passer. -->
    <q-banner v-if="!peutDeposer" class="note--info q-mb-md">
      <template #avatar><q-icon name="info" /></template>
      {{ $t('justificatifs.banner.info') }}
    </q-banner>

    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row q-col-gutter-sm">
        <div class="col-6 col-md-3">
          <q-select
            v-model="filtres.statut"
            :options="optionsStatuts"
            outlined
            dense
            clearable
            emit-value
            map-options
            :label="$t('justificatifs.filters.status')"
          />
        </div>
        <div class="col-6 col-md-3">
          <q-select
            v-model="filtres.type"
            :options="TYPES_JUSTIFICATIF"
            outlined
            dense
            clearable
            emit-value
            map-options
            :label="$t('justificatifs.filters.reason')"
          />
        </div>
        <div class="col-6 col-md-3">
          <champ-date v-model="filtres.dateDebut" :label="$t('justificatifs.filters.sessionsFrom')" />
        </div>
        <div class="col-6 col-md-3">
          <champ-date v-model="filtres.dateFin" :label="$t('justificatifs.filters.sessionsTo')" />
        </div>
      </q-card-section>
    </q-card>

    <q-table
      flat
      bordered
      class="carte"
      :rows="liste.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :pagination="{ rowsPerPage: 20, sortBy: 'date', descending: true }"
      :loading-label="$t('justificatifs.table.loadingLabel')"
    >
      <template #no-data>
        <etat-vide icone="assignment_turned_in" :titre="messageVide" />
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ champ-justificatif" :class="`champ--${champStatut(p.row.statut)}`">
            <span class="pochoir">{{ libelleStatut(p.row.statut) }}</span>
          </span>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            :aria-label="$t('justificatifs.table.actions.viewAria')"
            @click="detail = p.row"
          >
            <q-tooltip>{{ $t('justificatifs.table.actions.viewTooltip') }}</q-tooltip>
          </q-btn>
          <template v-if="p.row.statut === 'EN_ATTENTE' && peutArbitrer">
            <q-btn
              flat
              dense
              round
              color="positive"
              icon="check"
              :aria-label="$t('justificatifs.table.actions.validateAria')"
              @click="traiter(p.row, 'VALIDE')"
            >
              <q-tooltip>{{ $t('justificatifs.table.actions.validateTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="close"
              :aria-label="$t('justificatifs.table.actions.rejectAria')"
              @click="traiter(p.row, 'REJETE')"
            >
              <q-tooltip>{{ $t('justificatifs.table.actions.rejectTooltip') }}</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </template>
    </q-table>

    <!-- Dépôt d'un justificatif (enseignant) -->
    <dialogue-formulaire
      v-model="dialogDepot"
      :titre="$t('justificatifs.depositDialog.title')"
      :sous-titre="$t('justificatifs.depositDialog.subtitle')"
      taille="s"
      :envoi="enregistrement"
      icone-valider="post_add"
      :libelle-valider="$t('justificatifs.depositDialog.submit')"
      @valider="deposer"
    >
      <div class="q-gutter-md">
        <q-select
          v-model="enseignantChoisi"
          :options="optionsEnseignants"
          outlined
          dense
          emit-value
          map-options
          use-input
          :label="$t('justificatifs.depositDialog.teacher')"
          @filter="filtrerEnseignants"
          @update:model-value="chargerSeancesJustifiables"
        />
        <q-select
          v-model="form.seanceId"
          :options="optionsSeances"
          outlined
          dense
          emit-value
          map-options
          :label="$t('justificatifs.depositDialog.session')"
          :disable="!enseignantChoisi"
          :hint="$t('justificatifs.depositDialog.sessionHint')"
        />
        <q-select
          v-model="form.type"
          :options="TYPES_JUSTIFICATIF"
          outlined
          dense
          emit-value
          map-options
          :label="$t('justificatifs.depositDialog.reason')"
        />
        <q-input
          v-model="form.motif"
          outlined
          dense
          type="textarea"
          rows="3"
          :label="$t('justificatifs.depositDialog.explanation')"
        />
        <q-file
          v-model="fichier"
          outlined
          dense
          :label="$t('justificatifs.depositDialog.file')"
          accept="image/*,.pdf"
          @update:model-value="lireFichier"
        >
          <template #prepend><q-icon name="attach_file" /></template>
        </q-file>
      </div>
    </dialogue-formulaire>

    <!-- Détail -->
    <q-dialog :model-value="!!detail" @update:model-value="detail = null">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section class="text-h6">{{ $t('justificatifs.detailDialog.title') }}</q-card-section>
        <q-card-section v-if="detail">
          <q-list dense>
            <q-item>
              <q-item-section>{{ $t('justificatifs.detailDialog.teacher') }}</q-item-section>
              <q-item-section side>
                {{ detail.enseignant?.nom }} {{ detail.enseignant?.prenom }}
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('justificatifs.detailDialog.session') }}</q-item-section>
              <q-item-section side>
                {{ dateLisible(detail.seance?.date) }} · {{ detail.seance?.heureDebut }}–{{ detail.seance?.heureFin }}
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('justificatifs.detailDialog.reason') }}</q-item-section>
              <q-item-section side>{{ libelleMotif(detail.type) }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('justificatifs.detailDialog.explanation') }}</q-item-section>
              <q-item-section side class="text-right">{{ detail.motif }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section>{{ $t('justificatifs.detailDialog.status') }}</q-item-section>
              <q-item-section side>
                <span class="champ champ-justificatif" :class="`champ--${champStatut(detail.statut)}`">
                  <span class="pochoir">{{ libelleStatut(detail.statut) }}</span>
                </span>
              </q-item-section>
            </q-item>
            <q-item v-if="detail.commentaire">
              <q-item-section>{{ $t('justificatifs.detailDialog.decisionComment') }}</q-item-section>
              <q-item-section side class="text-right">{{ detail.commentaire }}</q-item-section>
            </q-item>
            <q-item v-if="detail.traitePar">
              <q-item-section>{{ $t('justificatifs.detailDialog.arbitratedBy') }}</q-item-section>
              <q-item-section side>
                {{ detail.traitePar.prenom }} {{ detail.traitePar.nom }}
                <span v-if="detail.traiteLe" class="chiffres">
                  · {{ dateLisible(detail.traiteLe) }}
                </span>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-if="detail.piece && peutDeposer" class="q-mt-md">
            <img
              v-if="detail.piece.startsWith('data:image')"
              :src="detail.piece"
              class="full-width"
              :alt="$t('justificatifs.detailDialog.fileAlt')"
            />
            <q-btn v-else flat icon="download" no-caps :label="$t('justificatifs.detailDialog.openAttachment')" :href="detail.piece" target="_blank" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            v-if="detail?.seance"
            flat
            no-caps
            icon="event_note"
            :label="$t('justificatifs.detailDialog.viewSession')"
            :to="lienSeance(detail)"
          />
          <q-btn flat no-caps :label="$t('justificatifs.detailDialog.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import ChampDate from '../components/ChampDate.vue';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import DialogueFormulaire from '../components/DialogueFormulaire.vue';
import { useListePaginee } from '../composables/useListePaginee';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import {
  LIBELLE_STATUT_JUSTIFICATIF,
  TYPES_JUSTIFICATIF,
  aujourdhui,
  dateLisible,
  decalerJours,
} from '../utils/libelles';
import type { Enseignant, Justificatif, Seance } from '../types';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const referentiels = useReferentielsStore();

const seancesJustifiables = ref<Seance[]>([]);
const detail = ref<Justificatif | null>(null);
const dialogDepot = ref(false);
const enregistrement = ref(false);
const fichier = ref<File | null>(null);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const enseignantChoisi = ref<string | null>(null);

const filtres = ref({
  statut: null as string | null,
  type: null as string | null,
  dateDebut: decalerJours(aujourdhui(), -90),
  dateFin: aujourdhui(),
});

/** API non paginée : tout arrive, le q-table pagine. Les filtres vivent dans
 *  l'URL (arrivée par lien « justificatifs à arbitrer » du tableau de bord). */
const liste = reactive(
  useListePaginee<Justificatif, typeof filtres.value>({
    filtres,
    pageSize: 0,
    syncUrl: true,
    charger: ({ filtres: f }) =>
      api
        .get('/justificatifs', {
          params: {
            all: '1',
            statut: f.statut || undefined,
            type: f.type || undefined,
            dateDebut: f.dateDebut,
            dateFin: f.dateFin,
          },
        })
        .then((r) => r.data),
  }),
);

const form = ref({ seanceId: '', type: 'MALADIE', motif: '', piece: undefined as string | undefined });

/** Le champ peint d'un justificatif reprend la grammaire des constats. */
const CHAMP_STATUT_JUSTIFICATIF: Record<string, string> = {
  EN_ATTENTE: 'retard',
  VALIDE: 'present',
  REJETE: 'absent',
};

const optionsStatuts = Object.entries(LIBELLE_STATUT_JUSTIFICATIF).map(([value, label]) => ({
  label,
  value,
}));

const peutArbitrer = computed(() => auth.aRole(['ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT']));
const peutDeposer = computed(() =>
  auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT']),
);

const messageVide = computed(() =>
  filtres.value.statut || filtres.value.type
    ? t('justificatifs.table.emptyFiltered')
    : t('justificatifs.table.emptyDefault'),
);

/** Un justificatif se lit avec sa séance : le registre s'ouvre sur son jour. */
const lienSeance = (j: Justificatif | null) => {
  const jour = String(j?.seance?.date ?? '').slice(0, 10);
  return {
    name: 'seances',
    query: { dateDebut: jour, dateFin: jour, enseignantId: j?.enseignantId },
  };
};

const optionsSeances = computed(() =>
  seancesJustifiables.value.map((s) => ({
    label: `${dateLisible(s.date)} · ${s.heureDebut}–${s.heureFin} · ${s.affectation?.matiere?.intitule}`,
    value: s.id,
  })),
);

const colonnes = computed<QTableColumn[]>(() => [
  {
    name: 'date',
    label: t('justificatifs.table.columns.session'),
    field: (r: Justificatif) =>
      `${dateLisible(r.seance?.date)} ${r.seance?.heureDebut ?? ''}`,
    align: 'left',
    sortable: true,
  },
  {
    name: 'enseignant',
    label: t('justificatifs.table.columns.teacher'),
    field: (r: Justificatif) => `${r.enseignant?.nom ?? ''} ${r.enseignant?.prenom ?? ''}`,
    align: 'left',
  },
  {
    name: 'matiere',
    label: t('justificatifs.table.columns.subject'),
    field: (r: Justificatif) => r.seance?.affectation?.matiere?.intitule ?? '—',
    align: 'left',
  },
  {
    name: 'type',
    label: t('justificatifs.table.columns.reason'),
    field: (r: Justificatif) => libelleMotif(r.type),
    align: 'left',
    sortable: true,
  },
  { name: 'explication', label: t('justificatifs.table.columns.explanation'), field: 'motif', align: 'left' },
  { name: 'statut', label: t('justificatifs.table.columns.status'), field: 'statut', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const champStatut = (s: string) => CHAMP_STATUT_JUSTIFICATIF[s] ?? 'attente';
const libelleStatut = (s: string) => LIBELLE_STATUT_JUSTIFICATIF[s] ?? s;
const libelleMotif = (type?: string | null) =>
  TYPES_JUSTIFICATIF.find((x) => x.value === type)?.label ?? type ?? '—';

/** Le message dit la conséquence : valider excuse l'absence dans les relevés. */
function traiter(j: Justificatif, statut: 'VALIDE' | 'REJETE') {
  const valide = statut === 'VALIDE';
  $q.dialog({
    title: valide ? t('justificatifs.dialogs.validateTitle') : t('justificatifs.dialogs.rejectTitle'),
    message: valide
      ? t('justificatifs.dialogs.validateMessage')
      : t('justificatifs.dialogs.rejectMessage'),
    prompt: { model: '', type: 'text' },
    ok: {
      label: valide ? t('justificatifs.dialogs.validateTitle') : t('justificatifs.dialogs.rejectTitle'),
      color: valide ? 'positive' : 'negative',
      unelevated: true,
      noCaps: true,
    },
    cancel: { label: t('justificatifs.dialogs.doNothing'), flat: true, noCaps: true },
  }).onOk(async (commentaire: string) => {
    await api.put(`/justificatifs/${j.id}/traiter`, { statut, commentaire });
    $q.notify({
      type: 'positive',
      message: valide ? t('justificatifs.messages.validated') : t('justificatifs.messages.rejected'),
    });
    await liste.recharger();
  });
}

function lireFichier(f: File | null) {
  if (!f) {
    form.value.piece = undefined;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => (form.value.piece = String(reader.result));
  reader.readAsDataURL(f);
}

async function ouvrirDepot() {
  form.value = { seanceId: '', type: 'MALADIE', motif: '', piece: undefined };
  fichier.value = null;
  enseignantChoisi.value = null;
  seancesJustifiables.value = [];
  if (!enseignants.value.length) {
    enseignants.value = await referentiels.enseignants();
  }
  dialogDepot.value = true;
}

function filtrerEnseignants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEnseignants.value = enseignants.value
      .filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom} (${e.matricule})`, value: e.id }));
  });
}

/** Seules les séances non assurées de cet enseignant peuvent être justifiées. */
async function chargerSeancesJustifiables() {
  form.value.seanceId = '';
  if (!enseignantChoisi.value) return;
  const { data } = await api.get('/seances', {
    params: {
      enseignantId: enseignantChoisi.value,
      dateDebut: decalerJours(aujourdhui(), -90),
      dateFin: aujourdhui(),
      pageSize: 200,
    },
  });
  seancesJustifiables.value = data.data.filter(
    (s: Seance) => !s.justificatif && (s.statut === 'NON_TENUE' || s.controle?.statut === 'ABSENT'),
  );
}

async function deposer() {
  if (!enseignantChoisi.value || !form.value.seanceId || !form.value.motif.trim()) {
    $q.notify({
      type: 'warning',
      message: t('justificatifs.messages.missingFields'),
    });
    return;
  }
  enregistrement.value = true;
  try {
    await api.post('/justificatifs', { ...form.value, enseignantId: enseignantChoisi.value });
    $q.notify({ type: 'positive', message: t('justificatifs.messages.deposited') });
    dialogDepot.value = false;
    await liste.recharger();
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.champ-justificatif {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  border: var(--up-filet);
}
</style>
