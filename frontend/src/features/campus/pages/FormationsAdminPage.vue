<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('formationsAdmin.title')" :subtitle="$t('formationsAdmin.subtitle')">
      <template #actions>
        <q-btn flat no-caps icon="public" :label="$t('formationsAdmin.actions.seeShowcase')" to="/formations">
          <q-tooltip>{{ $t('formationsAdmin.actions.seeShowcaseTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('formationsAdmin.actions.newFormation')"
          @click="ouvrirNouvelle"
        />
      </template>
    </en-tete-page>

    <!-- La recherche du serveur balaie titre, catégorie et lieu : un seul champ
         suffit, le filtre avancé ne porte que le statut réellement supporté. -->
    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('formationsAdmin.filters.searchPlaceholder')"
      @reinitialiser="liste.reinitialiser()"
    >
      <template #avances>
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('common.fields.status')"
        />
      </template>
    </barre-filtres>

    <!-- Statistiques -->
    <formation-tableau-de-bord :dashboard="dashboard" :formations="liste.lignes" />

    <formation-tableau
      v-if="mode === 'tableau'"
      :formations="liste.lignes"
      :colonnes="colonnes"
      :chargement="liste.chargement"
      :dashboard="dashboard"
      :registres="registres"
      :registre-charge="registreCharge"
      :colonnes-registre="colonnesRegistre"
      @nouvelle="ouvrirNouvelle"
      @publier="publier"
      @cloturer="cloturer"
      @modifier="ouvrirModification"
      @supprimer="supprimer"
      @charger-registre="chargerRegistre"
      @recharger-registre="(f) => chargerRegistre(f, true)"
      @confirmer="confirmer"
      @annuler="annuler"
      @imprimer="imprimerCertificat"
    />

    <!-- Vue cartes -->
    <formation-cartes
      v-else
      :formations="liste.lignes"
      :chargement="liste.chargement"
      :registres="registres"
      :registre-charge="registreCharge"
      :registre-ouvert="registreOuvert"
      :colonnes-registre="colonnesRegistre"
      @nouvelle="ouvrirNouvelle"
      @publier="publier"
      @cloturer="cloturer"
      @modifier="ouvrirModification"
      @supprimer="supprimer"
      @basculer-registre-carte="basculerRegistreCarte"
      @recharger-registre="(f) => chargerRegistre(f, true)"
      @confirmer="confirmer"
      @annuler="annuler"
      @imprimer="imprimerCertificat"
    />

    <barre-pagination
      v-if="liste.lignes.length"
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-formation v-model="dialogFormation" :formation="formationEnCours" @enregistre="liste.recharger()" />
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation, type OptionsConfirmation } from '@/shared/composables/useConfirmation';
import { formationsService, type FormationDashboard } from '@/shared/services/formations';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import DialogueFormation from '../components/DialogueFormation.vue';
import FormationTableauDeBord from '../components/FormationTableauDeBord.vue';
import FormationTableau from '../components/FormationTableau.vue';
import FormationCartes from '../components/FormationCartes.vue';
import { LIBELLE_STATUT_FORMATION } from '@/shared/utils/libelles';
import type { Formation, StatutFormation, ChipFiltre } from '@/types';
import type { InscriptionFormationDetail } from '../types';
import { ouvrirImpression } from '@/shared/services/impression';

const $q = useQuasar();
const { t } = useI18n();
const { confirmer: demander, supprimerAvecConfirmation } = useConfirmation();

const dashboard = ref<FormationDashboard | null>(null);

const filtres = ref<Record<string, any>>({ recherche: '', statut: null });
// Le backend n'accepte que `search` (titre, catégorie, lieu) et `statut` :
// tout autre paramètre serait silencieusement ignoré.
const liste = reactive(
  useListePaginee<Formation>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      formationsService
        .liste({ ...pageApi(p), search: texteApi(f.recherche), statut: f.statut || undefined })
        .then((r) => r.data),
  }),
);
const mode = usePresentationListe();

const optionsStatuts = Object.entries(LIBELLE_STATUT_FORMATION).map(([value, label]) => ({
  value: value as StatutFormation,
  label,
}));

/** Chips des filtres actifs : sans elles, BarreFiltres masque « Réinitialiser ». */
const chips = computed(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = [];
  if (f.recherche) {
    cs.push({
      label: t('formationsAdmin.filters.searchChip', { query: f.recherche }),
      value: f.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (f.statut) {
    cs.push({
      label: LIBELLE_STATUT_FORMATION[f.statut] ?? f.statut,
      value: f.statut,
      icone: 'flag',
      cle: 'statut',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'titre', label: t('formationsAdmin.table.columns.formation'), field: 'titre', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'center' },
  { name: 'prix', label: t('formationsAdmin.table.columns.price'), field: 'prix', align: 'right' },
  { name: 'duree', label: t('common.fields.duration'), field: 'dureeHeures', align: 'center' },
  { name: 'capacite', label: t('common.fields.capacity'), field: 'capacite', align: 'center' },
  { name: 'inscrits', label: t('formationsAdmin.table.columns.registered'), field: 'inscrits', align: 'center' },
  { name: 'recette', label: t('formationsAdmin.table.columns.revenue'), field: 'recette', align: 'right' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesRegistre = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('formationsAdmin.registry.columns.fileNumber'), field: 'numero', align: 'left' },
  { name: 'inscrit', label: t('formationsAdmin.registry.columns.registrant'), field: 'inscrit', align: 'left' },
  { name: 'statut', label: t('formationsAdmin.registry.columns.request'), field: 'statut', align: 'center' },
  { name: 'paiement', label: t('common.fields.amount'), field: 'paiement', align: 'right' },
  { name: 'paiementStatut', label: t('common.fields.payment'), field: 'paiementStatut', align: 'center' },
  { name: 'actionsRegistre', label: '', field: 'id', align: 'right' },
]);

const registres = ref<Record<string, InscriptionFormationDetail[]>>({});
const registreCharge = ref<Record<string, boolean>>({});
const registreOuvert = reactive<Record<string, boolean>>({});

function basculerRegistreCarte(f: Formation) {
  registreOuvert[f.id] = !registreOuvert[f.id];
  if (registreOuvert[f.id]) void chargerRegistre(f);
}

async function chargerRegistre(f: Formation, force = false) {
  if (!registres.value[f.id] || force) {
    registreCharge.value[f.id] = true;
    try {
      const { data } = await formationsService.inscriptions(f.id);
      registres.value[f.id] = Array.isArray(data) ? data : [];
    } catch {
      registres.value[f.id] = [];
    } finally {
      registreCharge.value[f.id] = false;
    }
  }
}

const dialogFormation = ref(false);
const formationEnCours = ref<Formation | null>(null);

function ouvrirNouvelle() {
  formationEnCours.value = null;
  dialogFormation.value = true;
}

function ouvrirModification(f: Formation) {
  formationEnCours.value = f;
  dialogFormation.value = true;
}

/** Une action sur une formation ou une demande change les chiffres et la liste. */
const rechargerTout = () => Promise.all([chargerDashboard(), liste.recharger()]);

/** Demande confirmation, lance l'action, notifie, puis recharge. */
async function confirmerPuis(
  o: OptionsConfirmation,
  action: () => Promise<unknown>,
  notification: { type: string; message: string },
) {
  if (!(await demander(o))) return;
  try {
    await action();
  } catch {
    return; // l'intercepteur axios affiche le motif
  }
  $q.notify(notification);
  await rechargerTout();
}

function publier(f: Formation) {
  void confirmerPuis(
    {
      titre: t('formationsAdmin.dialogs.publish.title'),
      message: t('formationsAdmin.dialogs.publish.message', { title: f.titre }),
      ok: t('common.actions.publish'),
    },
    () => formationsService.publier(f.id),
    { type: 'positive', message: t('formationsAdmin.messages.published') },
  );
}

function cloturer(f: Formation) {
  void confirmerPuis(
    {
      titre: t('formationsAdmin.dialogs.close.title'),
      message: t('formationsAdmin.dialogs.close.message', { title: f.titre }),
      ok: t('common.actions.closeOut'),
    },
    () => formationsService.cloturer(f.id),
    { type: 'warning', message: t('formationsAdmin.messages.closed') },
  );
}

function supprimer(f: Formation) {
  void supprimerAvecConfirmation(`/formations/${f.id}`, f.titre, rechargerTout, {
    titre: t('formationsAdmin.dialogs.delete.title'),
    message: t('formationsAdmin.dialogs.delete.message', { title: f.titre }),
    ok: t('common.actions.delete'),
    succes: t('formationsAdmin.messages.draftDeleted'),
  });
}

function confirmer(i: InscriptionFormationDetail) {
  void confirmerPuis(
    {
      titre: t('formationsAdmin.dialogs.confirmPayment.title'),
      message: t('formationsAdmin.dialogs.confirmPayment.message', {
        reference: i.paiement?.reference ?? t('formationsAdmin.dialogs.confirmPayment.paymentFallback'),
        numero: i.numero,
      }),
      ok: t('common.actions.confirm'),
    },
    () => formationsService.confirmerInscription(i.id),
    { type: 'positive', message: t('formationsAdmin.messages.registrationConfirmed', { numero: i.numero }) },
  );
}

function annuler(i: InscriptionFormationDetail) {
  void confirmerPuis(
    {
      titre: t('formationsAdmin.dialogs.cancelRequest.title'),
      message: t('formationsAdmin.dialogs.cancelRequest.message', { numero: i.numero }),
      ok: t('formationsAdmin.dialogs.cancelRequest.confirm'),
      danger: true,
    },
    () => formationsService.annulerInscription(i.id),
    { type: 'warning', message: t('formationsAdmin.messages.registrationCancelled', { numero: i.numero }) },
  );
}

function imprimerCertificat(i: InscriptionFormationDetail) {
  void ouvrirImpression(`/formations/${i.id}/certificat`);
}

// Stats — alimentées par /formations/dashboard, plus de N+1.
async function chargerDashboard() {
  try {
    const { data } = await formationsService.dashboard();
    dashboard.value = data;
  } catch {
    dashboard.value = null;
  }
}

onMounted(() => void chargerDashboard());
</script>
