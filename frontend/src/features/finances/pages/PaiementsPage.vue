<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('common.fields.payments')" :subtitle="$t('paiements.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('paiements.actions.new')"
          @click="dialogPaiement = true"
        />
      </template>
    </en-tete-page>

    <!-- Arrivée depuis un dossier ou une fiche étudiant : le ciblage est annoncé. -->
    <q-banner v-if="libelleCible" dense class="note--info q-mb-md">
      <template #avatar><q-icon name="filter_alt" /></template>
      {{ libelleCible }}
      <template #action>
        <q-btn flat dense no-caps :label="$t('paiements.actions.viewAll')" @click="retirerCible" />
      </template>
    </q-banner>

    <div class="resume-liste" role="status">
      <span
        >{{ $t('paiements.kpis.totalCollected') }} :
        <strong>{{ montantLisible(kpis.totalEncaisse) }} {{ $t('common.units.gnf') }}</strong></span
      >
      <span
        >{{ $t('paiements.kpis.pending') }} : <strong>{{ kpis.enAttente }}</strong></span
      >
      <span v-if="kpis.echoues"
        >{{ $t('paiements.kpis.failed') }} : <strong>{{ kpis.echoues }}</strong></span
      >
    </div>

    <!-- Le registre est paginé côté serveur : ces totaux portent sur ce qui est affiché. -->
    <div class="text-caption text-grey-7 q-mb-md">
      {{
        $t('paiements.summary', {
          count: liste.lignes.length,
          total: liste.total,
          plural: liste.lignes.length > 1 ? 's' : '',
        })
      }}
    </div>

    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('paiements.filters.searchPlaceholder')"
      @reinitialiser="reinitialiser"
    >
      <template #principaux>
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.status')"
        />
      </template>
      <template #avances>
        <q-select
          v-model="filtres.mode"
          :options="optionsModes"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('paiements.filters.mode')"
        />
        <q-select
          v-model="filtres.operateur"
          :options="optionsOperateurs"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.operator')"
        />
        <q-input
          v-model="filtres.motif"
          outlined
          dense
          clearable
          :label="$t('common.fields.motif')"
          :placeholder="$t('paiements.filters.reasonPlaceholder')"
        />
        <champ-recherche
          v-model="filtres.inscriptionId"
          endpoint="/inscriptions"
          :label-fn="(i) => `${i.numero} — ${i.etudiant?.nom ?? ''} ${i.etudiant?.prenom ?? ''}`"
          :label="$t('paiements.filters.enrollment')"
          clearable
        />
        <champ-recherche
          v-model="filtres.etudiantId"
          endpoint="/etudiants"
          :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
          :label="$t('common.fields.student')"
          clearable
        />
        <champ-date v-model="filtres.dateDebut" :label="$t('paiements.filters.from')" />
        <champ-date v-model="filtres.dateFin" :label="$t('paiements.filters.to')" />
      </template>
    </barre-filtres>

    <tableau-paiements
      v-if="modeVue === 'tableau'"
      :lignes="paiementsFiltres"
      :chargement="liste.chargement"
      :message-vide="messageVide"
      :filtres-actifs="filtresActifs"
      :peut-creer="peutCreer"
      :modules-ouverts="modulesOuverts"
      @detail="ouvrirDetail"
      @inscription="voirInscription"
      @etudiant="voirEtudiant"
      @module="ouvrirModule"
      @simuler="simuler"
      @annuler="ouvrirAnnulation"
      @reinitialiser="reinitialiser"
      @creer="dialogPaiement = true"
    />

    <q-linear-progress
      :aria-label="$t('common.messages.loading')"
      v-if="modeVue === 'cartes' && liste.chargement"
      indeterminate
      color="primary"
      class="q-mb-sm"
    />

    <cartes-paiements
      v-else-if="modeVue === 'cartes'"
      :lignes="paiementsFiltres"
      :message-vide="messageVide"
      :filtres-actifs="filtresActifs"
      :peut-creer="peutCreer"
      :modules-ouverts="modulesOuverts"
      @detail="ouvrirDetail"
      @inscription="voirInscription"
      @etudiant="voirEtudiant"
      @module="ouvrirModule"
      @simuler="simuler"
      @annuler="ouvrirAnnulation"
      @reinitialiser="reinitialiser"
      @creer="dialogPaiement = true"
    />

    <barre-pagination
      v-if="liste.lignes.length"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-paiement v-model="dialogPaiement" @paye="liste.recharger()" />

    <!-- Détail d'une transaction -->
    <dialogue-detail-paiement v-model:ouvert="dialogDetail" :paiement="detail" />

    <dialogue-annulation-paiement
      v-model:ouvert="dialogAnnulation"
      :paiement="paiementAnnuler"
      :envoi="annulationEnCours"
      @valider="confirmerAnnulation"
    />
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useAuthStore } from '@/stores/auth';
import DialoguePaiement from '@/shared/components/DialoguePaiement.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import TableauPaiements from '../components/TableauPaiements.vue';
import CartesPaiements from '../components/CartesPaiements.vue';
import DialogueDetailPaiement from '../components/DialogueDetailPaiement.vue';
import DialogueAnnulationPaiement from '../components/DialogueAnnulationPaiement.vue';
import { ROUTE_SOURCE, paiementsService, routeModule } from '../services/paiements';
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_OPERATEUR_MM,
  LIBELLE_STATUT_PAIEMENT,
  dateLisible,
  montantLisible,
} from '@/shared/utils/libelles';
import { elements } from '@/shared/utils/collections';
import type { Etudiant, Inscription, ModePaiement, Paiement, StatutPaiement, ChipFiltre, FiltresPage } from '@/types';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const modeVue = usePresentationListe();

/** `?inscription=<id>` ou `?etudiant=<id>` : registre ciblé dès l'ouverture. */
const cibleUrl = (cle: string) => (typeof route.query[cle] === 'string' && route.query[cle]) || null;
const inscriptionUrl = cibleUrl('inscription');

const filtres = ref<FiltresPage>({
  recherche: '',
  statut: null,
  mode: null,
  operateur: null,
  motif: '',
  inscriptionId: inscriptionUrl,
  etudiantId: inscriptionUrl ? null : cibleUrl('etudiant'),
  dateDebut: null,
  dateFin: null,
});

/**
 * Registre paginé côté serveur. L'opérateur, le motif et les dates ne sont
 * pas compris par `GET /paiements` : ils filtrent la page affichée.
 */
const liste = reactive(
  useListePaginee<Paiement>({
    filtres,
    clesLocales: ['operateur', 'motif', 'dateDebut', 'dateFin'],
    charger: ({ filtres: f, ...p }) =>
      paiementsService.liste({
        ...pageApi(p),
        search: texteApi(f.recherche),
        statut: f.statut || undefined,
        mode: f.mode || undefined,
        inscriptionId: f.inscriptionId || undefined,
        etudiantId: f.etudiantId || undefined,
      }),
  }),
);
/** Contexte reçu en paramètre d'URL (`?inscription=…` ou `?etudiant=…`). */
const dossierCible = ref<Inscription | null>(null);
const etudiantCible = ref<Etudiant | null>(null);

const dialogPaiement = ref(false);
const dialogDetail = ref(false);
const detail = ref<Paiement | null>(null);
const dialogAnnulation = ref(false);
const paiementAnnuler = ref<Paiement | null>(null);
const annulationEnCours = ref(false);

const peutCreer = computed(() => auth.peut('paiements.creer'));

/** Écrans de gestion que le rôle courant a le droit d'ouvrir. */
const modulesOuverts = computed(() => {
  const ouverts: Record<string, boolean> = {};
  for (const [source, chemin] of Object.entries(ROUTE_SOURCE)) {
    const roles = router.resolve(chemin).meta.roles as Parameters<typeof auth.aRole>[0] | undefined;
    ouverts[source] = !roles || auth.aRole(roles);
  }
  return ouverts;
});

const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_PAIEMENT).map(([value, label]) => ({ value, label })),
);
const optionsModes = computed(() => Object.entries(LIBELLE_MODE_PAIEMENT).map(([value, label]) => ({ value, label })));
const optionsOperateurs = computed(() =>
  Object.entries(LIBELLE_OPERATEUR_MM).map(([value, label]) => ({ value, label })),
);

/** Contexte d'arrivée, résumé en une phrase au-dessus du registre. */
const libelleCible = computed(() => {
  if (dossierCible.value) {
    const d = dossierCible.value;
    const qui = d.etudiant
      ? t('paiements.context.enrollmentWho', { prenom: d.etudiant.prenom, nom: d.etudiant.nom })
      : '';
    return t('paiements.context.enrollment', { numero: d.numero, who: qui });
  }
  if (filtres.value.inscriptionId && !dossierCible.value) {
    return t('paiements.context.enrollmentGeneric');
  }
  if (etudiantCible.value) {
    const e = etudiantCible.value;
    return t('paiements.context.student', { prenom: e.prenom, nom: e.nom, matricule: e.matricule });
  }
  return '';
});

/** Au moins un critère est posé : l'état vide se répare en réinitialisant. */
const filtresActifs = computed(() =>
  Object.entries(filtres.value).some(([, v]) => v !== null && v !== undefined && v !== ''),
);

const messageVide = computed(() =>
  filtresActifs.value ? t('paiements.emptyState.filtered') : t('paiements.emptyState.default'),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('paiements.chips.search', { query: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('paiements.chips.status', {
        status: LIBELLE_STATUT_PAIEMENT[filtres.value.statut as StatutPaiement] ?? filtres.value.statut,
      }),
      value: filtres.value.statut,
      icone: 'flag',
    });
  }
  if (filtres.value.mode) {
    cs.push({
      label: t('paiements.chips.mode', {
        mode: LIBELLE_MODE_PAIEMENT[filtres.value.mode as ModePaiement] ?? filtres.value.mode,
      }),
      value: filtres.value.mode,
      icone: 'payments',
    });
  }
  if (filtres.value.operateur) {
    cs.push({
      label: t('paiements.chips.operator', {
        operator: LIBELLE_OPERATEUR_MM[filtres.value.operateur] ?? filtres.value.operateur,
      }),
      value: filtres.value.operateur,
      icone: 'cell_tower',
    });
  }
  if (filtres.value.motif) {
    cs.push({
      label: t('paiements.chips.reason', { reason: filtres.value.motif }),
      value: filtres.value.motif,
      icone: 'description',
    });
  }
  if (filtres.value.inscriptionId) {
    cs.push({
      label: t('paiements.chips.enrollment', {
        numero: dossierCible.value?.numero ?? t('paiements.chips.enrollmentSelected'),
      }),
      value: filtres.value.inscriptionId,
      icone: 'how_to_reg',
    });
  }
  if (filtres.value.etudiantId) {
    cs.push({
      label: t('paiements.chips.student', {
        matricule: etudiantCible.value?.matricule ?? t('paiements.chips.studentSelected'),
      }),
      value: filtres.value.etudiantId,
      icone: 'person',
    });
  }
  if (filtres.value.dateDebut) {
    cs.push({
      label: t('paiements.chips.from', { date: dateLisible(filtres.value.dateDebut) }),
      value: filtres.value.dateDebut,
      icone: 'event',
    });
  }
  if (filtres.value.dateFin) {
    cs.push({
      label: t('paiements.chips.to', { date: dateLisible(filtres.value.dateFin) }),
      value: filtres.value.dateFin,
      icone: 'event',
    });
  }
  return cs;
});

const kpis = computed(() => {
  const lignes = liste.lignes;
  let totalEncaisse = 0;
  let enAttente = 0;
  let echoues = 0;
  for (const p of lignes) {
    if (p.statut === 'REUSSI') totalEncaisse += p.montant;
    if (p.statut === 'EN_ATTENTE') enAttente++;
    if (p.statut === 'ECHOUE') echoues++;
  }
  return { totalEncaisse, enAttente, echoues };
});

/** Filtrage client pour les critères que le backend ne gère pas encore. */
const paiementsFiltres = computed(() => {
  let lignes = liste.lignes;
  if (filtres.value.operateur) {
    lignes = lignes.filter((p) => p.operateur === filtres.value.operateur);
  }
  if (filtres.value.motif) {
    const needle = String(filtres.value.motif).toLowerCase();
    lignes = lignes.filter((p) => (p.motif ?? '').toLowerCase().includes(needle));
  }
  if (filtres.value.dateDebut) {
    const d = new Date(filtres.value.dateDebut).getTime();
    lignes = lignes.filter((p) => new Date(p.horodatage).getTime() >= d);
  }
  if (filtres.value.dateFin) {
    const d = new Date(filtres.value.dateFin).getTime() + 86_400_000 - 1;
    lignes = lignes.filter((p) => new Date(p.horodatage).getTime() <= d);
  }
  return lignes;
});

function ouvrirDetail(p: Paiement) {
  detail.value = p;
  dialogDetail.value = true;
}

/**
 * Retour au dossier d'inscription qui porte le paiement : par l'étudiant si
 * on le connaît, sinon par le numéro de dossier posé en recherche.
 */
function voirInscription(p: Paiement) {
  const etudiantId = p.etudiantId ?? p.inscription?.etudiantId ?? null;
  if (etudiantId) {
    void router.push({ path: '/inscriptions', query: { etudiant: etudiantId } });
    return;
  }
  const numero = p.inscription?.numero;
  if (!numero) return;
  void router.push({ path: '/inscriptions', query: { recherche: numero } });
}

/** Retour à la fiche de l'étudiant payeur. */
function voirEtudiant(p: Paiement) {
  if (!p.etudiant) return;
  void router.push({ path: '/etudiants', query: { recherche: p.etudiant.matricule } });
}

function ouvrirModule(p: Paiement) {
  const chemin = routeModule(p, modulesOuverts.value);
  if (chemin) void router.push(chemin);
}

async function simuler(p: Paiement, statut: 'REUSSI' | 'ECHOUE') {
  const ok = await confirmer({
    titre: statut === 'REUSSI' ? t('paiements.confirmDialog.title') : t('paiements.confirmDialog.titleFailed'),
    message: t('paiements.confirmDialog.message', {
      reference: p.reference,
      amount: `${montantLisible(p.montant)} ${p.devise}`,
      outcome:
        statut === 'REUSSI' ? t('paiements.confirmDialog.outcomeSuccess') : t('paiements.confirmDialog.outcomeFailed'),
    }),
    ok: t('common.actions.confirm'),
    danger: statut === 'ECHOUE',
  });
  if (!ok) return;
  await paiementsService.simuler(p.id, statut);
  $q.notify({
    type: 'positive',
    message: statut === 'REUSSI' ? t('paiements.messages.confirmed') : t('paiements.messages.markedFailed'),
  });
  await liste.recharger();
}

function ouvrirAnnulation(p: Paiement) {
  paiementAnnuler.value = p;
  dialogAnnulation.value = true;
}

async function confirmerAnnulation(motif: string) {
  annulationEnCours.value = true;
  try {
    await paiementsService.annuler(paiementAnnuler.value!.id, motif);
    $q.notify({ type: 'warning', message: t('paiements.messages.cancelled') });
    dialogAnnulation.value = false;
    await liste.recharger();
  } finally {
    annulationEnCours.value = false;
  }
}

function reinitialiser() {
  dossierCible.value = null;
  etudiantCible.value = null;
  // Pas `liste.reinitialiser()` : l'état initial porte la cible de l'URL.
  filtres.value = {
    recherche: '',
    statut: null,
    mode: null,
    operateur: null,
    motif: '',
    inscriptionId: null,
    etudiantId: null,
    dateDebut: null,
    dateFin: null,
  };
  void router.replace({ path: '/paiements' });
}

/** Lève le ciblage venu de l'URL sans toucher aux autres filtres. */
async function retirerCible() {
  dossierCible.value = null;
  etudiantCible.value = null;
  // Une seule affectation : une seule requête.
  filtres.value = { ...filtres.value, inscriptionId: null, etudiantId: null };
  await router.replace({ path: '/paiements' });
}

/** `/paiements?inscription=<id>` — encaissements d'un dossier précis. */
async function appliquerDossierCible(id: string) {
  try {
    const reponse = await paiementsService.inscriptions();
    dossierCible.value = elements(reponse).find((i) => i.id === id) ?? null;
  } catch {
    dossierCible.value = null;
  }
}

/** `/paiements?etudiant=<id>` — tous les encaissements d'un étudiant. */
async function appliquerEtudiantCible(id: string) {
  try {
    etudiantCible.value = await paiementsService.etudiant(id);
  } catch {
    etudiantCible.value = null;
  }
}

// Le filtre est déjà posé ; on ne charge ici que le libellé du bandeau.
onMounted(() => {
  if (filtres.value.inscriptionId) void appliquerDossierCible(filtres.value.inscriptionId);
  else if (filtres.value.etudiantId) void appliquerEtudiantCible(filtres.value.etudiantId);
});
</script>

<style scoped lang="scss">
.paiements-kpi {
  background: var(--up-plaque);
  border: var(--up-filet);
}
.paiements-kpi__valeur {
  font-size: 1.4rem;
  margin-top: 2px;
}
</style>
