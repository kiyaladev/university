<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('examens.title')" :subtitle="$t('examens.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('examens.actions.schedule')"
          @click="dialogOuvert = true"
        />
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="qr_code_scanner"
          :label="$t('examens.actions.scanStation')"
          @click="allerScan(null)"
        />
        <q-btn
          v-if="peutVoirTirage"
          outline
          color="secondary"
          no-caps
          icon="local_printshop"
          :label="$t('examens.actions.draw')"
          @click="allerTirage(null)"
        />
      </template>
    </en-tete-page>

    <barre-filtres
      v-model="filtres"
      :placeholder="$t('examens.filters.searchPlaceholder')"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="optionsTypes"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('examens.filters.type')"
        />
        <champ-recherche
          v-model="filtres.matiereId"
          endpoint="/matieres"
          :label="$t('common.fields.subject')"
          :label-fn="(m) => `${m.code} — ${m.intitule}`"
        />
        <champ-recherche
          v-model="filtres.promotionId"
          endpoint="/promotions"
          :label="$t('examens.filters.promotion')"
          :label-fn="(p) => `${p.nom} — ${p.niveau}`"
        />
        <champ-recherche
          v-model="filtres.anneeId"
          endpoint="/annees"
          :label="$t('common.fields.academicYear')"
          :label-fn="(a) => a.libelle"
        />
        <champ-date v-model="filtres.dateDebut" :label="$t('examens.filters.dateFrom')" />
        <champ-date v-model="filtres.dateFin" :label="$t('examens.filters.dateTo')" />
      </template>
    </barre-filtres>

    <q-tabs v-model="onglet" dense no-caps align="left" class="onglets-panneau q-mb-md">
      <q-tab name="PLANIFIE" :label="LIBELLE_STATUT_EXAMEN.PLANIFIE" icon="event" />
      <q-tab name="EN_COURS" :label="LIBELLE_STATUT_EXAMEN.EN_COURS" icon="play_circle_outline" />
      <q-tab name="TERMINE" :label="LIBELLE_STATUT_EXAMEN.TERMINE" icon="task_alt" />
      <q-tab name="ANNULE" :label="LIBELLE_STATUT_EXAMEN.ANNULE" icon="block" />
    </q-tabs>

    <examens-tableau
      v-if="modeVue === 'tableau'"
      :rows="examensFiltres"
      :colonnes="colonnes"
      :chargement="ex.chargement"
      :message-vide="messageVide"
      :peut-creer="peutCreer"
      :sur-onglet-planifie="onglet === 'PLANIFIE'"
      :peut-demarrer="peutDemarrer"
      :peut-terminer="peutTerminer"
      :peut-annuler="peutAnnuler"
      :peut-voir-tirage="peutVoirTirage"
      @ouvrir-fiche="ouvrirFiche"
      @demarrer="demarrer"
      @terminer="terminer"
      @annuler="annulerExamen"
      @scan="allerScan"
      @tirage="allerTirage"
      @planifier="dialogOuvert = true"
    />

    <examens-cartes
      v-else
      :rows="examensFiltres"
      :message-vide="messageVide"
      :peut-creer="peutCreer"
      :sur-onglet-planifie="onglet === 'PLANIFIE'"
      :peut-demarrer="peutDemarrer"
      :peut-terminer="peutTerminer"
      :peut-annuler="peutAnnuler"
      :peut-voir-tirage="peutVoirTirage"
      @ouvrir-fiche="ouvrirFiche"
      @demarrer="demarrer"
      @terminer="terminer"
      @annuler="annulerExamen"
      @scan="allerScan"
      @tirage="allerTirage"
      @planifier="dialogOuvert = true"
    />

    <barre-pagination
      v-if="ex.total"
      v-model:page="ex.page"
      v-model:page-size="ex.pageSize"
      :total="ex.total"
      @tous="ex.toutAfficher()"
    />

    <dialogue-examen v-model="dialogOuvert" @enregistre="ex.recharger()" />

    <!-- Fiche de l'examen : les trois maillons de la chaîne au même endroit -->
    <examens-fiche-dialog
      v-model="dialogFiche"
      :examen="examenFiche"
      :peut-voir-tirage="peutVoirTirage"
      @tirage="allerTirage"
      @scan="allerScan"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { useAuthStore } from '@/stores/auth';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { pageApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import DialogueExamen from '../components/DialogueExamen.vue';
import ExamensTableau from '../components/ExamensTableau.vue';
import ExamensCartes from '../components/ExamensCartes.vue';
import ExamensFicheDialog from '../components/ExamensFicheDialog.vue';
import { examensService } from '../services/examens';
import { LIBELLE_STATUT_EXAMEN, LIBELLE_TYPE_EXAMEN, aujourdhui, decalerJours } from '@/shared/utils/libelles';
import type { Examen, StatutExamen, ChipFiltre } from '@/types';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const { confirmer } = useConfirmation();

const modeVue = usePresentationListe();
const dialogOuvert = ref(false);

const dialogFiche = ref(false);
const examenFiche = ref<Examen | null>(null);

/** Le statut est porté par les onglets ; la réinitialisation des filtres le garde. */
const onglet = ref<StatutExamen>('PLANIFIE');

/** Les épreuves planifiées sont devant nous : la fenêtre par défaut regarde en avant. */
function filtresParDefaut() {
  return {
    recherche: '',
    type: null as string | null,
    matiereId: null as string | null,
    promotionId: null as string | null,
    anneeId: null as string | null,
    dateDebut: decalerJours(aujourdhui(), -30),
    dateFin: decalerJours(aujourdhui(), 90),
  };
}

const filtres = ref<Record<string, any>>(filtresParDefaut());

/** La recherche texte n'est pas gérée par `/examens` : elle reste locale. */
const ex = reactive(
  useListePaginee<Examen>({
    filtres,
    syncUrl: true,
    clesLocales: ['recherche'],
    charger: ({ filtres: f, ...p }) =>
      examensService.liste({
        ...pageApi(p),
        statut: onglet.value,
        type: f.type || undefined,
        matiereId: f.matiereId || undefined,
        promotionId: f.promotionId || undefined,
        anneeId: f.anneeId || undefined,
        dateDebut: f.dateDebut || undefined,
        dateFin: f.dateFin || undefined,
      }),
  }),
);

const peutCreer = computed(() => auth.peut('examens.creer'));
const peutDemarrer = computed(() => auth.peut('examens.demarrer'));
const peutTerminer = computed(() => auth.peut('examens.terminer'));
const peutAnnuler = computed(() => auth.peut('examens.annuler'));
/** La route `tirage` est réservée à l'administration et à la scolarité. */
const peutVoirTirage = computed(() => auth.peut('tirage.gerer'));

const optionsTypes = (['PARTIEL', 'FINAL', 'RATTRAPAGE', 'CONTROLE_CONTINU'] as const).map((value) => ({
  value,
  label: LIBELLE_TYPE_EXAMEN[value],
}));

const chipsFiltres = computed(() => {
  const chips: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    chips.push({
      label: t('examens.filters.searchChip', { query: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.type) {
    chips.push({
      label: t('examens.filters.typeChip', { type: LIBELLE_TYPE_EXAMEN[filtres.value.type] ?? filtres.value.type }),
      value: filtres.value.type,
      icone: 'category',
    });
  }
  return chips;
});

/**
 * Le statut est filtré côté serveur (onglets) ; la recherche texte, elle,
 * n'est pas gérée par `/examens` : on l'applique sur les lignes chargées pour
 * que le champ ne reste pas décoratif.
 */
const examensFiltres = computed(() => {
  const q = String(filtres.value.recherche ?? '')
    .toLowerCase()
    .trim();
  if (!q) return ex.lignes;
  return ex.lignes.filter((e) =>
    [e.codeExamen, e.intitule, e.matiere?.intitule, e.promotion?.nom]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
});

const messageVide = computed(() =>
  filtres.value.recherche
    ? t('examens.emptyState.noResults')
    : t('examens.emptyState.noneForStatus', { status: libelleStatut(onglet.value).toLowerCase() }),
);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'codeExamen', label: t('common.fields.code'), field: 'codeExamen', align: 'left', sortable: true },
  { name: 'intitule', label: t('common.fields.intitule'), field: 'intitule', align: 'left' },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'creneau', label: t('examens.table.columns.slot'), field: 'dateExamen', align: 'left', sortable: true },
  {
    name: 'matiere',
    label: t('common.fields.subject'),
    field: (r: Examen) => r.matiere?.intitule ?? '—',
    align: 'left',
  },
  {
    name: 'promotion',
    label: t('examens.table.columns.promotion'),
    field: (r: Examen) => r.promotion?.nom ?? '—',
    align: 'left',
  },
  { name: 'salle', label: t('common.fields.room'), field: (r: Examen) => r.salle?.code ?? '—', align: 'left' },
  { name: 'presence', label: t('examens.table.columns.present'), field: 'nbPresents', align: 'right' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function libelleStatut(s: string) {
  return LIBELLE_STATUT_EXAMEN[s] ?? s;
}

function reinitialiser() {
  filtres.value = filtresParDefaut();
}

// Changer d'onglet ramène en page 1 (le setter recharge).
watch(onglet, () => {
  ex.page = 1;
});

/** Fiche : infos de l'examen + journal des scans, avec les liens de la chaîne. */
function ouvrirFiche(e: Examen) {
  examenFiche.value = e;
  dialogFiche.value = true;
}

/** Examen → tirage : la page Tirage se filtre d'elle-même sur cet examen. */
function allerTirage(e: Examen | null) {
  void router.push({ name: 'tirage', query: e ? { examenId: e.id } : {} });
}

/** Examen → scan : le poste de scan présélectionne l'examen. */
function allerScan(e: Examen | null) {
  void router.push({ name: 'scan-examen', query: e ? { examenId: e.id } : {} });
}

/** Passe l'examen à l'étape suivante, puis montre l'onglet où il se trouve désormais. */
async function changerStatut(
  e: Examen,
  action: 'demarrer' | 'terminer' | 'annuler',
  cible: StatutExamen,
  message: string,
) {
  try {
    // L'annulation passe par `PUT /examens/:id/statut` (PLANIFIE → ANNULE seulement).
    if (action === 'annuler') await examensService.changerStatut(e.id, 'ANNULE');
    else await examensService.action(e.id, action);
  } catch {
    return; /* notifié par l'intercepteur */
  }
  $q.notify({ type: 'positive', message });
  // Le changement d'onglet déclenche lui-même le rechargement.
  if (onglet.value === cible) await ex.recharger();
  else onglet.value = cible;
}

async function demarrer(e: Examen) {
  const ok = await confirmer({
    titre: t('examens.confirm.startTitle'),
    message: t('examens.confirm.startMessage', { code: e.codeExamen, title: e.intitule }),
    ok: t('common.actions.start'),
    couleur: 'positive',
  });
  if (ok) await changerStatut(e, 'demarrer', 'EN_COURS', t('examens.messages.started'));
}

async function terminer(e: Examen) {
  const ok = await confirmer({
    titre: t('examens.confirm.finishTitle'),
    message: t('examens.confirm.finishMessage', { code: e.codeExamen, title: e.intitule }),
    ok: t('examens.confirm.finishAction'),
    danger: true,
  });
  if (ok) await changerStatut(e, 'terminer', 'TERMINE', t('examens.messages.finished'));
}

/** Le backend n'accepte pas de motif : simple confirmation. */
async function annulerExamen(e: Examen) {
  const ok = await confirmer({
    titre: t('examens.confirm.cancelTitle'),
    message: t('examens.confirm.cancelMessage', { code: e.codeExamen, title: e.intitule }),
    ok: t('examens.confirm.cancelAction'),
    danger: true,
  });
  if (ok) await changerStatut(e, 'annuler', 'ANNULE', t('examens.messages.cancelled'));
}
</script>
