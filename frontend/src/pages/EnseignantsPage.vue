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

    <q-table
      flat
      bordered
      class="carte"
      :rows="enseignants"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :filter="recherche"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #top-left>
        <div class="row q-gutter-sm">
          <q-input v-model="recherche" dense outlined clearable placeholder="Rechercher…">
            <template #prepend><q-icon name="search" /></template>
          </q-input>
          <q-select
            v-model="departementId"
            :options="optionsDepartements"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Département"
            style="min-width: 180px"
            @update:model-value="charger"
          />
        </div>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-chip
            dense
            :color="p.row.statut === 'PERMANENT' ? 'primary' : p.row.statut === 'VACATAIRE' ? 'accent' : 'secondary'"
            text-color="white"
          >
            {{ p.row.statut }}
          </q-chip>
          <q-badge v-if="!p.row.actif" color="grey-7" class="q-ml-xs">inactif</q-badge>
        </q-td>
      </template>

      <template #body-cell-compte="p">
        <q-td :props="p">
          <q-icon
            :name="p.row.user ? 'check_circle' : 'remove_circle_outline'"
            :color="p.row.user ? 'positive' : 'grey-5'"
          />
          <q-tooltip>
            {{ p.row.user ? `Compte : ${p.row.user.email}` : 'Aucun compte de connexion' }}
          </q-tooltip>
        </q-td>
      </template>

      <template #body-cell-attestation="p">
        <q-td :props="p">
          <q-btn flat dense no-caps color="primary" icon="verified_user" @click="ouvrirMoyens(p.row)">
            <q-tooltip>Moyens d’attestation de présence</q-tooltip>
          </q-btn>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="assessment" @click="imprimerFiche(p.row)">
            <q-tooltip>Fiche d’assiduité</q-tooltip>
          </q-btn>
          <q-btn v-if="auth.peutPlanifier" flat dense round icon="edit" @click="ouvrir(p.row)" />
          <q-btn
            v-if="auth.estAdmin"
            flat
            dense
            round
            color="negative"
            icon="delete"
            @click="supprimer(p.row)"
          />
        </q-td>
      </template>
    </q-table>

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

        <q-list separator>
          <q-item>
            <q-item-section avatar><q-icon name="dialpad" color="secondary" /></q-item-section>
            <q-item-section>
              <q-item-label>Code personnel</q-item-label>
              <q-item-label caption>
                {{ moyens?.codePin ? 'Défini' : 'Aucun code défini' }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat dense no-caps label="Réinitialiser" @click="reinitialiserPin" />
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
              />
            </q-item-section>
          </q-item>

        </q-list>

        <q-banner v-if="codeGenere" class="note--valide q-ma-md">
          <template #avatar><q-icon name="key" /></template>
          Nouveau code : <strong class="text-h6">{{ codeGenere }}</strong><br />
          <span class="text-caption">Communiquez-le à l’enseignant, il ne sera plus affiché.</span>
        </q-banner>

        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import EnseignantDialog from '../components/EnseignantDialog.vue';
import {
  aujourdhui,
  decalerJours,
  montantLisible,
  passerelleConfiguree,
  urlPasserelle,
} from '../utils/libelles';
import type { Departement, Enseignant, MoyensAttestation } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const enseignants = ref<Enseignant[]>([]);
const departements = ref<Departement[]>([]);
const departementId = ref<string | null>(null);
const chargement = ref(false);
const recherche = ref('');
const dialogOuvert = ref(false);
const enseignantEdite = ref<Enseignant | null>(null);

const dialogMoyens = ref(false);
const enseignantMoyens = ref<Enseignant | null>(null);
const moyens = ref<MoyensAttestation | null>(null);
const passerellePrete = ref(false);
const enrolementEnCours = ref(false);
const codeGenere = ref('');

const optionsDepartements = computed(() =>
  departements.value.map((d) => ({ label: d.nom, value: d.id })),
);

const colonnes: QTableColumn[] = [
  { name: 'matricule', label: 'Matricule', field: 'matricule', align: 'left', sortable: true },
  {
    name: 'nom',
    label: 'Nom & prénom',
    field: (r: Enseignant) => `${r.nom} ${r.prenom}`,
    align: 'left',
    sortable: true,
  },
  { name: 'grade', label: 'Grade', field: 'grade', align: 'left' },
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
  { name: 'telephone', label: 'Téléphone', field: 'telephone', align: 'left' },
  { name: 'compte', label: 'Compte', field: 'id', align: 'center' },
  { name: 'attestation', label: 'Attestation', field: 'id', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrir(e: Enseignant | null) {
  enseignantEdite.value = e;
  dialogOuvert.value = true;
}

// ------------------------------------------------- moyens d'attestation

async function ouvrirMoyens(e: Enseignant) {
  enseignantMoyens.value = e;
  codeGenere.value = '';
  moyens.value = null;
  dialogMoyens.value = true;

  const { data } = await api.get(`/attestation/enseignants/${e.id}/moyens`);
  moyens.value = data;

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
    cancel: true,
  }).onOk(async () => {
    const { data } = await api.post(
      `/attestation/enseignants/${enseignantMoyens.value!.id}/code-pin/reinitialiser`,
    );
    codeGenere.value = data.code;
    moyens.value = { ...moyens.value!, codePin: true };
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
  window.open(
    `${API_URL}/impression/fiche-enseignant/${e.id}?dateDebut=${debut}&dateFin=${aujourdhui()}&token=${auth.token}`,
    '_blank',
  );
}

function supprimer(e: Enseignant) {
  $q.dialog({
    title: 'Supprimer',
    message: `Supprimer définitivement ${e.nom} ${e.prenom} ainsi que ses affectations et séances ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/enseignants/${e.id}`);
    $q.notify({ type: 'positive', message: 'Enseignant supprimé' });
    await charger();
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/enseignants', {
      params: { all: '1', departementId: departementId.value || undefined },
    });
    enseignants.value = data.data;
  } finally {
    chargement.value = false;
  }
}

onMounted(async () => {
  const { data } = await api.get('/departements', { params: { all: '1' } });
  departements.value = data.data;
  await charger();
});
</script>
