<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Inscriptions</div>
        <div class="page-sous-titre">
          Dossiers de l’année : encaisser les frais par Mobile Money ou au
          guichet, valider les dossiers réglés, imprimer les certificats.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle inscription au guichet"
          @click="dialogInscription = true"
        />
      </div>
    </div>

    <!-- Arrivée depuis la fiche d'un étudiant : le ciblage est annoncé et se lève. -->
    <q-banner v-if="etudiantCible" dense class="note--info q-mb-md">
      <template #avatar><q-icon name="person_search" /></template>
      Dossiers de <strong>{{ etudiantCible.prenom }} {{ etudiantCible.nom }}</strong>
      ({{ etudiantCible.matricule }}) — toutes années confondues.
      <template #action>
        <q-btn flat dense no-caps label="Voir tous les dossiers" @click="retirerEtudiantCible" />
      </template>
    </q-banner>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (n° de dossier, nom étudiant)…"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Année académique"
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
          label="Promotion"
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
        <champ-date v-model="filtres.dateDebut" label="Inscrit depuis" />
        <champ-date v-model="filtres.dateFin" label="jusqu'à" />
      </template>
      <template #actions>
        <view-toggle
          cle="inscriptions"
          :modes="['tableau', 'cartes']"
          defaut="tableau"
          @update:mode="(m) => (modeVue = (m as 'tableau' | 'cartes'))"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="inscriptions"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="inscriptions-vide">
          <q-icon name="how_to_reg" size="42px" class="q-mb-sm" />
          <div>{{ messageVide }}</div>
          <div class="q-mt-sm q-gutter-sm">
            <q-btn
              v-if="filtresActifs"
              outline
              no-caps
              icon="refresh"
              label="Réinitialiser les filtres"
              @click="reinitialiser"
            />
            <q-btn
              v-if="peutGerer"
              unelevated
              color="primary"
              no-caps
              icon="add"
              label="Nouvelle inscription au guichet"
              @click="dialogInscription = true"
            />
          </div>
        </div>
      </template>

      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-promotion="p">
        <q-td :props="p">
          <q-chip dense outline color="primary">{{ p.row.promotion?.nom }}</q-chip>
          <div class="text-caption text-grey-7">{{ p.row.annee?.libelle }}</div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ badge-statut" :class="classeStatut(p.row.statut)">
            {{ LIBELLE_STATUT_INSCRIPTION[p.row.statut] ?? p.row.statut }}
          </span>
        </q-td>
      </template>

      <template #body-cell-montantFrais="p">
        <q-td :props="p" class="text-right text-weight-medium">
          {{ montantLisible(p.row.montantFrais) }}
        </q-td>
      </template>

      <template #body-cell-paye="p">
        <q-td :props="p" class="text-right chiffres">
          <span :class="{ 'text-positive text-weight-medium': resteAPayer(p.row) === 0 }">
            {{ montantLisible(montantPaye(p.row)) }}
          </span>
        </q-td>
      </template>

      <template #body-cell-solde="p">
        <q-td :props="p" class="text-right text-weight-medium chiffres">
          <span :class="{ 'text-negative': resteAPayer(p.row) > 0 }">
            {{ montantLisible(resteAPayer(p.row)) }}
          </span>
        </q-td>
      </template>

      <template #body-cell-dateInscription="p">
        <q-td :props="p">
          {{ dateLisible(p.row.dateInscription ?? p.row.createdAt) }}
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="peutEncaisserDossier(p.row)"
            flat
            dense
            round
            color="primary"
            icon="payments"
            aria-label="Encaisser un paiement sur ce dossier"
            @click="encaisser(p.row)"
          >
            <q-tooltip>
              Encaisser — reste {{ montantLisible(resteAPayer(p.row)) }} GNF
            </q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="receipt_long"
            aria-label="Voir les paiements de ce dossier"
            @click="voirPaiements(p.row)"
          >
            <q-tooltip>Paiements du dossier</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutValider(p.row)"
            flat
            dense
            round
            color="positive"
            icon="verified"
            aria-label="Valider le dossier"
            @click="valider(p.row)"
          >
            <q-tooltip>Valider le dossier (frais réglés)</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutAnnuler(p.row)"
            flat
            dense
            round
            color="negative"
            icon="cancel"
            aria-label="Annuler le dossier"
            @click="annuler(p.row)"
          >
            <q-tooltip>Annuler le dossier</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            aria-label="Imprimer le certificat d'inscription"
            @click="imprimer(p.row)"
          >
            <q-tooltip>Certificat d’inscription A4</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            color="primary"
            icon="person"
            aria-label="Voir la fiche de l'étudiant"
            @click="voirEtudiant(p.row)"
          >
            <q-tooltip>Fiche de l’étudiant</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <q-linear-progress
      v-if="modeVue === 'cartes' && chargement"
      indeterminate
      color="primary"
      class="q-mb-sm"
    />

    <div v-else-if="modeVue === 'cartes'" class="inscriptions-cartes">
      <q-card
        v-for="d in inscriptions"
        :key="d.id"
        flat
        bordered
        class="carte inscriptions-cartes__carte"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <span class="champ badge-statut" :class="classeStatut(d.statut)">
              {{ LIBELLE_STATUT_INSCRIPTION[d.statut] ?? d.statut }}
            </span>
            <q-space />
            <div class="text-caption text-grey-7">{{ d.numero }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">
            {{ d.etudiant?.nom }} {{ d.etudiant?.prenom }}
          </div>
          <div class="text-caption text-grey-7">
            {{ d.etudiant?.matricule }} · {{ d.promotion?.nom }} · {{ d.annee?.libelle }}
          </div>
          <div class="row q-mt-sm q-col-gutter-sm">
            <div class="col-4">
              <div class="text-caption text-grey-7">Frais</div>
              <div class="text-weight-medium chiffres">{{ montantLisible(d.montantFrais) }}</div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-7">Payé</div>
              <div class="text-weight-medium chiffres text-positive">
                {{ montantLisible(montantPaye(d)) }}
              </div>
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-7">Reste à payer</div>
              <div
                class="text-weight-medium chiffres"
                :class="{ 'text-negative': resteAPayer(d) > 0 }"
              >
                {{ montantLisible(resteAPayer(d)) }}
              </div>
            </div>
          </div>
          <div class="text-caption text-grey-7 q-mt-xs">
            {{ dateLisible(d.dateInscription ?? d.createdAt) }}
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-gutter-xs">
          <q-btn
            v-if="peutEncaisserDossier(d)"
            flat
            dense
            color="primary"
            icon="payments"
            no-caps
            label="Encaisser"
            @click="encaisser(d)"
          />
          <q-btn
            flat
            dense
            icon="receipt_long"
            no-caps
            label="Paiements"
            @click="voirPaiements(d)"
          />
          <q-btn
            v-if="peutValider(d)"
            flat
            dense
            color="positive"
            icon="verified"
            no-caps
            label="Valider"
            @click="valider(d)"
          />
          <q-btn
            v-if="peutAnnuler(d)"
            flat
            dense
            color="negative"
            icon="cancel"
            no-caps
            label="Annuler"
            @click="annuler(d)"
          />
          <q-btn
            flat
            dense
            color="primary"
            icon="print"
            no-caps
            label="Certificat"
            @click="imprimer(d)"
          />
          <q-btn
            flat
            dense
            icon="person"
            no-caps
            label="Étudiant"
            @click="voirEtudiant(d)"
          />
        </q-card-actions>
      </q-card>
      <div v-if="!inscriptions.length" class="inscriptions-vide">
        <q-icon name="how_to_reg" size="42px" class="q-mb-sm" />
        <div>{{ messageVide }}</div>
        <div class="q-mt-sm q-gutter-sm">
          <q-btn
            v-if="filtresActifs"
            outline
            no-caps
            icon="refresh"
            label="Réinitialiser les filtres"
            @click="reinitialiser"
          />
          <q-btn
            v-if="peutGerer"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Nouvelle inscription au guichet"
            @click="dialogInscription = true"
          />
        </div>
      </div>
    </div>

    <pagination-bar
      v-if="inscriptions.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <inscription-dialog v-model="dialogInscription" @enregistre="charger" />
    <paiement-dialog
      v-model="dialogPaiement"
      :inscription-id="paiementInscriptionId"
      :montant-initial="paiementMontantInitial"
      @paye="charger"
    />
    <etudiant-dialog
      v-model="dialogFicheEtudiant"
      :etudiant="etudiantEdite"
      @enregistre="charger"
    />

    <!-- Dialog : aperçu de l'étudiant -->
    <q-dialog v-model="dialogEtudiant">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">
              {{ etudiantApercu?.nom }} {{ etudiantApercu?.prenom }}
            </div>
            <div class="text-caption text-grey-7">
              {{ etudiantApercu?.matricule }}
            </div>
          </div>
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-linear-progress v-if="chargementEtudiant" indeterminate color="primary" />
          <div v-else-if="!etudiantApercu" class="text-center q-pa-md text-grey-7">
            Fiche étudiant indisponible.
          </div>
          <q-list v-else separator dense>
            <q-item>
              <q-item-section>
                <q-item-label caption>Sexe</q-item-label>
                <q-item-label>{{ etudiantApercu?.sexe ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Date de naissance</q-item-label>
                <q-item-label>{{ dateLisible(etudiantApercu?.dateNaissance) }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Téléphone</q-item-label>
                <q-item-label>{{ etudiantApercu?.telephone ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>E-mail</q-item-label>
                <q-item-label>{{ etudiantApercu?.email ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Adresse</q-item-label>
                <q-item-label>{{ etudiantApercu?.adresse ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Compte portail</q-item-label>
                <q-item-label>
                  {{ etudiantApercu?.user ? etudiantApercu.user.email : 'aucun' }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Fermer" v-close-popup />
          <q-btn
            v-if="etudiantApercu"
            flat
            no-caps
            icon="groups"
            label="Registre"
            @click="ouvrirRegistreEtudiant"
          />
          <q-btn
            v-if="etudiantApercu && peutGerer"
            flat
            no-caps
            icon="payments"
            label="Ses paiements"
            @click="voirPaiementsEtudiant"
          />
          <q-btn
            v-if="peutGerer && etudiantApercu"
            color="primary"
            unelevated
            no-caps
            icon="edit"
            label="Modifier la fiche"
            @click="ouvrirModificationEtudiant"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import InscriptionDialog from '../components/InscriptionDialog.vue';
import PaiementDialog from '../components/PaiementDialog.vue';
import EtudiantDialog from '../components/EtudiantDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import ChampDate from '../components/ChampDate.vue';
import {
  LIBELLE_STATUT_INSCRIPTION,
  dateLisible,
  montantLisible,
} from '../utils/libelles';
import type {
  AnneeAcademique,
  Etudiant,
  Inscription,
  Paiement,
  Promotion,
  StatutInscription, ChipFiltre } from '../types';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const inscriptions = ref<Inscription[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<Promotion[]>([]);
const chargement = ref(false);
const modeVue = ref<'tableau' | 'cartes'>('tableau');

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
/** Tant que les filtres d'ouverture ne sont pas posés, le watcher ne recharge pas. */
const pret = ref(false);

const filtres = ref<Record<string, any>>({});
/** Étudiant reçu en paramètre d'URL (`/inscriptions?etudiant=…`). */
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

const peutGerer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
/** Encaisser, c'est créer un paiement : mêmes rôles que `POST /paiements`. */
const peutEncaisser = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));

const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !filtres.value.anneeId || p.anneeId === filtres.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);
const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_INSCRIPTION).map(([value, label]) => ({ value, label })),
);

const colonnes: QTableColumn[] = [
  { name: 'numero', label: 'N° dossier', field: 'numero', align: 'left', sortable: true },
  { name: 'etudiant', label: 'Étudiant', field: 'etudiant', align: 'left' },
  { name: 'promotion', label: 'Année / Promotion', field: 'promotion', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  { name: 'montantFrais', label: 'Frais (GNF)', field: 'montantFrais', align: 'right', sortable: true },
  { name: 'paye', label: 'Payé (GNF)', field: 'paye', align: 'right' },
  { name: 'solde', label: 'Reste à payer (GNF)', field: 'solde', align: 'right' },
  { name: 'dateInscription', label: 'Inscrit le', field: 'dateInscription', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const classeStatut = (s: string) =>
  ({
    BROUILLON: 'champ--brouillon',
    EN_ATTENTE_PAIEMENT: 'champ--attente-paiement',
    PAYEE: 'champ--payee',
    VALIDEE: 'champ--validee',
    ANNULEE: 'champ--annulee',
  })[s] ?? 'champ--brouillon';

/** Au moins un critère est posé : l'état vide se répare en réinitialisant. */
const filtresActifs = computed(
  () =>
    !!etudiantCible.value ||
    Object.entries(filtres.value).some(([, v]) => v !== null && v !== undefined && v !== ''),
);

const messageVide = computed(() => {
  if (etudiantCible.value) {
    return `${etudiantCible.value.prenom} ${etudiantCible.value.nom} n’a aucun dossier d’inscription.`;
  }
  return filtresActifs.value
    ? 'Aucun dossier ne correspond à ces critères.'
    : 'Aucun dossier d’inscription : ouvrez-en un au guichet.';
});

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
  if (filtres.value.anneeId) {
    const a = annees.value.find((x) => x.id === filtres.value.anneeId);
    cs.push({ label: `Année : ${a?.libelle ?? '?'}`, value: filtres.value.anneeId, icone: 'calendar_today' });
  }
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: `Promo : ${p?.nom ?? '?'}`, value: filtres.value.promotionId, icone: 'school' });
  }
  if (filtres.value.statut) {
    cs.push({
      label: `Statut : ${LIBELLE_STATUT_INSCRIPTION[filtres.value.statut as StatutInscription] ?? filtres.value.statut}`,
      value: filtres.value.statut,
      icone: 'flag',
    });
  }
  if (filtres.value.dateDebut) {
    cs.push({
      label: `Depuis : ${dateLisible(filtres.value.dateDebut)}`,
      value: filtres.value.dateDebut,
      icone: 'event',
    });
  }
  if (filtres.value.dateFin) {
    cs.push({
      label: `Jusqu'à : ${dateLisible(filtres.value.dateFin)}`,
      value: filtres.value.dateFin,
      icone: 'event',
    });
  }
  return cs;
});

/** Somme réellement encaissée sur le dossier (seuls les paiements réussis comptent). */
function montantPaye(dossier: Inscription): number {
  return (dossier.paiements ?? [])
    .filter((p: Paiement) => p.statut === 'REUSSI')
    .reduce((t, p) => t + p.montant, 0);
}

/** Reste dû sur les frais d'inscription. */
function resteAPayer(dossier: Inscription): number {
  return Math.max(0, dossier.montantFrais - montantPaye(dossier));
}

const peutValider = (d: Inscription) =>
  auth.aRole(['SCOLARITE', 'ADMIN']) && d.statut === 'PAYEE';
const peutAnnuler = (d: Inscription) =>
  auth.aRole(['ADMIN', 'DIRECTION']) && !['VALIDEE', 'ANNULEE'].includes(d.statut);
/** Un dossier annulé ne s'encaisse plus, un dossier soldé non plus. */
const peutEncaisserDossier = (d: Inscription) =>
  peutEncaisser.value && d.statut !== 'ANNULEE' && resteAPayer(d) > 0;

/** Encaissement : le dialogue s'ouvre sur le dossier, au montant restant dû. */
function encaisser(row: Inscription) {
  paiementInscriptionId.value = row.id;
  paiementMontantInitial.value = resteAPayer(row);
  dialogPaiement.value = true;
}

/** Écran Paiements préfiltré sur le dossier. */
function voirPaiements(dossier: Inscription) {
  void router.push({ path: '/paiements', query: { inscription: dossier.id } });
}

function valider(dossier: Inscription) {
  $q.dialog({
    title: 'Valider le dossier',
    message: `Valider ${dossier.numero} (${dossier.etudiant?.prenom} ${dossier.etudiant?.nom}) ? Les frais sont réglés, le dossier devient définitif.`,
    cancel: true,
    ok: { label: 'Valider', color: 'positive', unelevated: true },
  }).onOk(async () => {
    await api.put(`/inscriptions/${dossier.id}/valider`);
    $q.notify({ type: 'positive', message: 'Dossier validé' });
    await charger();
  });
}

function annuler(dossier: Inscription) {
  $q.dialog({
    title: 'Annuler le dossier',
    message: `Annuler ${dossier.numero} ? Les paiements restent tracés au registre.`,
    cancel: true,
    ok: { color: 'negative', label: 'Annuler le dossier' },
  }).onOk(async () => {
    await api.put(`/inscriptions/${dossier.id}/annuler`);
    $q.notify({ type: 'warning', message: 'Dossier annulé' });
    await charger();
  });
}

function imprimer(dossier: Inscription) {
  window.open(
    `${API_URL}/inscriptions/${dossier.id}/attestation-inscription?token=${encodeURIComponent(auth.token)}`,
    '_blank',
  );
}

async function voirEtudiant(dossier: Inscription) {
  dialogEtudiant.value = true;
  chargementEtudiant.value = true;
  etudiantApercu.value = null;
  try {
    const { data } = await api.get(`/etudiants/${dossier.etudiantId}`);
    etudiantApercu.value = data;
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

/** Paramètres réellement compris par `GET /inscriptions`. */
function paramsServeur(): Record<string, any> {
  const params: Record<string, any> = { all: '1' };
  if (filtres.value.recherche) params.search = filtres.value.recherche;
  if (filtres.value.anneeId) params.anneeId = filtres.value.anneeId;
  if (filtres.value.promotionId) params.promotionId = filtres.value.promotionId;
  if (filtres.value.statut) params.statut = filtres.value.statut;
  return params;
}

/**
 * Les bornes de date ne sont pas filtrées par l'API ; l'étudiant ciblé non
 * plus (la recherche par matricule dégrossit, on resserre ici sur l'identifiant).
 */
function filtrerLocalement(liste: Inscription[]): Inscription[] {
  let r = liste;
  if (etudiantCible.value) {
    r = r.filter((i) => i.etudiantId === etudiantCible.value!.id);
  }
  if (filtres.value.dateDebut) {
    const d = new Date(filtres.value.dateDebut).getTime();
    r = r.filter((i) => {
      const c = i.dateInscription ?? i.createdAt;
      return c ? new Date(c).getTime() >= d : true;
    });
  }
  if (filtres.value.dateFin) {
    const d = new Date(filtres.value.dateFin).getTime() + 86_400_000 - 1;
    r = r.filter((i) => {
      const c = i.dateInscription ?? i.createdAt;
      return c ? new Date(c).getTime() <= d : true;
    });
  }
  return r;
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/inscriptions', {
      params: { ...paramsServeur(), page: page.value, pageSize: pageSize.value },
    });
    const liste = filtrerLocalement(data.data ?? []);
    inscriptions.value = liste;
    total.value = data.total ?? liste.length;
  } catch {
    inscriptions.value = [];
    total.value = 0;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  chargement.value = true;
  try {
    const { data } = await api.get('/inscriptions', {
      params: { ...paramsServeur(), pageSize: 1000 },
    });
    const liste = filtrerLocalement(data.data ?? []);
    inscriptions.value = liste;
    total.value = liste.length;
    pageSize.value = Math.max(liste.length, 1);
    page.value = 1;
  } catch {
    inscriptions.value = [];
    total.value = 0;
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = {};
  retirerEtudiantCible();
  page.value = 1;
  void charger();
}

/** Lève le ciblage venu de l'URL et nettoie la barre d'adresse. */
async function retirerEtudiantCible() {
  if (!etudiantCible.value) return;
  // Le drapeau évite que chaque retrait de filtre déclenche sa propre requête.
  pret.value = false;
  etudiantCible.value = null;
  delete filtres.value.recherche;
  filtres.value.anneeId = annees.value.find((an) => an.active)?.id ?? null;
  await router.replace({ path: '/inscriptions' });
  page.value = 1;
  pret.value = true;
  await charger();
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.anneeId,
    filtres.value.promotionId,
    filtres.value.statut,
    filtres.value.dateDebut,
    filtres.value.dateFin,
  ],
  () => {
    if (!pret.value) return;
    page.value = 1;
    void charger();
  },
);

/**
 * `/inscriptions?etudiant=<id>` : on lit la fiche pour afficher son nom et
 * poser la recherche sur son matricule — `GET /inscriptions` ne filtre pas par
 * étudiant, mais sa recherche couvre le matricule.
 */
async function appliquerEtudiantCible(id: string) {
  try {
    const { data } = await api.get(`/etudiants/${id}`);
    etudiantCible.value = data;
    filtres.value.recherche = data.matricule;
    // Le dossier cherché peut relever d'une autre année que l'année active.
    filtres.value.anneeId = null;
  } catch {
    etudiantCible.value = null;
    $q.notify({ type: 'warning', message: 'Étudiant introuvable : filtre ignoré.' });
  }
}

onMounted(async () => {
  try {
    const [a, promos] = await Promise.all([
      api.get('/annees', { params: { all: '1' } }),
      api.get('/promotions', { params: { all: '1' } }),
    ]);
    annees.value = a.data.data ?? [];
    promotions.value = promos.data.data ?? [];
  } catch {
    annees.value = [];
    promotions.value = [];
  }

  const cible = route.query.etudiant as string | undefined;
  const recherche = route.query.recherche as string | undefined;
  if (cible) {
    await appliquerEtudiantCible(cible);
  } else if (recherche) {
    // Arrivée par n° de dossier (depuis un paiement) : toutes années confondues.
    filtres.value.recherche = recherche;
    filtres.value.anneeId = null;
  } else {
    filtres.value.anneeId = annees.value.find((an) => an.active)?.id ?? null;
  }

  pret.value = true;
  await charger();
});
</script>

<style scoped lang="scss">
.inscriptions-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--up-3);
}
.inscriptions-cartes__carte {
  background: var(--up-plaque);
}

// État vide : on nomme la cause et on offre la sortie.
.inscriptions-vide {
  grid-column: 1 / -1;
  padding: var(--up-5);
  text-align: center;
  color: var(--up-encre-douce);
}

.champ.badge-statut {
  display: inline-flex;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.champ--brouillon { background: #cfd4d9; color: #33463f; }
.champ--attente-paiement { background: #e8a317; color: #10251e; }
.champ--payee { background: #1e7a4c; }
.champ--validee { background: #1565c0; }
.champ--annulee { background: #c2321e; }
</style>
