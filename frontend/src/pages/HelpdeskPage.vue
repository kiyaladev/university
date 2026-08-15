<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Support IT & helpdesk</div>
        <div class="page-sous-titre">
          Un QR sur chaque équipement : l’enseignant scanne, décrit le problème
          en deux clics, la DSI est prévenue sans attendre la rumeur.
        </div>
      </div>
      <div class="col-auto">
        <q-btn unelevated color="primary" no-caps icon="warning" label="Déclarer un incident" @click="declarerOuvert = true" />
      </div>
    </div>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="mes-tickets" icon="assignment_outlined" label="Mes tickets / Déclarer" no-caps />
      <q-tab v-if="dsi" name="gestion" icon="support_agent" label="Gestion DSI" no-caps />
      <q-tab v-if="dsi" name="equipements" icon="qr_code_2" label="Équipements & QR" no-caps />
    </q-tabs>

    <q-tab-panels v-model="onglet" animated class="bg-transparent q-mt-md">
      <!-- ---------------------------------------------------------------- -->
      <!-- Mes tickets : le tableau de bord du déclarant                    -->
      <!-- ---------------------------------------------------------------- -->
      <q-tab-panel name="mes-tickets" class="q-pa-none">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-lg-4">
            <q-card flat bordered class="carte">
              <q-card-section>
                <div class="text-h6">Déclarer en deux clics</div>
                <div class="page-sous-titre q-mb-md">
                  Arrivé par le QR d’un équipement ? Le formulaire s’ouvre déjà prêt —
                  il ne reste qu’à choisir la catégorie et décrire la panne.
                </div>
                <div class="row q-col-gutter-sm">
                  <div v-for="c in categoriesApercu" :key="c.value" class="col-6">
                    <q-btn
                      flat
                      no-caps
                      class="tuile-cat full-width"
                      @click="declarerOuvert = true"
                    >
                      <div class="column items-center">
                        <q-icon :name="c.icone" size="22px" />
                        <span class="q-mt-xs text-center">{{ c.label }}</span>
                      </div>
                    </q-btn>
                  </div>
                </div>
                <div class="row q-mt-md">
                  <q-btn unelevated color="primary" no-caps icon="add" label="Autre problème" class="full-width" @click="declarerOuvert = true" />
                </div>
              </q-card-section>
            </q-card>
          </div>

          <div class="col-12 col-lg-8">
            <q-table
              flat
              bordered
              class="carte"
              :rows="mesTickets"
              :columns="colonnesMes"
              row-key="id"
              :loading="chargementMes"
              :pagination="{ rowsPerPage: 10 }"
            >
              <template #top-left>
                <div class="text-subtitle1 text-weight-medium">Mes déclarations</div>
              </template>
              <template #body-cell-statut="p">
                <q-td :props="p">
                  <span class="ticket-champ" :class="`ticket-champ--${p.row.statut}`">
                    <span class="pochoir">{{ libelleStatut(p.row.statut) }}</span>
                  </span>
                </q-td>
              </template>
              <template #body-cell-priorite="p">
                <q-td :props="p">
                  <span class="ticket-champ" :class="`prio-champ--${p.row.priorite}`">
                    <span class="pochoir">{{ libellePriorite(p.row.priorite) }}</span>
                  </span>
                </q-td>
              </template>
            </q-table>
          </div>
        </div>
      </q-tab-panel>

      <!-- ---------------------------------------------------------------- -->
      <!-- Gestion DSI : tout le registre, filtres et prise en charge        -->
      <!-- ---------------------------------------------------------------- -->
      <q-tab-panel v-if="dsi" name="gestion" class="q-pa-none">
        <div class="row q-col-gutter-md q-mb-md">
          <div v-for="s in statutPlaques" :key="s.cle" class="col-6 col-md-3">
            <q-card flat bordered class="carte">
              <q-card-section class="text-center">
                <div class="stat-chiffre chiffres">{{ stats?.[s.cle] ?? 0 }}</div>
                <div class="pochoir text-grey-7">{{ s.libelle }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
        <q-banner v-if="dsi" class="note--info q-mb-md">
          Taux de résolution le jour même : <strong>{{ stats?.tauxResolution24h ?? 0 }} %</strong>
          ({{ stats?.resolus24h ?? 0 }} résolu{{ (stats?.resolus24h ?? 0) > 1 ? 's' : '' }} au cours des 24 dernières heures)
        </q-banner>

        <q-card flat bordered class="carte q-mb-md">
          <q-card-section class="row q-col-gutter-sm">
            <div class="col-6 col-md-2">
              <q-select v-model="filtres.statut" :options="optionsStatuts" outlined dense clearable emit-value map-options label="Statut" />
            </div>
            <div class="col-6 col-md-3">
              <q-select v-model="filtres.categorie" :options="optionsCategories" outlined dense clearable emit-value map-options label="Catégorie" />
            </div>
            <div class="col-6 col-md-2">
              <q-select v-model="filtres.priorite" :options="optionsPriorites" outlined dense clearable emit-value map-options label="Priorité" />
            </div>
            <div class="col-6 col-md-3">
              <q-select v-model="filtres.equipementId" :options="optionsEquipements" outlined dense clearable emit-value map-options label="Équipement" />
            </div>
            <div class="col-12 col-md-2">
              <q-input v-model="filtres.search" outlined dense clearable placeholder="N°, description…">
                <template #prepend><q-icon name="search" /></template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>

        <q-table
          flat
          bordered
          class="carte"
          :rows="tickets"
          :columns="colonnesGestion"
          row-key="id"
          :loading="chargementGestion"
          :pagination="{ rowsPerPage: 20 }"
        >
          <template #body-cell-priorite="p">
            <q-td :props="p">
              <span class="ticket-champ" :class="`prio-champ--${p.row.priorite}`">
                <span class="pochoir">{{ libellePriorite(p.row.priorite) }}</span>
              </span>
            </q-td>
          </template>
          <template #body-cell-statut="p">
            <q-td :props="p">
              <span class="ticket-champ" :class="`ticket-champ--${p.row.statut}`">
                <span class="pochoir">{{ libelleStatut(p.row.statut) }}</span>
              </span>
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn flat dense round icon="visibility" @click="ticketDetail = p.row">
                <q-tooltip>Visualiser</q-tooltip>
              </q-btn>
              <q-btn
                v-if="p.row.statut === 'OUVERT' || p.row.statut === 'EN_COURS'"
                flat
                dense
                round
                icon="autorenew"
              >
                <q-tooltip>Changer le statut</q-tooltip>
                <q-menu>
                  <q-list dense style="min-width: 220px">
                    <q-item clickable v-close-popup @click="changerStatut(p.row, 'EN_COURS')">
                      <q-item-section avatar><q-icon name="handyman" size="18px" /></q-item-section>
                      <q-item-section>Passer « en cours »</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="changerStatut(p.row, 'RESOLU')">
                      <q-item-section avatar><q-icon name="check_circle" size="18px" color="positive" /></q-item-section>
                      <q-item-section>Résolu</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="changerStatut(p.row, 'CLOTURE')">
                      <q-item-section avatar><q-icon name="archive" size="18px" /></q-item-section>
                      <q-item-section>Clôturer</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- ---------------------------------------------------------------- -->
      <!-- Équipements & QR : le parc, les étiquettes, la fiche                 -->
      <!-- ---------------------------------------------------------------- -->
      <q-tab-panel v-if="dsi" name="equipements" class="q-pa-none">
        <div class="row items-center q-mb-md">
          <div class="col">
            <div class="page-sous-titre">
              Chaque étiquette porte un QR unique : les pannes arrivent à la DSI
              avec le nom exact de l’équipement, sans usurpation possible.
            </div>
          </div>
          <div class="col-auto">
            <q-btn unelevated color="primary" no-caps icon="add" label="Nouvel équipement" @click="ouvrirEquipement(null)" />
          </div>
        </div>

        <q-card flat bordered class="carte q-mb-md">
          <q-card-section class="row q-col-gutter-sm items-center">
            <div class="col-12 col-md-4">
              <q-input v-model="filtresEquip.search" outlined dense clearable placeholder="Rechercher…">
                <template #prepend><q-icon name="search" /></template>
              </q-input>
            </div>
            <div class="col-12 col-md-3">
              <q-select
                v-model="filtresEquip.actif"
                :options="[
                  { label: 'Tous', value: null },
                  { label: 'En service', value: 'true' },
                  { label: 'Inactifs', value: 'false' },
                ]"
                outlined
                dense
                emit-value
                map-options
                label="État"
              />
            </div>
          </q-card-section>
        </q-card>

        <q-table
          flat
          bordered
          class="carte"
          :rows="equipements"
          :columns="colonnesEquipements"
          row-key="id"
          :loading="chargementEquipements"
          :pagination="{ rowsPerPage: 20 }"
        >
          <template #body-cell-actif="p">
            <q-td :props="p">
              <q-badge :color="p.row.actif ? 'positive' : 'grey-7'">
                {{ p.row.actif ? 'en service' : 'désactivé' }}
              </q-badge>
            </q-td>
          </template>
          <template #body-cell-codeQr="p">
            <q-td :props="p">
              <span class="text-caption ellipsis" style="max-width: 200px; display: inline-block; vertical-align: middle">
                {{ p.row.codeQr }}
              </span>
              <q-btn flat dense round size="sm" icon="content_copy" @click="copier(p.row.codeQr)">
                <q-tooltip>Copier le code</q-tooltip>
              </q-btn>
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn flat dense round icon="print" @click="imprimerQr(p.row)">
                <q-tooltip>Imprimer l’étiquette QR</q-tooltip>
              </q-btn>
              <q-btn
                v-if="dsi"
                flat
                dense
                round
                icon="edit"
                @click="ouvrirEquipement(p.row)"
              >
                <q-tooltip>Modifier</q-tooltip>
              </q-btn>
              <q-btn v-if="auth.estAdmin" flat dense round color="negative" icon="delete" @click="supprimerEquipement(p.row)">
                <q-tooltip>Supprimer</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Détail d'un ticket (gestion DSI) -->
    <q-dialog :model-value="!!ticketDetail" @update:model-value="ticketDetail = null">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section v-if="ticketDetail" class="text-h6">
          Ticket {{ ticketDetail.numero }}
        </q-card-section>
        <q-card-section v-if="ticketDetail" class="q-gutter-md">
          <div class="row q-gutter-x-md items-center">
            <span class="ticket-champ" :class="`ticket-champ--${ticketDetail.statut}`">
              <span class="pochoir">{{ libelleStatut(ticketDetail.statut) }}</span>
            </span>
            <span class="ticket-champ" :class="`prio-champ--${ticketDetail.priorite}`">
              <span class="pochoir">{{ libellePriorite(ticketDetail.priorite) }}</span>
            </span>
            <span class="text-caption text-grey-7">{{ dateHeureLisible(ticketDetail.createdAt) }}</span>
          </div>

          <div>
            <span class="section-titre">Signalement</span>
            <div class="text-body1">{{ libelleCategorie(ticketDetail.categorie) }}</div>
            <div class="q-mt-sm" style="white-space: pre-wrap">{{ ticketDetail.description }}</div>
          </div>

          <div class="row q-col-gutter-md">
            <div class="col-6">
              <span class="section-titre">Équipement</span>
              <div>{{ ticketDetail.equipement?.libelle ?? '—' }}</div>
              <div class="text-caption text-grey-7">{{ ticketDetail.equipement?.emplacement ?? '' }}</div>
            </div>
            <div class="col-6">
              <span class="section-titre">Déclarant</span>
              <div>
                {{
                  ticketDetail.utilisateur
                    ? `${ticketDetail.utilisateur.prenom} ${ticketDetail.utilisateur.nom}`
                    : (ticketDetail.declarantNom ?? '—')
                }}
              </div>
            </div>
          </div>

          <div>
            <span class="section-titre">Historique</span>
            <q-list dense>
              <q-item>
                <q-item-section avatar><q-icon name="radio_button_unchecked" size="18px" /></q-item-section>
                <q-item-section>
                  <q-item-label class="pochoir">Ouvert</q-item-label>
                  <q-item-label caption>{{ dateHeureLisible(ticketDetail.createdAt) }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="ticketDetail.traiteLe">
                <q-item-section avatar>
                  <q-icon name="handyman" size="18px" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="pochoir">
                    {{ ticketDetail.statut === 'EN_COURS' ? 'Prise en charge' : 'Résolu' }}
                  </q-item-label>
                  <q-item-label caption>
                    {{ dateHeureLisible(ticketDetail.traiteLe) }} · {{ nomCourt(ticketDetail.traitePar) }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="ticketDetail.clicheLe">
                <q-item-section avatar><q-icon name="archive" size="18px" /></q-item-section>
                <q-item-section>
                  <q-item-label class="pochoir">Clôturé</q-item-label>
                  <q-item-label caption>{{ dateHeureLisible(ticketDetail.clicheLe) }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <TicketDialog
      v-model="declarerOuvert"
      :equipement="equipementScanne"
      :equipements="equipements"
      @declare="onDeclare"
    />
    <EquipementDialog v-model="equipementDialogOuvert" :equipement="equipementEdite" @enregistre="rechargerEquipements" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRoute } from 'vue-router';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import TicketDialog from '../components/TicketDialog.vue';
import EquipementDialog from '../components/EquipementDialog.vue';
import {
  LIBELLE_CATEGORIE_INCIDENT,
  LIBELLE_PRIORITE_TICKET,
  LIBELLE_STATUT_TICKET,
  dateHeureLisible,
} from '../utils/libelles';
import type { CategorieIncident, EquipementCampus, StatutTicket, TicketSupport } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();

const dsi = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));

const onglet = ref('mes-tickets');
const mesTickets = ref<TicketSupport[]>([]);
const tickets = ref<TicketSupport[]>([]);
const equipements = ref<EquipementCampus[]>([]);
const stats = ref<Record<string, number> | null>(null);

const chargementMes = ref(false);
const chargementGestion = ref(false);
const chargementEquipements = ref(false);

const declarerOuvert = ref(false);
const equipementScanne = ref<EquipementCampus | null>(null);
const ticketDetail = ref<TicketSupport | null>(null);
const equipementDialogOuvert = ref(false);
const equipementEdite = ref<EquipementCampus | null>(null);

const filtres = ref({
  statut: null as string | null,
  categorie: null as string | null,
  priorite: null as string | null,
  equipementId: null as string | null,
  search: '',
});

const filtresEquip = ref({ search: '', actif: null as string | null });

const ICONES_CATEGORIE: Record<CategorieIncident, string> = {
  VIDEO: 'videocam',
  SON: 'volume_up',
  RESEAU: 'wifi',
  ELECTRICITE: 'bolt',
  MOBILIER: 'chair',
  INFORMATIQUE: 'computer',
  CLIMATISATION: 'ac_unit',
  AUTRE: 'build',
};

const categoriesApercu = (
  Object.keys(LIBELLE_CATEGORIE_INCIDENT) as CategorieIncident[]
)
  .slice(0, 6)
  .map((value) => ({
    value,
    label: LIBELLE_CATEGORIE_INCIDENT[value],
    icone: ICONES_CATEGORIE[value],
  }));

const optionsStatuts = (Object.keys(LIBELLE_STATUT_TICKET) as StatutTicket[]).map((v) => ({
  label: LIBELLE_STATUT_TICKET[v],
  value: v,
}));
const optionsCategories = Object.entries(LIBELLE_CATEGORIE_INCIDENT).map(([value, label]) => ({
  label,
  value,
}));
const optionsPriorites = Object.entries(LIBELLE_PRIORITE_TICKET).map(([value, label]) => ({
  label,
  value,
}));
const optionsEquipements = computed(() =>
  equipements.value
    .filter((e) => e.actif || e.id === filtres.value.equipementId)
    .map((e) => ({
      label: e.emplacement ? `${e.libelle} — ${e.emplacement}` : e.libelle,
      value: e.id,
    })),
);

const statutPlaques = [
  { cle: 'OUVERT', libelle: 'Ouverts' },
  { cle: 'EN_COURS', libelle: 'En cours' },
  { cle: 'RESOLU', libelle: 'Résolus' },
  { cle: 'CLOTURE', libelle: 'Clôturés' },
];

function libelleStatut(s: string): string {
  return LIBELLE_STATUT_TICKET[s] ?? s;
}
function libellePriorite(p: string): string {
  return LIBELLE_PRIORITE_TICKET[p] ?? p;
}
function libelleCategorie(c: string): string {
  return LIBELLE_CATEGORIE_INCIDENT[c] ?? c;
}
function nomCourt(u: { nom?: string; prenom?: string } | null | undefined): string {
  const nom = `${u?.prenom ?? ''} ${u?.nom ?? ''}`.trim();
  return nom || '—';
}

const colonnesMes: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left', sortable: true },
  {
    name: 'categorie',
    label: 'Catégorie',
    field: (r: TicketSupport) => libelleCategorie(r.categorie),
    align: 'left',
  },
  {
    name: 'equipement',
    label: 'Équipement',
    field: (r: TicketSupport) => r.equipement?.libelle ?? '—',
    align: 'left',
  },
  { name: 'description', label: 'Description', field: 'description', align: 'left' },
  { name: 'priorite', label: 'Priorité', field: 'priorite', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  {
    name: 'createdAt',
    label: 'Date',
    field: (r: TicketSupport) => dateHeureLisible(r.createdAt),
    align: 'left',
  },
];

const colonnesGestion: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left', sortable: true },
  {
    name: 'categorie',
    label: 'Catégorie',
    field: (r: TicketSupport) => libelleCategorie(r.categorie),
    align: 'left',
  },
  {
    name: 'equipement',
    label: 'Équipement',
    field: (r: TicketSupport) => r.equipement?.libelle ?? '—',
    align: 'left',
  },
  {
    name: 'declarant',
    label: 'Déclarant',
    field: (r: TicketSupport) => nomCourt(r.utilisateur ?? null) || (r.declarantNom ?? '—'),
    align: 'left',
  },
  { name: 'priorite', label: 'Priorité', field: 'priorite', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  {
    name: 'createdAt',
    label: 'Date',
    field: (r: TicketSupport) => dateHeureLisible(r.createdAt),
    align: 'left',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesEquipements: QTableColumn[] = [
  { name: 'libelle', label: 'Libellé', field: 'libelle', align: 'left', sortable: true },
  { name: 'emplacement', label: 'Emplacement', field: 'emplacement', align: 'left' },
  { name: 'codeQr', label: 'Code QR', field: 'codeQr', align: 'left' },
  { name: 'actif', label: 'État', field: 'actif', align: 'left' },
  {
    name: 'tickets',
    label: 'Tickets',
    field: (r: EquipementCampus) => r._count?.tickets ?? 0,
    align: 'left',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function onDeclare() {
  void chargerMes();
  if (dsi.value) {
    void chargerGestion();
    void chargerStats();
  }
}

async function chargerMes() {
  chargementMes.value = true;
  try {
    const { data } = await api.get('/tickets', { params: { all: '1' } });
    mesTickets.value = data.data;
  } finally {
    chargementMes.value = false;
  }
}

async function chargerGestion() {
  if (!dsi.value) return;
  chargementGestion.value = true;
  try {
    const { data } = await api.get('/tickets', {
      params: {
        all: '1',
        statut: filtres.value.statut || undefined,
        categorie: filtres.value.categorie || undefined,
        priorite: filtres.value.priorite || undefined,
        equipementId: filtres.value.equipementId || undefined,
        search: filtres.value.search.trim() || undefined,
      },
    });
    tickets.value = data.data;
  } finally {
    chargementGestion.value = false;
  }
}

async function chargerStats() {
  if (!dsi.value) return;
  const { data } = await api.get('/tickets/stats');
  stats.value = data;
}

async function chargerEquipements() {
  chargementEquipements.value = true;
  try {
    const { data } = await api.get('/equipements', {
      params: {
        all: '1',
        search: filtresEquip.value.search.trim() || undefined,
        actif: filtresEquip.value.actif || undefined,
      },
    });
    equipements.value = data.data;
  } finally {
    chargementEquipements.value = false;
  }
}

function rechargerEquipements() {
  void chargerEquipements();
}

async function changerStatut(t: TicketSupport, statut: StatutTicket) {
  try {
    await api.post(`/tickets/${t.id}/statut`, { statut });
    $q.notify({ type: 'positive', message: `Ticket ${t.numero} : ${libelleStatut(statut).toLowerCase()}` });
    await Promise.all([chargerMes(), chargerGestion(), chargerStats()]);
  } catch {
    /* le boot axios affiche déjà le motif */
  }
}

function copier(texte: string) {
  void navigator.clipboard?.writeText(texte);
  $q.notify({ type: 'info', message: 'Code copié' });
}

function imprimerQr(e: EquipementCampus) {
  window.open(`${API_URL}/equipements/${e.id}/imprimer-qr?token=${auth.token}`, '_blank');
}

function ouvrirEquipement(e: EquipementCampus | null) {
  equipementEdite.value = e;
  equipementDialogOuvert.value = true;
}

function supprimerEquipement(e: EquipementCampus) {
  $q.dialog({
    title: 'Supprimer l’équipement',
    message: `${e.libelle} sera retiré du parc. Les tickets déjà déclarés restent dans le registre (ils perdent le rattachement). Continuer ?`,
    cancel: true,
  }).onOk(async () => {
    await api.delete(`/equipements/${e.id}`);
    $q.notify({ type: 'positive', message: 'Équipement supprimé' });
    await chargerEquipements();
  });
}

/** Arrivée depuis le QR imprimé : ?equipement=UP-IT-… (ou ?code=). */
async function resoudreScan() {
  const brut = String(route.query.equipement ?? route.query.code ?? '').trim();
  if (!brut) return;
  try {
    const { data } = await api.get(`/equipements/par-code/${encodeURIComponent(brut)}`);
    equipementScanne.value = data;
    declarerOuvert.value = true;
    $q.notify({ type: 'info', message: `Équipement reconnu : ${data.libelle}` });
  } catch {
    /* code inconnu ou équipement désactivé : la page reste utilisable */
  }
}

watch(filtres, () => chargerGestion(), { deep: true });
watch(filtresEquip, () => chargerEquipements(), { deep: true });

onMounted(() => {
  void chargerMes();
  void chargerEquipements();
  if (dsi.value) {
    void chargerGestion();
    void chargerStats();
  }
  void resoudreScan();
});
</script>

<style scoped lang="scss">
$encre: #10251E;
$chaux-claire: #F2F3EE;
$blanc-craie: #FAFAF7;
$vert: #0F7A45;
$jaune-fonce: #C98A00;
$rouge: #C4122E;

.tuile-cat {
  border: 2px solid rgba(16, 37, 30, 0.34);
  padding: 10px 6px;
  min-height: 68px;
  background: var(--up-craie);
  color: var(--up-encre);
  font-size: 11px;
  letter-spacing: 0.03em;
  line-height: 1.25;
}

.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 700;
}

.ticket-champ {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: #fff;
  border-radius: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);

  &.ticket-champ--OUVERT { background: $jaune-fonce; }
  &.ticket-champ--EN_COURS { background: $encre; }
  &.ticket-champ--RESOLU { background: $vert; }
  &.ticket-champ--CLOTURE { background: #6b7280; }

  &.prio-champ--BASSE {
    background: $chaux-claire;
    color: $encre;
    border: 2px solid rgba(16, 37, 30, 0.45);
    box-shadow: none;
  }
  &.prio-champ--NORMALE { background: #EFB700; color: $encre; }
  &.prio-champ--HAUTE { background: $rouge; }
}
</style>