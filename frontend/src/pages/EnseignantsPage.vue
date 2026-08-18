<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Enseignants</div>
        <div class="page-sous-titre">Corps enseignant suivi par le dispositif de contrôle</div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="auth.peutPlanifier"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvel enseignant"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (matricule, nom, e-mail)…"
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
          label="Département"
        />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Statut"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="enseignants"
          :modes="['tableau', 'cartes']"
          defaut="tableau"
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
            label="Créer le premier enseignant"
            @click="ouvrir(null)"
          />
          <q-btn
            v-else-if="filtresActifs"
            flat
            no-caps
            icon="refresh"
            label="Réinitialiser les filtres"
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
          <q-badge v-if="!p.row.actif" color="grey-7" class="q-ml-xs">inactif</q-badge>
        </q-td>
      </template>

      <template #body-cell-compte="p">
        <q-td :props="p" class="text-center">
          <q-icon
            :name="p.row.user ? 'check_circle' : 'remove_circle_outline'"
            :color="p.row.user ? 'positive' : 'grey-5'"
          />
          <q-tooltip>
            {{ p.row.user ? `Compte : ${p.row.user.email}` : 'Aucun compte de connexion' }}
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
            aria-label="Voir les charges d’enseignement"
            @click="voirCharges(p.row)"
          >
            <q-tooltip>Ses charges d’enseignement</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            color="primary"
            icon="verified_user"
            aria-label="Moyens d’attestation de présence"
            @click="ouvrirMoyens(p.row)"
          >
            <q-tooltip>Moyens d’attestation de présence</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="assessment"
            aria-label="Imprimer la fiche d’assiduité"
            @click="imprimerFiche(p.row)"
          >
            <q-tooltip>Fiche d’assiduité (90 derniers jours)</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.peutPlanifier"
            flat
            dense
            round
            icon="edit"
            aria-label="Modifier l’enseignant"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.estAdmin"
            flat
            dense
            round
            color="negative"
            icon="delete"
            aria-label="Supprimer l’enseignant"
            @click="supprimer(p.row)"
          >
            <q-tooltip>Supprimer</q-tooltip>
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
            <q-badge v-if="!e.actif" color="grey-7">inactif</q-badge>
            <q-space />
            <div class="text-caption text-grey-7">{{ e.matricule }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">{{ e.nom }} {{ e.prenom }}</div>
          <div class="text-caption text-grey-7">{{ e.grade || 'Grade non renseigné' }}</div>
          <div class="text-caption text-grey-7">{{ e.departement?.nom ?? 'Sans département' }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            <q-icon name="call" size="14px" /> {{ e.telephone || '—' }}
            <span class="q-ml-sm">
              <q-icon
                :name="e.user ? 'check_circle' : 'remove_circle_outline'"
                :color="e.user ? 'positive' : 'grey-5'"
                size="14px"
              />
              {{ e.user ? 'Compte actif' : 'Sans compte' }}
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
            label="Ses charges"
            @click="voirCharges(e)"
          />
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            icon="verified_user"
            label="Attestation"
            @click="ouvrirMoyens(e)"
          />
          <q-btn
            v-if="auth.peutPlanifier"
            flat
            dense
            no-caps
            icon="edit"
            label="Modifier"
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
          label="Créer le premier enseignant"
          @click="ouvrir(null)"
        />
        <q-btn
          v-else-if="filtresActifs"
          flat
          no-caps
          icon="refresh"
          label="Réinitialiser les filtres"
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
          <div class="text-h6">Moyens d’attestation</div>
          <div class="text-caption text-grey-7">
            {{ enseignantMoyens?.nom }} {{ enseignantMoyens?.prenom }} — comment il confirme
            sa présence en salle
          </div>
        </q-card-section>

        <q-linear-progress v-if="chargementMoyens" indeterminate color="primary" />

        <q-list v-if="!chargementMoyens" separator>
          <q-item>
            <q-item-section avatar><q-icon name="dialpad" color="secondary" /></q-item-section>
            <q-item-section>
              <q-item-label>Code personnel</q-item-label>
              <q-item-label caption>
                {{ moyens?.codePin ? 'Défini' : 'Aucun code défini' }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                no-caps
                :label="moyens?.codePin ? 'Réinitialiser' : 'Générer un code'"
                @click="reinitialiserPin"
              />
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar><q-icon name="fingerprint" color="accent" /></q-item-section>
            <q-item-section>
              <q-item-label>Empreinte digitale</q-item-label>
              <q-item-label caption>
                {{
                  moyens?.empreinte
                    ? `Enrôlée (${moyens.empreinteDoigt})`
                    : passerellePrete
                      ? 'Non enrôlée — lecteur prêt'
                      : 'Non enrôlée — aucun lecteur détecté sur cet appareil'
                }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                no-caps
                :label="moyens?.empreinte ? 'Réenrôler' : 'Enrôler'"
                :disable="!passerellePrete"
                :loading="enrolementEnCours"
                @click="enrolerEmpreinte"
              >
                <q-tooltip v-if="!passerellePrete">
                  Branchez le lecteur d’empreintes sur ce poste pour enrôler.
                </q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>

        <q-banner v-if="codeGenere" class="note--valide q-ma-md">
          <template #avatar><q-icon name="key" /></template>
          Nouveau code : <strong class="text-h6">{{ codeGenere }}</strong><br />
          <span class="text-caption">Communiquez-le à l’enseignant, il ne sera plus affiché.</span>
        </q-banner>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
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
    ? 'Aucun enseignant pour ces critères.'
    : 'Aucun enseignant enregistré.',
);

const couleurStatut = (s: string) =>
  s === 'PERMANENT' ? 'primary' : s === 'VACATAIRE' ? 'accent' : 'secondary';

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: `« ${filtres.value.recherche} »`,
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.departementId) {
    const d = departements.value.find((x) => x.id === filtres.value.departementId);
    cs.push({
      label: `Département : ${d?.nom ?? '?'}`,
      value: filtres.value.departementId,
      icone: 'apartment',
    });
  }
  if (filtres.value.statut) {
    cs.push({ label: `Statut : ${LIBELLE_STATUT_ENSEIGNANT[filtres.value.statut] ?? filtres.value.statut}`, value: filtres.value.statut, icone: 'badge' });
  }
  return cs;
});

const colonnes: QTableColumn[] = [
  { name: 'nom', label: 'Nom & prénom', field: 'nom', align: 'left', sortable: true },
  { name: 'grade', label: 'Grade', field: (r: Enseignant) => r.grade || '—', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  {
    name: 'departement',
    label: 'Département',
    field: (r: Enseignant) => r.departement?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'taux',
    label: 'Taux horaire',
    field: (r: Enseignant) => (r.tauxHoraire ? montantLisible(r.tauxHoraire) : '—'),
    align: 'right',
  },
  { name: 'telephone', label: 'Téléphone', field: (r: Enseignant) => r.telephone || '—', align: 'left' },
  { name: 'compte', label: 'Compte', field: 'id', align: 'center' },
  { name: 'actions', label: 'Actions', field: 'id', align: 'right' },
];

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
      message: err?.response?.data?.message ?? 'Moyens d’attestation illisibles',
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
    title: 'Réinitialiser le code personnel',
    message: 'Un nouveau code sera généré et affiché une seule fois. Continuer ?',
    cancel: { label: 'Annuler', flat: true, noCaps: true },
    ok: { color: 'primary', label: 'Générer', unelevated: true, noCaps: true },
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
        message: e?.response?.data?.message ?? 'Génération du code impossible',
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
      title: 'Consentement de l’enseignant',
      html: true,
      message: `<p>À lire à l’enseignant avant la lecture :</p>
        <p><em>« Votre empreinte sera enregistrée sous forme de gabarit chiffré,
        jamais sous forme d’image, et servira uniquement à attester votre
        présence en cours. Vous pouvez refuser : le code personnel et la
        signature manuscrite restent à votre disposition. Vous pouvez demander
        son effacement à tout moment. »</em></p>`,
      cancel: { label: 'L’enseignant refuse', flat: true, noCaps: true },
      ok: { label: 'L’enseignant accepte', color: 'primary', unelevated: true, noCaps: true },
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
      message: 'Enrôlement abandonné — le code personnel reste disponible',
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
    if (!reponse.ok) throw new Error(capture.erreur ?? 'Lecture impossible');

    await api.put(`/attestation/enseignants/${id}/empreinte`, {
      template: capture.template,
      doigt: 'index droit',
      horodatage: capture.horodatage,
      signature: capture.signature,
      qualite: capture.qualite,
      consentement: true,
    });

    $q.notify({ type: 'positive', message: `Empreinte enrôlée (qualité ${capture.qualite})` });
    moyens.value = { ...moyens.value!, empreinte: true, empreinteDoigt: 'index droit' };
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.message ?? 'Enrôlement impossible' });
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
    title: 'Supprimer l’enseignant',
    message: `Supprimer définitivement ${e.nom} ${e.prenom} ainsi que ses affectations et séances ?`,
    cancel: { label: 'Annuler', flat: true, noCaps: true },
    ok: { color: 'negative', label: 'Supprimer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.delete(`/enseignants/${e.id}`);
      $q.notify({ type: 'positive', message: 'Enseignant supprimé' });
      await charger();
    } catch (err: any) {
      $q.notify({
        type: 'negative',
        message: err?.response?.data?.message ?? 'Suppression impossible',
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
      message: e?.response?.data?.message ?? 'Chargement des enseignants impossible',
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
