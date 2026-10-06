<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('enseignants.header.title') }}</h1>
        <div class="page-sous-titre">{{ $t('enseignants.header.subtitle') }}</div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="auth.peutPlanifier"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('enseignants.header.newTeacher')"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('enseignants.filters.searchPlaceholder')"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.departementId"
          :options="optionsDepartements"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('enseignants.filters.departementLabel')"
        />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('enseignants.filters.statutLabel')"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="enseignants"
          :modes="['tableau', 'cartes']"
          @update:mode="(m) => (modeVue = m as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="enseignants"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="person" size="34px" />
          <div class="pochoir">{{ messageVide }}</div>
          <q-btn
            v-if="auth.peutPlanifier && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('enseignants.emptyState.createFirst')"
            @click="ouvrir(null)"
          />
          <q-btn
            v-else-if="filtresActifs"
            flat
            no-caps
            icon="refresh"
            :label="$t('enseignants.emptyState.clearFilters')"
            @click="reinitialiser"
          />
        </div>
      </template>

      <template #body-cell-nom="p">
        <q-td :props="p">
          <div>{{ p.row.nom }} {{ p.row.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-chip dense :color="couleurStatut(p.row.statut)" text-color="white">
            {{ LIBELLE_STATUT_ENSEIGNANT[p.row.statut] ?? p.row.statut }}
          </q-chip>
          <q-badge v-if="!p.row.actif" color="grey-7" class="q-ml-xs">{{ $t('enseignants.table.inactive') }}</q-badge>
        </q-td>
      </template>

      <template #body-cell-compte="p">
        <q-td :props="p" class="text-center">
          <q-icon
            :name="p.row.user ? 'check_circle' : 'remove_circle_outline'"
            :color="p.row.user ? 'positive' : 'grey-5'"
          />
          <q-tooltip>
            {{ p.row.user ? t('enseignants.table.accountTooltip', { email: p.row.user.email }) : $t('enseignants.table.noAccount') }}
          </q-tooltip>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="assignment_ind"
            :aria-label="$t('enseignants.table.actionsAria.charges')"
            @click="voirCharges(p.row)"
          >
            <q-tooltip>{{ $t('enseignants.table.actionsTooltip.charges') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            color="primary"
            icon="verified_user"
            :aria-label="$t('enseignants.table.actionsAria.moyens')"
            @click="ouvrirMoyens(p.row)"
          >
            <q-tooltip>{{ $t('enseignants.table.actionsTooltip.moyens') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="assessment"
            :aria-label="$t('enseignants.table.actionsAria.fiche')"
            @click="imprimerFiche(p.row)"
          >
            <q-tooltip>{{ $t('enseignants.table.actionsTooltip.fiche') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.peutPlanifier"
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('enseignants.table.actionsAria.modifier')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('enseignants.table.actionsTooltip.modifier') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.estAdmin"
            flat
            dense
            round
            color="negative"
            icon="delete"
            :aria-label="$t('enseignants.table.actionsAria.supprimer')"
            @click="supprimer(p.row)"
          >
            <q-tooltip>{{ $t('enseignants.table.actionsTooltip.supprimer') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="grille-cartes">
      <q-card v-for="e in enseignants" :key="e.id" flat bordered class="carte grille-cartes__carte">
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <q-chip dense :color="couleurStatut(e.statut)" text-color="white">
              {{ LIBELLE_STATUT_ENSEIGNANT[e.statut] ?? e.statut }}
            </q-chip>
            <q-badge v-if="!e.actif" color="grey-7">{{ $t('enseignants.table.inactive') }}</q-badge>
            <q-space />
            <div class="text-caption text-grey-7">{{ e.matricule }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">{{ e.nom }} {{ e.prenom }}</div>
          <div class="text-caption text-grey-7">{{ e.grade || $t('enseignants.cards.gradeNonRenseigne') }}</div>
          <div class="text-caption text-grey-7">{{ e.departement?.nom ?? $t('enseignants.cards.sansDepartement') }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            <q-icon name="call" size="14px" /> {{ e.telephone || '—' }}
            <span class="q-ml-sm">
              <q-icon
                :name="e.user ? 'check_circle' : 'remove_circle_outline'"
                :color="e.user ? 'positive' : 'grey-5'"
                size="14px"
              />
              {{ e.user ? $t('enseignants.cards.compteActif') : $t('enseignants.cards.sansCompte') }}
            </span>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn
            flat
            dense
            no-caps
            icon="assignment_ind"
            :label="$t('enseignants.cards.charges')"
            @click="voirCharges(e)"
          />
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            icon="verified_user"
            :label="$t('enseignants.cards.attestation')"
            @click="ouvrirMoyens(e)"
          />
          <q-btn
            v-if="auth.peutPlanifier"
            flat
            dense
            no-caps
            icon="edit"
            :label="$t('enseignants.cards.modifier')"
            @click="ouvrir(e)"
          />
        </q-card-actions>
      </q-card>
      <div v-if="!enseignants.length && !chargement" class="etat-vide">
        <q-icon name="person" size="34px" />
        <div class="pochoir">{{ messageVide }}</div>
        <q-btn
          v-if="auth.peutPlanifier && !filtresActifs"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('enseignants.emptyState.createFirst')"
          @click="ouvrir(null)"
        />
        <q-btn
          v-else-if="filtresActifs"
          flat
          no-caps
          icon="refresh"
          :label="$t('enseignants.emptyState.clearFilters')"
          @click="reinitialiser"
        />
      </div>
    </div>

    <pagination-bar
      v-if="enseignants.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <enseignant-dialog
      v-model="dialogOuvert"
      :enseignant="enseignantEdite"
      :departements="departements"
      @enregistre="charger"
    />

    <!-- Moyens d'attestation : code personnel et empreinte -->
    <q-dialog v-model="dialogMoyens">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ $t('enseignants.moyensDialog.title') }}</div>
          <div class="text-caption text-grey-7">
            {{ $t('enseignants.moyensDialog.subtitle', { nom: enseignantMoyens?.nom, prenom: enseignantMoyens?.prenom }) }}
          </div>
        </q-card-section>

        <q-linear-progress v-if="chargementMoyens" indeterminate color="primary" />

        <q-list v-if="!chargementMoyens" separator>
          <q-item>
            <q-item-section avatar><q-icon name="dialpad" color="secondary" /></q-item-section>
            <q-item-section>
              <q-item-label>{{ $t('enseignants.moyensDialog.codePersonnel.label') }}</q-item-label>
              <q-item-label caption>
                {{ moyens?.codePin ? $t('enseignants.moyensDialog.codePersonnel.defined') : $t('enseignants.moyensDialog.codePersonnel.undefined') }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                no-caps
                :label="moyens?.codePin ? $t('enseignants.moyensDialog.codePersonnel.reset') : $t('enseignants.moyensDialog.codePersonnel.generate')"
                @click="reinitialiserPin"
              />
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar><q-icon name="fingerprint" color="accent" /></q-item-section>
            <q-item-section>
              <q-item-label>{{ $t('enseignants.moyensDialog.empreinte.label') }}</q-item-label>
              <q-item-label caption>
                {{
                  moyens?.empreinte
                    ? t('enseignants.moyensDialog.empreinte.enrolled', { doigt: moyens.empreinteDoigt })
                    : passerellePrete
                      ? $t('enseignants.moyensDialog.empreinte.notEnrolledReady')
                      : $t('enseignants.moyensDialog.empreinte.notEnrolledNoReader')
                }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                no-caps
                :label="moyens?.empreinte ? $t('enseignants.moyensDialog.empreinte.reenroll') : $t('enseignants.moyensDialog.empreinte.enroll')"
                :disable="!passerellePrete"
                :loading="enrolementEnCours"
                @click="enrolerEmpreinte"
              >
                <q-tooltip v-if="!passerellePrete">
                  {{ $t('enseignants.moyensDialog.empreinte.pluginTooltip') }}
                </q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>

        <q-banner v-if="codeGenere" class="note--valide q-ma-md">
          <template #avatar><q-icon name="key" /></template>
          {{ $t('enseignants.moyensDialog.newCodeLabel') }} <strong class="text-h6">{{ codeGenere }}</strong><br />
          <span class="text-caption">{{ $t('enseignants.moyensDialog.newCodeHint') }}</span>
        </q-banner>

        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('enseignants.moyensDialog.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import EnseignantDialog from '../components/EnseignantDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import { useImpressionFicheEnseignant } from '../composables/useImpressionFicheEnseignant';
import {
  LIBELLE_STATUT_ENSEIGNANT,
  STATUTS_ENSEIGNANT,
  aujourdhui,
  decalerJours,
  montantLisible,
  passerelleConfiguree,
  urlPasserelle,
} from '../utils/libelles';
import type { Departement, Enseignant, MoyensAttestation, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { ouvrir: ouvrirFicheEnseignant } = useImpressionFicheEnseignant();

const enseignants = ref<Enseignant[]>([]);
const departements = ref<Departement[]>([]);
const chargement = ref(false);
const modeVue = ref<'tableau' | 'cartes'>('tableau');
const dialogOuvert = ref(false);
const enseignantEdite = ref<Enseignant | null>(null);

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const filtres = ref<Record<string, any>>({});

const dialogMoyens = ref(false);
const chargementMoyens = ref(false);
const enseignantMoyens = ref<Enseignant | null>(null);
const moyens = ref<MoyensAttestation | null>(null);
const passerellePrete = ref(false);
const enrolementEnCours = ref(false);
const codeGenere = ref('');

const optionsDepartements = computed(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);
const optionsStatuts = STATUTS_ENSEIGNANT.map((s) => ({
  label: LIBELLE_STATUT_ENSEIGNANT[s] ?? s,
  value: s,
}));

const filtresActifs = computed(() =>
  Boolean(filtres.value.recherche || filtres.value.departementId || filtres.value.statut),
);
const messageVide = computed(() =>
  filtresActifs.value
    ? t('enseignants.emptyState.filtered')
    : t('enseignants.emptyState.none'),
);

const couleurStatut = (s: string) =>
  s === 'PERMANENT' ? 'primary' : s === 'VACATAIRE' ? 'accent' : 'secondary';

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('enseignants.filters.chips.search', { q: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.departementId) {
    const d = departements.value.find((x) => x.id === filtres.value.departementId);
    cs.push({
      label: t('enseignants.filters.chips.departement', { nom: d?.nom ?? '?' }),
      value: filtres.value.departementId,
      icone: 'apartment',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('enseignants.filters.chips.statut', {
        statut: LIBELLE_STATUT_ENSEIGNANT[filtres.value.statut] ?? filtres.value.statut,
      }),
      value: filtres.value.statut,
      icone: 'badge',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'nom', label: t('enseignants.table.columns.nom'), field: 'nom', align: 'left', sortable: true },
  { name: 'grade', label: t('enseignants.table.columns.grade'), field: (r: Enseignant) => r.grade || '—', align: 'left' },
  { name: 'statut', label: t('enseignants.table.columns.statut'), field: 'statut', align: 'left', sortable: true },
  {
    name: 'departement',
    label: t('enseignants.table.columns.departement'),
    field: (r: Enseignant) => r.departement?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'taux',
    label: t('enseignants.table.columns.taux'),
    field: (r: Enseignant) => (r.tauxHoraire ? montantLisible(r.tauxHoraire) : '—'),
    align: 'right',
  },
  { name: 'telephone', label: t('enseignants.table.columns.telephone'), field: (r: Enseignant) => r.telephone || '—', align: 'left' },
  { name: 'compte', label: t('enseignants.table.columns.compte'), field: 'id', align: 'center' },
  { name: 'actions', label: t('enseignants.table.columns.actions'), field: 'id', align: 'right' },
]);

function ouvrir(e: Enseignant | null) {
  enseignantEdite.value = e;
  dialogOuvert.value = true;
}

/** Un enseignant se lit d'abord par ce qu'il enseigne : on ouvre ses charges. */
function voirCharges(e: Enseignant) {
  void router.push({ path: '/affectations', query: { enseignantId: e.id } });
}

// ------------------------------------------------- moyens d'attestation

async function ouvrirMoyens(e: Enseignant) {
  enseignantMoyens.value = e;
  codeGenere.value = '';
  moyens.value = null;
  dialogMoyens.value = true;
  chargementMoyens.value = true;

  try {
    const { data } = await api.get(`/attestation/enseignants/${e.id}/moyens`);
    moyens.value = data;
  } catch (err: any) {
    $q.notify({
      type: 'negative',
      message: err?.response?.data?.message ?? t('enseignants.messages.moyensUnreadable'),
    });
    dialogMoyens.value = false;
    return;
  } finally {
    chargementMoyens.value = false;
  }

  // Le lecteur d'empreintes est branché sur le poste, pas sur le serveur.
  if (!passerelleConfiguree()) {
    passerellePrete.value = false;
    return;
  }
  try {
    const r = await fetch(`${urlPasserelle()}/etat`, { signal: AbortSignal.timeout(2500) });
    passerellePrete.value = (await r.json()).pret === true;
  } catch {
    passerellePrete.value = false;
  }
}

function reinitialiserPin() {
  $q.dialog({
    title: t('enseignants.messages.resetPinTitle'),
    message: t('enseignants.messages.resetPinMessage'),
    cancel: { label: t('enseignants.messages.cancel'), flat: true, noCaps: true },
    ok: { color: 'primary', label: t('enseignants.messages.generate'), unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      const { data } = await api.post(
        `/attestation/enseignants/${enseignantMoyens.value!.id}/code-pin/reinitialiser`,
      );
      codeGenere.value = data.code;
      moyens.value = { ...moyens.value!, codePin: true };
    } catch (e: any) {
      $q.notify({
        type: 'negative',
        message: e?.response?.data?.message ?? t('enseignants.messages.pinGenerationFailed'),
      });
    }
  });
}

/**
 * Le consentement se recueille devant l'enseignant, avant la lecture. Le refus
 * est un droit sans conséquence : le code personnel et la signature restent des
 * moyens de plein exercice.
 */
function recueillirConsentement(): Promise<boolean> {
  return new Promise((resolve) => {
    $q.dialog({
      title: t('enseignants.messages.consentTitle'),
      html: false,
      message: t('enseignants.messages.consentMessage'),
      cancel: { label: t('enseignants.messages.consentRefuse'), flat: true, noCaps: true },
      ok: { label: t('enseignants.messages.consentAccept'), color: 'primary', unelevated: true, noCaps: true },
      persistent: true,
    })
      .onOk(() => resolve(true))
      .onCancel(() => resolve(false));
  });
}

async function enrolerEmpreinte() {
  if (!(await recueillirConsentement())) {
    $q.notify({
      type: 'info',
      message: t('enseignants.messages.enrolementAborted'),
      icon: 'pin',
    });
    return;
  }

  enrolementEnCours.value = true;
  try {
    const id = enseignantMoyens.value!.id;
    const reponse = await fetch(`${urlPasserelle()}/enroler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enseignantId: id }),
      signal: AbortSignal.timeout(30000),
    });
    const capture = await reponse.json();
    if (!reponse.ok) throw new Error(capture.erreur ?? t('enseignants.messages.enrolementReadFailed'));

    await api.put(`/attestation/enseignants/${id}/empreinte`, {
      template: capture.template,
      doigt: 'index droit',
      horodatage: capture.horodatage,
      signature: capture.signature,
      qualite: capture.qualite,
      consentement: true,
    });

    $q.notify({ type: 'positive', message: t('enseignants.messages.enrolementSuccess', { qualite: capture.qualite }) });
    moyens.value = { ...moyens.value!, empreinte: true, empreinteDoigt: 'index droit' };
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.message ?? t('enseignants.messages.enrolementFailed') });
  } finally {
    enrolementEnCours.value = false;
  }
}

function imprimerFiche(e: Enseignant) {
  const debut = decalerJours(aujourdhui(), -90);
  ouvrirFicheEnseignant(e.id, debut, aujourdhui());
}

function supprimer(e: Enseignant) {
  $q.dialog({
    title: t('enseignants.messages.deleteTitle'),
    message: t('enseignants.messages.deleteMessage', { nom: e.nom, prenom: e.prenom }),
    cancel: { label: t('enseignants.messages.cancel'), flat: true, noCaps: true },
    ok: { color: 'negative', label: t('enseignants.messages.delete'), unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.delete(`/enseignants/${e.id}`);
      $q.notify({ type: 'positive', message: t('enseignants.messages.deleteSuccess') });
      await charger();
    } catch (err: any) {
      $q.notify({
        type: 'negative',
        message: err?.response?.data?.message ?? t('enseignants.messages.deleteFailed'),
      });
    }
  });
}

function parametres(tout = false) {
  const params: Record<string, any> = tout
    ? { all: '1' }
    : { page: page.value, pageSize: pageSize.value };
  if (filtres.value.recherche) params.search = filtres.value.recherche;
  if (filtres.value.departementId) params.departementId = filtres.value.departementId;
  if (filtres.value.statut) params.statut = filtres.value.statut;
  return params;
}

async function charger(tout = false) {
  chargement.value = true;
  try {
    const { data } = await api.get('/enseignants', { params: parametres(tout) });
    enseignants.value = data.data ?? [];
    total.value = data.total ?? enseignants.value.length;
  } catch (e: any) {
    enseignants.value = [];
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? t('enseignants.messages.loadFailed'),
    });
  } finally {
    chargement.value = false;
  }
}

function chargerTout() {
  page.value = 1;
  return charger(true);
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  void charger();
}

watch(
  () => [filtres.value.recherche, filtres.value.departementId, filtres.value.statut],
  () => {
    page.value = 1;
    void charger();
  },
);

onMounted(async () => {
  const { data } = await api.get('/departements', { params: { all: '1' } });
  departements.value = data.data;

  // Arrivée depuis « Utilisateurs » : la fiche visée est pré-recherchée.
  const depuis: Record<string, any> = {};
  for (const cle of ['recherche', 'departementId', 'statut']) {
    const v = route.query[cle];
    if (typeof v === 'string' && v) depuis[cle] = v;
  }
  if (Object.keys(depuis).length) {
    filtres.value = depuis;
    return; // le watcher déclenche le chargement
  }
  await charger();
});
</script>

<style scoped lang="scss">
.grille-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.grille-cartes__carte {
  background: var(--up-plaque);
}
</style>
