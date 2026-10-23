<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('common.fields.teachers')" :subtitle="$t('enseignants.header.subtitle')">
      <template v-if="auth.peutPlanifier" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('enseignants.header.newTeacher')"
          @click="ouvrir(null)"
        />
      </template>
    </page-header>

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
          :label="$t('common.fields.department')"
        />
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
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="ens.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="ens.chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <etat-vide icone="person" :titre="messageVide">
          <template #action>
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
          </template>
        </etat-vide>
      </template>

      <template #body-cell-nom="p">
        <q-td :props="p">
          <div>{{ p.row.nom }} {{ p.row.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="enseignant" :statut="p.row.statut" />
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
            v-if="auth.peutPlanifier"
            flat
            dense no-caps
            icon="edit"
            :aria-label="$t('enseignants.table.actionsAria.modifier')" :label="$t('enseignants.table.actionsAria.modifier')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
<actions-secondaires>
<q-btn v-close-popup
            flat
            dense no-caps
            icon="assignment_ind"
            :aria-label="$t('enseignants.table.actionsAria.charges')" :label="$t('enseignants.table.actionsAria.charges')"
            @click="voirCharges(p.row)"
          >
            <q-tooltip>{{ $t('enseignants.table.actionsTooltip.charges') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            flat
            dense no-caps
            color="primary"
            icon="verified_user"
            :aria-label="$t('enseignants.table.actionsAria.moyens')" :label="$t('enseignants.table.actionsAria.moyens')"
            @click="ouvrirMoyens(p.row)"
          >
            <q-tooltip>{{ $t('enseignants.table.actionsTooltip.moyens') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            flat
            dense no-caps
            icon="assessment"
            :aria-label="$t('enseignants.table.actionsAria.fiche')" :label="$t('enseignants.table.actionsAria.fiche')"
            @click="imprimerFiche(p.row)"
          >
            <q-tooltip>{{ $t('enseignants.table.actionsTooltip.fiche') }}</q-tooltip>
          </q-btn>
<q-btn v-close-popup
            v-if="auth.estAdmin"
            flat
            dense no-caps
            color="negative"
            icon="delete"
            :aria-label="$t('enseignants.table.actionsAria.supprimer')" :label="$t('enseignants.table.actionsAria.supprimer')"
            @click="supprimer(p.row)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
</actions-secondaires>
</q-td>
      </template>
    </q-table>

    <div v-else class="grille-cartes">
      <q-card v-for="e in ens.lignes" :key="e.id" flat bordered class="carte grille-cartes__carte">
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <PastilleStatut domaine="enseignant" :statut="e.statut" />
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
            v-if="auth.peutPlanifier"
            flat
            dense
            no-caps
            icon="edit"
            :label="$t('common.actions.edit')"
            @click="ouvrir(e)"
          />
<actions-secondaires>
<q-btn v-close-popup
            flat
            dense
            no-caps
            icon="assignment_ind"
            :label="$t('enseignants.cards.charges')"
            @click="voirCharges(e)"
          />
<q-btn v-close-popup
            flat
            dense
            no-caps
            color="primary"
            icon="verified_user"
            :label="$t('enseignants.cards.attestation')"
            @click="ouvrirMoyens(e)"
          />
</actions-secondaires>
</q-card-actions>
      </q-card>
      <etat-vide v-if="!ens.lignes.length && !ens.chargement" icone="person" :titre="messageVide">
        <template #action>
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
        </template>
      </etat-vide>
    </div>

    <pagination-bar
      v-if="ens.lignes.length"
      v-model:page="ens.page"
      v-model:page-size="ens.pageSize"
      :total="ens.total"
      @tous="ens.toutAfficher()"
    />

    <enseignant-dialog
      v-model="dialogOuvert"
      :enseignant="enseignantEdite"
      :departements="departements"
      @enregistre="ens.recharger()"
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
          <q-btn flat no-caps :label="$t('common.actions.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import ActionsSecondaires from '../components/ActionsSecondaires.vue';
import { usePresentationListe } from '../composables/presentationListe';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { isAxiosError } from 'axios';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useReferentielsStore } from '../stores/referentiels';
import EnseignantDialog from '../components/EnseignantDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
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
const referentiels = useReferentielsStore();
const router = useRouter();
const { t } = useI18n();
const { confirmer, supprimerAvecConfirmation } = useConfirmation();
const { ouvrir: ouvrirFicheEnseignant } = useImpressionFicheEnseignant();

const departements = ref<Departement[]>([]);
const modeVue = usePresentationListe();
const dialogOuvert = ref(false);
const enseignantEdite = ref<Enseignant | null>(null);

// Filtres gardés dans l'URL : l'arrivée depuis « Utilisateurs » pré-recherche la fiche visée.
const filtres = ref<Record<string, any>>({ recherche: '', departementId: null, statut: null });
const ens = reactive(
  useListePaginee<Enseignant>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/enseignants', {
          params: {
            ...pageApi(p),
            search: texteApi(f.recherche),
            departementId: f.departementId || undefined,
            statut: f.statut || undefined,
          },
        })
        .then((r) => r.data),
  }),
);

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
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left', sortable: true },
  {
    name: 'departement',
    label: t('common.fields.department'),
    field: (r: Enseignant) => r.departement?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'taux',
    label: t('enseignants.table.columns.taux'),
    field: (r: Enseignant) => (r.tauxHoraire ? montantLisible(r.tauxHoraire) : '—'),
    align: 'right',
  },
  { name: 'telephone', label: t('common.fields.phone'), field: (r: Enseignant) => r.telephone || '—', align: 'left' },
  { name: 'compte', label: t('enseignants.table.columns.compte'), field: 'id', align: 'center' },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
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
  } catch {
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

async function reinitialiserPin() {
  const ok = await confirmer({
    titre: t('enseignants.messages.resetPinTitle'),
    message: t('enseignants.messages.resetPinMessage'),
    ok: t('enseignants.messages.generate'),
  });
  if (!ok) return;
  try {
    const { data } = await api.post(
      `/attestation/enseignants/${enseignantMoyens.value!.id}/code-pin/reinitialiser`,
    );
    codeGenere.value = data.code;
    moyens.value = { ...moyens.value!, codePin: true };
  } catch {
    /* notifié par l'intercepteur */
  }
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
    // L'erreur de l'API est notifiée par l'intercepteur ; reste la passerelle
    // locale du lecteur (fetch, JSON illisible, capture refusée).
    if (!isAxiosError(e)) {
      $q.notify({ type: 'negative', message: e?.message ?? t('enseignants.messages.enrolementFailed') });
    }
  } finally {
    enrolementEnCours.value = false;
  }
}

function imprimerFiche(e: Enseignant) {
  const debut = decalerJours(aujourdhui(), -90);
  ouvrirFicheEnseignant(e.id, debut, aujourdhui());
}

function supprimer(e: Enseignant) {
  void supprimerAvecConfirmation(
    `/enseignants/${e.id}`,
    `${e.nom} ${e.prenom}`,
    () => Promise.all([ens.recharger(), referentiels.rafraichir('enseignants')]),
    {
      titre: t('enseignants.messages.deleteTitle'),
      message: t('enseignants.messages.deleteMessage', { nom: e.nom, prenom: e.prenom }),
      ok: t('common.actions.delete'),
      succes: t('enseignants.messages.deleteSuccess'),
    },
  );
}

function reinitialiser() {
  ens.reinitialiser([]);
}

onMounted(async () => {
  departements.value = await referentiels.departements();
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
