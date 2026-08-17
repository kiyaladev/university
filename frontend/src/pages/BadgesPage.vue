<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import BadgeDialog from '../components/BadgeDialog.vue';
import type { BadgeAcces, TypeBadge } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const badges = ref<BadgeAcces[]>([]);
const chargement = ref(false);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '', type: null, statut: null });

const modeVue = ref<'tableau' | 'cartes'>('tableau');

const peutEditer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));

const OPTIONS_TYPE: Array<{ value: TypeBadge; label: string }> = [
  { value: 'VISITEUR', label: 'Visiteur' },
  { value: 'INTERVENANT', label: 'Intervenant' },
  { value: 'TECHNICIEN', label: 'Technicien' },
  { value: 'VIP', label: 'VIP' },
];
const OPTIONS_STATUT: Array<{ value: string; label: string }> = [
  { value: 'ACTIF', label: 'Actif' },
  { value: 'EXPIRE', label: 'Expiré' },
  { value: 'ANNULE', label: 'Annulé' },
];

const LIBELLE_STATUT: Record<string, string> = {
  ACTIF: 'Actif',
  EXPIRE: 'Expiré',
  ANNULE: 'Annulé',
};
const LIBELLE_TYPE: Record<string, string> = Object.fromEntries(OPTIONS_TYPE.map((o) => [o.value, o.label]));
const CLASSE_STATUT: Record<string, string> = {
  ACTIF: 'badge--ok',
  EXPIRE: 'badge--attention',
  ANNULE: 'badge--ko',
};

const colonnes: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left' },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'identite', label: 'Identité', field: 'nom', align: 'left' },
  { name: 'organisation', label: 'Organisation', field: 'organisation', align: 'left' },
  { name: 'validite', label: 'Validité', field: 'dateValidite', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const dialogEdition = ref(false);
const badgeEnEdition = ref<BadgeAcces | null>(null);

const dialogAnnulation = ref(false);
const badgeAnnulation = ref<BadgeAcces | null>(null);
const motifAnnulation = ref('');

const dialogRallonge = ref(false);
const badgeRallonge = ref<BadgeAcces | null>(null);
const dateRallonge = ref<string | null>(null);

function ouvrirEdition(b?: BadgeAcces) {
  badgeEnEdition.value = b ?? null;
  dialogEdition.value = true;
}

function imprimer(b: BadgeAcces) {
  window.open(`${API_URL}/badges/${b.id}/imprimer?token=${auth.token}`, '_blank');
}

function ouvrirAnnulation(b: BadgeAcces) {
  badgeAnnulation.value = b;
  motifAnnulation.value = '';
  dialogAnnulation.value = true;
}

async function confirmerAnnulation() {
  if (!badgeAnnulation.value || !motifAnnulation.value) return;
  try {
    await api.post(`/badges/${badgeAnnulation.value.id}/annuler`, { motif: motifAnnulation.value });
    $q.notify({ type: 'warning', message: 'Badge annulé.' });
    dialogAnnulation.value = false;
    await charger();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Annulation impossible.' });
  }
}

function ouvrirRallonge(b: BadgeAcces) {
  badgeRallonge.value = b;
  dateRallonge.value = '';
  dialogRallonge.value = true;
}

async function confirmerRallonge() {
  if (!badgeRallonge.value || !dateRallonge.value) return;
  try {
    await api.post(`/badges/${badgeRallonge.value.id}/rallonger`, { dateValidite: dateRallonge.value });
    $q.notify({ type: 'positive', message: 'Validité prolongée.' });
    dialogRallonge.value = false;
    await charger();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Prolongation impossible.' });
  }
}

async function charger() {
  chargement.value = true;
  try {
    const params: Record<string, unknown> = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    };
    if (filtres.value.recherche) params.search = filtres.value.recherche;
    if (filtres.value.type) params.type = filtres.value.type;
    if (filtres.value.statut) params.statut = filtres.value.statut;
    const { data } = await api.get('/badges', { params });
    badges.value = data.data;
    pagination.value.total = data.total;
  } finally {
    chargement.value = false;
  }
}

function recharger() {
  pagination.value.page = 1;
  void charger();
}

function dateFr(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR');
}

onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Badges d'accès</div>
        <div class="page-sous-titre">
          Visiteurs, intervenants, techniciens, personnalités — badge avec QR
          vérifiable en ligne et validité paramétrable.
        </div>
      </div>
      <div class="col-auto">
        <view-toggle
          cle="badges"
          :modes="['tableau', 'cartes']"
          :defaut="modeVue"
          @update:mode="(v: string) => (modeVue = v as 'tableau' | 'cartes')"
        />
        <q-btn
          v-if="peutEditer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Émettre un badge"
          @click="ouvrirEdition()"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      placeholder="Nom, organisation, numéro…"
      @update:model-value="recharger"
    >
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="OPTIONS_TYPE"
          emit-value
          map-options
          label="Type"
          outlined
          dense
          clearable
          @update:model-value="recharger"
        />
        <q-select
          v-model="filtres.statut"
          :options="OPTIONS_STATUT"
          emit-value
          map-options
          label="Statut"
          outlined
          dense
          clearable
          @update:model-value="recharger"
        />
      </template>
    </filter-bar>

    <pagination-bar
      :page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :show-all="false"
      @update:page="pagination.page = $event; charger()"
      @update:page-size="pagination.pageSize = $event; pagination.page = 1; charger()"
    />

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="badges"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
    >
      <template #body-cell-type="p">
        <q-td :props="p">{{ LIBELLE_TYPE[p.row.type] ?? p.row.type }}</q-td>
      </template>
      <template #body-cell-identite="p">
        <q-td :props="p">
          <strong>{{ p.row.prenom }} {{ p.row.nom }}</strong>
          <div v-if="p.row.fonction" class="text-caption text-grey-7">{{ p.row.fonction }}</div>
        </q-td>
      </template>
      <template #body-cell-organisation="p">
        <q-td :props="p">{{ p.row.organisation ?? '—' }}</q-td>
      </template>
      <template #body-cell-validite="p">
        <q-td :props="p">
          {{ dateFr(p.row.dateDelivrance) }} → {{ dateFr(p.row.dateValidite) }}
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ champ-statut" :class="CLASSE_STATUT[p.row.statut]">
            <span class="pochoir">{{ LIBELLE_STATUT[p.row.statut] }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat round dense icon="print" @click="imprimer(p.row)" />
          <q-btn
            v-if="peutEditer"
            flat
            round
            dense
            icon="edit"
            @click="ouvrirEdition(p.row)"
          />
          <q-btn
            v-if="peutEditer && p.row.statut !== 'ANNULE'"
            flat
            round
            dense
            icon="schedule"
            @click="ouvrirRallonge(p.row)"
          />
          <q-btn
            v-if="peutEditer && p.row.statut !== 'ANNULE'"
            flat
            round
            dense
            icon="block"
            color="negative"
            @click="ouvrirAnnulation(p.row)"
          />
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="b in badges" :key="b.id" class="col-12 col-sm-6 col-md-4">
        <q-card class="badge-carte">
          <q-card-section class="row items-center q-gutter-sm">
            <q-avatar size="56px" color="grey-3" text-color="primary">
              <img v-if="b.photoUrl" :src="b.photoUrl" />
              <q-icon v-else name="badge" size="32px" />
            </q-avatar>
            <div class="col">
              <div class="text-weight-bold">{{ b.prenom }} {{ b.nom }}</div>
              <div class="text-caption text-grey-7">{{ b.organisation ?? '—' }}</div>
            </div>
            <span class="champ champ-statut" :class="CLASSE_STATUT[b.statut]">
              <span class="pochoir">{{ LIBELLE_STATUT[b.statut] }}</span>
            </span>
          </q-card-section>
          <q-separator />
          <q-card-section class="text-caption">
            <q-chip dense :color="b.type === 'VIP' ? 'amber-7' : 'primary'" text-color="white">
              {{ LIBELLE_TYPE[b.type] ?? b.type }}
            </q-chip>
            <div class="q-mt-sm">
              Délivré le {{ dateFr(b.dateDelivrance) }}<br>
              Valable jusqu'au <strong>{{ dateFr(b.dateValidite) }}</strong>
            </div>
            <div class="q-mt-sm"><code>{{ b.numero }}</code></div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat dense icon="print" label="Imprimer" no-caps @click="imprimer(b)" />
            <q-btn
              v-if="peutEditer"
              flat
              dense
              icon="edit"
              label="Éditer"
              no-caps
              @click="ouvrirEdition(b)"
            />
            <q-btn
              v-if="peutEditer && b.statut !== 'ANNULE'"
              flat
              dense
              icon="schedule"
              label="Rallonger"
              no-caps
              @click="ouvrirRallonge(b)"
            />
            <q-btn
              v-if="peutEditer && b.statut !== 'ANNULE'"
              flat
              dense
              icon="block"
              color="negative"
              label="Annuler"
              no-caps
              @click="ouvrirAnnulation(b)"
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <badge-dialog v-model="dialogEdition" :badge="badgeEnEdition" @enregistre="charger" />

    <q-dialog v-model="dialogAnnulation">
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="text-h6">Annuler le badge</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogAnnulation = false" />
        </q-card-section>
        <q-card-section>
          <q-banner class="bg-orange-1 text-orange-10 q-mb-md">
            Un badge annulé ne peut plus être réactivé : créez-en un nouveau si besoin.
          </q-banner>
          <q-input
            v-model="motifAnnulation"
            label="Motif d'annulation"
            outlined
            dense
            type="textarea"
            autogrow
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" no-caps @click="dialogAnnulation = false" />
          <q-btn unelevated color="negative" no-caps label="Confirmer" :disable="!motifAnnulation" @click="confirmerAnnulation" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="dialogRallonge">
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="text-h6">Prolonger la validité</div>
          <q-space />
          <q-btn flat round dense icon="close" @click="dialogRallonge = false" />
        </q-card-section>
        <q-card-section>
          <q-banner class="bg-info text-white q-mb-md">
            Le badge repassera en statut ACTIF et conservera son numéro et son QR.
          </q-banner>
          <q-input
            v-model="dateRallonge"
            type="date"
            label="Nouvelle date de validité"
            outlined
            dense
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" no-caps @click="dialogRallonge = false" />
          <q-btn unelevated color="primary" no-caps label="Prolonger" :disable="!dateRallonge" @click="confirmerRallonge" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.badge-carte {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  height: 100%;
}
.badge--ok { background: #e3f5e9; color: #17683a; }
.badge--ko { background: #fdeaea; color: #a52020; }
.badge--attention { background: #fff4e0; color: #8a5300; }
</style>