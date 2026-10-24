<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('common.fields.enrollments')" :subtitle="$t('inscriptions.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('inscriptions.actions.new')"
          @click="dialogInscription = true"
        />
      </template>
    </en-tete-page>

    <!-- Arrivée depuis la fiche d'un étudiant : le ciblage est annoncé et se lève. -->
    <q-banner v-if="etudiantCible && filtres.etudiant" dense class="note--info q-mb-md">
      <template #avatar><q-icon name="person_search" /></template>
      {{ $t('inscriptions.banner.dossiersOf') }} <strong>{{ etudiantCible.prenom }} {{ etudiantCible.nom }}</strong>
      {{ $t('inscriptions.banner.allYears', { matricule: etudiantCible.matricule }) }}
      <template #action>
        <q-btn flat dense no-caps :label="$t('inscriptions.banner.viewAll')" @click="retirerEtudiantCible" />
      </template>
    </q-banner>

    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('inscriptions.filters.searchPlaceholder')"
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
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.academicYear')"
          @update:model-value="filtres.promotionId = null"
        />
        <q-select
          v-model="filtres.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('inscriptions.filters.promotion')"
        />

        <champ-date v-model="filtres.dateDebut" :label="$t('inscriptions.filters.enrolledFrom')" />
        <champ-date v-model="filtres.dateFin" :label="$t('inscriptions.filters.enrolledUntil')" />
      </template>
    </barre-filtres>

    <inscriptions-liste-panel
      :mode="modeVue"
      :rows="liste.lignes"
      :chargement="liste.chargement"
      :message-vide="messageVide"
      :filtres-actifs="filtresActifs"
      :peut-gerer="peutGerer"
      :peut-encaisser="peutEncaisser"
      :droit-valider="droitValider"
      :droit-annuler="droitAnnuler"
      @encaisser="encaisser"
      @valider="valider"
      @annuler="annuler"
      @imprimer="imprimer"
      @voir-paiements="voirPaiements"
      @voir-etudiant="voirEtudiant"
      @reinitialiser="reinitialiser"
      @creer="dialogInscription = true"
    />

    <barre-pagination
      v-if="liste.lignes.length"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-inscription v-model="dialogInscription" @enregistre="liste.recharger()" />
    <dialogue-paiement
      v-model="dialogPaiement"
      :inscription-id="paiementInscriptionId"
      :montant-initial="paiementMontantInitial"
      @paye="liste.recharger()"
    />
    <dialogue-etudiant v-model="dialogFicheEtudiant" :etudiant="etudiantEdite" @enregistre="liste.recharger()" />

    <!-- Dialog : aperçu de l'étudiant -->
    <inscriptions-apercu-etudiant
      v-model="dialogEtudiant"
      :etudiant="etudiantApercu"
      :chargement="chargementEtudiant"
      :peut-gerer="peutGerer"
      @ouvrir-registre="ouvrirRegistreEtudiant"
      @voir-paiements="voirPaiementsEtudiant"
      @modifier="ouvrirModificationEtudiant"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import DialogueInscription from '../components/DialogueInscription.vue';
import DialoguePaiement from '@/shared/components/DialoguePaiement.vue';
import DialogueEtudiant from '../components/DialogueEtudiant.vue';
import InscriptionsListePanel from '../components/InscriptionsListePanel.vue';
import InscriptionsApercuEtudiant from '../components/InscriptionsApercuEtudiant.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import { texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { ouvrirImpression } from '@/shared/services/impression';
import { LIBELLE_STATUT_INSCRIPTION, dateLisible } from '@/shared/utils/libelles';
import { inscriptionsService } from '../services/inscriptions';
import { etudiantsService } from '../services/etudiants';
import type {
  AnneeAcademique,
  Etudiant,
  Inscription,
  Promotion,
  StatutInscription,
  ChipFiltre,
  FiltresPage,
} from '@/types';

const $q = useQuasar();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const { confirmer } = useConfirmation();

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const modeVue = usePresentationListe();

/**
 * Filtres transmis à `GET /inscriptions` : tous sont appliqués par le serveur,
 * donc à l'ensemble des dossiers et au total paginé. Les dates portent sur la
 * date d'inscription, à défaut la date de création du dossier. `etudiant`
 * (`/inscriptions?etudiant=<id>`) restreint aux dossiers d'un étudiant.
 */
const filtres = ref<FiltresPage>({
  recherche: '',
  statut: null,
  anneeId: null,
  promotionId: null,
  dateDebut: null,
  dateFin: null,
  etudiant: null,
});
const liste = reactive(
  useListePaginee<Inscription>({
    filtres,
    syncUrl: true,
    // Premier chargement une fois les filtres d'ouverture posés (onMounted).
    immediat: false,
    charger: ({ page, pageSize, filtres: f }) =>
      inscriptionsService.liste({
        page,
        pageSize,
        search: texteApi(f.recherche),
        anneeId: f.anneeId || undefined,
        promotionId: f.promotionId || undefined,
        statut: f.statut || undefined,
        dateDebut: f.dateDebut || undefined,
        dateFin: f.dateFin || undefined,
        etudiantId: f.etudiant || undefined,
      }),
  }),
);
/** Fiche de l'étudiant ciblé, pour annoncer son nom. */
const etudiantCible = ref<Etudiant | null>(null);

const dialogInscription = ref(false);
const dialogPaiement = ref(false);
const paiementInscriptionId = ref<string | undefined>(undefined);
const paiementMontantInitial = ref<number | undefined>(undefined);

const dialogEtudiant = ref(false);
const etudiantApercu = ref<Etudiant | null>(null);
const chargementEtudiant = ref(false);
const etudiantEdite = ref<Etudiant | null>(null);
const dialogFicheEtudiant = ref(false);

const peutGerer = computed(() => auth.peut('inscriptions.gerer'));
/** Encaisser, c'est créer un paiement : mêmes rôles que `POST /paiements`. */
const peutEncaisser = computed(() => auth.peut('paiements.creer'));
const droitValider = computed(() => auth.peut('inscriptions.valider'));
const droitAnnuler = computed(() => auth.peut('inscriptions.annuler'));

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_INSCRIPTION).map(([value, label]) => ({ value, label })),
);

/** Au moins un critère est posé : l'état vide se répare en réinitialisant. */
const filtresActifs = computed(() =>
  Object.entries(filtres.value).some(([, v]) => v !== null && v !== undefined && v !== ''),
);

const messageVide = computed(() => {
  if (etudiantCible.value && filtres.value.etudiant) {
    return t('inscriptions.emptyState.noRecordsForStudent', {
      name: `${etudiantCible.value.prenom} ${etudiantCible.value.nom}`,
    });
  }
  return filtresActifs.value ? t('inscriptions.emptyState.noMatch') : t('inscriptions.emptyState.none');
});

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('inscriptions.chips.search', { value: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({
      label: t('inscriptions.chips.year', { value: a?.libelle ?? '?' }),
      value: filtres.value.anneeId,
      icone: 'calendar_today',
    });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({
      label: t('inscriptions.chips.promotion', { value: p?.nom ?? '?' }),
      value: filtres.value.promotionId,
      icone: 'school',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('inscriptions.chips.status', {
        value: LIBELLE_STATUT_INSCRIPTION[filtres.value.statut as StatutInscription] ?? filtres.value.statut,
      }),
      value: filtres.value.statut,
      icone: 'flag',
    });
  }
  if (filtres.value.dateDebut) {
    cs.push({
      label: t('inscriptions.chips.since', { value: dateLisible(filtres.value.dateDebut) }),
      value: filtres.value.dateDebut,
      icone: 'event',
    });
  }
  if (filtres.value.dateFin) {
    cs.push({
      label: t('inscriptions.chips.until', { value: dateLisible(filtres.value.dateFin) }),
      value: filtres.value.dateFin,
      icone: 'event',
    });
  }
  return cs;
});

/** Encaissement : le dialogue s'ouvre sur le dossier, au montant restant dû. */
function encaisser(row: Inscription, reste: number) {
  paiementInscriptionId.value = row.id;
  paiementMontantInitial.value = reste;
  dialogPaiement.value = true;
}

/** Écran Paiements préfiltré sur le dossier. */
function voirPaiements(dossier: Inscription) {
  void router.push({ path: '/paiements', query: { inscription: dossier.id } });
}

async function valider(dossier: Inscription) {
  const ok = await confirmer({
    titre: t('inscriptions.dialogs.validate.title'),
    message: t('inscriptions.dialogs.validate.message', {
      numero: dossier.numero,
      prenom: dossier.etudiant?.prenom,
      nom: dossier.etudiant?.nom,
    }),
    ok: t('common.actions.validate'),
    couleur: 'positive',
  });
  if (!ok) return;
  try {
    await inscriptionsService.valider(dossier.id);
  } catch {
    return;
  }
  $q.notify({ type: 'positive', message: t('inscriptions.messages.validated') });
  await liste.recharger();
}

async function annuler(dossier: Inscription) {
  const ok = await confirmer({
    titre: t('inscriptions.dialogs.cancel.title'),
    message: t('inscriptions.dialogs.cancel.message', { numero: dossier.numero }),
    ok: t('inscriptions.dialogs.cancel.confirm'),
    danger: true,
  });
  if (!ok) return;
  try {
    await inscriptionsService.annuler(dossier.id);
  } catch {
    return;
  }
  $q.notify({ type: 'warning', message: t('inscriptions.messages.cancelled') });
  await liste.recharger();
}

function imprimer(dossier: Inscription) {
  void ouvrirImpression(`/inscriptions/${dossier.id}/attestation-inscription`);
}

async function voirEtudiant(dossier: Inscription) {
  dialogEtudiant.value = true;
  chargementEtudiant.value = true;
  etudiantApercu.value = null;
  try {
    etudiantApercu.value = await etudiantsService.lire(dossier.etudiantId);
  } catch {
    etudiantApercu.value = null;
  } finally {
    chargementEtudiant.value = false;
  }
}

/** Registre des étudiants, recherche posée sur le matricule du dossier. */
function ouvrirRegistreEtudiant() {
  const e = etudiantApercu.value;
  if (!e) return;
  dialogEtudiant.value = false;
  void router.push({ path: '/etudiants', query: { recherche: e.matricule } });
}

/** Paiements de l'étudiant, tous dossiers confondus. */
function voirPaiementsEtudiant() {
  const e = etudiantApercu.value;
  if (!e) return;
  dialogEtudiant.value = false;
  void router.push({ path: '/paiements', query: { etudiant: e.id } });
}

function ouvrirModificationEtudiant() {
  if (!etudiantApercu.value) return;
  etudiantEdite.value = etudiantApercu.value;
  dialogEtudiant.value = false;
  dialogFicheEtudiant.value = true;
}

/** Tout tombe, recherche comprise ; un ciblage levé ramène à l'année en cours. */
function reinitialiser() {
  const ciblait = !!filtres.value.etudiant;
  liste.reinitialiser([]);
  etudiantCible.value = null;
  if (ciblait) filtres.value.anneeId = referentiels.anneeCourante?.id ?? null;
}

/** Lève le ciblage venu de l'URL : retour aux dossiers de l'année en cours. */
function retirerEtudiantCible() {
  etudiantCible.value = null;
  filtres.value = {
    ...filtres.value,
    etudiant: null,
    recherche: '',
    anneeId: referentiels.anneeCourante?.id ?? null,
  };
}

/**
 * `/inscriptions?etudiant=<id>` : on lit la fiche pour afficher son nom et
 * poser la recherche sur son matricule ; le filtre exact passe par
 * `etudiantId`.
 */
async function appliquerEtudiantCible(id: string) {
  try {
    const fiche = await etudiantsService.lire(id);
    etudiantCible.value = fiche;
    filtres.value.recherche = fiche.matricule;
    // Le dossier cherché peut relever d'une autre année que l'année active.
    filtres.value.anneeId = null;
  } catch {
    etudiantCible.value = null;
    filtres.value.etudiant = null;
    $q.notify({ type: 'warning', message: t('inscriptions.messages.studentNotFound') });
  }
}

onMounted(async () => {
  try {
    [annees.value, promotions.value] = await Promise.all([referentiels.annees(), referentiels.promotions()]);
  } catch {
    annees.value = [];
    promotions.value = [];
  }

  const avant = JSON.stringify(filtres.value);
  if (filtres.value.etudiant) {
    await appliquerEtudiantCible(filtres.value.etudiant);
  } else if (!Object.keys(filtres.value).some((k) => route.query[k])) {
    // Arrivée sans filtre : l'année en cours. Une recherche reçue (n° de dossier
    // depuis un paiement) ou des filtres relus de l'URL valent toutes années.
    filtres.value.anneeId = referentiels.anneeCourante?.id ?? null;
  }

  // Un filtre posé ci-dessus relance déjà la liste par l'observateur.
  if (JSON.stringify(filtres.value) === avant) await liste.recharger();
});
</script>
