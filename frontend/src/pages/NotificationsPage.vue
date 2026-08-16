<template>
  <q-page class="notifications">
    <header class="notifications__entete">
      <div>
        <h1 class="page-titre">Notifications SMS</h1>
        <p class="page-sous-titre">
          Diffusion d'avis et de résultats aux étudiants, et historique
          des envois consignés
        </p>
      </div>
      <q-chip v-if="stats" square color="warning" text-color="dark" icon="sms">
        En file : {{ stats.EN_ATTENTE }}
        <q-tooltip>Envoyées {{ stats.ENVOYEE }} · Échouées {{ stats.ECHOUE }}</q-tooltip>
      </q-chip>
    </header>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="diffusion" icon="campaign" label="Diffusion" no-caps />
      <q-tab name="historique" icon="history" label="Historique" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- DIFFUSION                                                         -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'diffusion'" name="diffusion" class="q-pa-none q-mt-md">
      <div class="notifications__diffusion">
        <!-- Diffusion manuelle -->
        <section class="plaque notif-bloc">
          <h2 class="pochoir section-titre">Avis général</h2>

          <q-select
            v-model="motif"
            :options="motifs"
            outlined
            dense
            emit-value
            map-options
            label="Motif"
          />

          <p class="pochoir notif-bloc__titre">Destinataires</p>
          <q-option-group
            v-model="destination"
            :options="optionsDestinataires"
            dense
            class="q-mb-sm"
          />

          <q-input
            v-if="destination === 'numeros'"
            v-model="numerosSaisis"
            type="textarea"
            outlined
            dense
            label="Numéros, un par ligne (ou séparés par une virgule)"
            :rules="[
              (v) =>
                v
                  ? v
                      .split(/[\s,;]+/)
                      .filter(Boolean)
                      .every((n: string) => /^\+?[\d\s().-]{6,20}$/.test(n))
                    || 'Certains numéros semblent invalides'
                  : true,
            ]"
          />

          <q-input
            v-model="message"
            type="textarea"
            outlined
            label="Message"
            maxlength="160"
            counter
            :rules="[(v) => !!v || 'Le message est requis']"
          >
            <template #hint>Un SMS tient en 160 caractères</template>
          </q-input>

          <q-banner dense class="note--info">
            <template #avatar><q-icon name="info" /></template>
            <div v-if="destination === 'tous'">
              Nombre de destinataires estimé : <strong>{{ nbInscrits }}</strong>
            </div>
            <div v-else-if="destination === 'numeros'">
              {{ numerosComptes }} numéro(s) saisi(s)
            </div>
            <div v-else>
              Diffusion des résultats de la délibération sélectionnée
            </div>
          </q-banner>

          <div class="row q-gutter-sm">
            <q-btn
              outline
              color="primary"
              no-caps
              icon="science"
              label="Tester l'envoi"
              :loading="testEnvoi"
              @click="testerEnvoi"
            />
            <q-btn
              unelevated
              color="primary"
              no-caps
              icon="send"
              label="Envoyer"
              :loading="envoi"
              @click="envoyer"
            />
          </div>
        </section>

        <!-- Résultats de délibération -->
        <section class="plaque notif-bloc">
          <h2 class="section-titre">Résultats de délibération</h2>
          <p class="notif-bloc__aide">
            Chaque étudiant ADMIS ou AJOURNÉ inscrit dans la délibération
            reçoit sa moyenne et sa décision par SMS, sur le numéro de sa
            fiche. Seules les délibérations validées par le jury peuvent
            être diffusées.
          </p>
          <q-select
            v-model="deliberationId"
            :options="optionsDeliberations"
            outlined
            dense
            emit-value
            map-options
            label="Délibération validée"
            :loading="chargementDeliberations"
          />
          <q-btn
            unelevated
            color="secondary"
            no-caps
            icon="fact_check"
            label="Diffuser les résultats"
            :loading="envoiResultats"
            :disable="!deliberationId"
            @click="diffuserResultats"
          />
        </section>
      </div>

      <!-- Résumé du dernier envoi -->
      <div v-if="resume" class="plaque notif-resume" :class="{ 'notif-resume--partiel': resume.echouees }">
        <div class="notif-resume__cellule">
          <p class="pochoir">Destinataires</p>
          <p class="lettrage chiffres">{{ resume.total }}</p>
        </div>
        <div class="notif-resume__cellule text-positive">
          <p class="pochoir">Envoyés</p>
          <p class="lettrage chiffres">{{ resume.envoyees }}</p>
        </div>
        <div class="notif-resume__cellule" :class="resume.echouees ? 'text-negative' : 'text-positive'">
          <p class="pochoir">Échoués</p>
          <p class="lettrage chiffres">{{ resume.echouees }}</p>
        </div>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- HISTORIQUE                                                        -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'historique'" name="historique" class="q-pa-none q-mt-md">
      <filter-bar
        v-model="filtresHistorique"
        placeholder="Rechercher (téléphone, nom, message…)"
        :recherche="true"
        @reinitialiser="filtresHistorique = { recherche: '' }"
      >
        <template #avances>
          <q-select
            v-model="filtresHistorique.statut"
            :options="optionsStatuts"
            dense
            outlined
            clearable
            emit-value
            map-options
            label="Statut"
          />
          <q-input
            v-model="filtresHistorique.dateDebut"
            type="date"
            dense
            outlined
            label="Du"
          />
          <q-input
            v-model="filtresHistorique.dateFin"
            type="date"
            dense
            outlined
            label="Au"
          />
        </template>
      </filter-bar>

      <pagination-bar
        :page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :show-all="false"
        @update:page="pagination.page = $event; chargerHistorique()"
        @update:page-size="pagination.pageSize = $event; pagination.page = 1; chargerHistorique()"
        @tous="chargerToutHistorique"
      />

      <!-- Graphique de répartition -->
      <q-card v-if="chartConfig" flat bordered class="carte q-mb-md">
        <q-card-section>
          <div class="text-subtitle1 text-weight-medium q-mb-sm">
            Répartition sur 30 jours
          </div>
          <chart-canvas :config="chartConfig" :hauteur="220" />
        </q-card-section>
      </q-card>

      <q-table
        flat
        bordered
        class="carte"
        :rows="lignes"
        :columns="colonnes"
        row-key="id"
        :loading="chargement"
        :rows-per-page-options="[0]"
        hide-bottom
      >
        <template #body-cell-statut="p">
          <q-td :props="p">
            <q-chip
              :color="couleurStatut[p.row.statut] ?? 'grey-8'"
              text-color="white"
              square
              size="sm"
            >
              {{ LIBELLE_STATUT_NOTIFICATION[p.row.statut] }}
            </q-chip>
            <q-tooltip v-if="p.row.erreur" class="notif-erreur">
              {{ p.row.erreur }}
            </q-tooltip>
          </q-td>
        </template>

        <template #body-cell-message="p">
          <q-td :props="p">
            <q-btn flat dense no-caps align="left" class="notifications__message">
              <span class="notifications__message-texte">{{ p.row.message }}</span>
              <q-tooltip :offset="[0, 8]" class="notifications__message-complet">{{ p.row.message }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>

        <template #body-cell-destinataire="p">
          <q-td :props="p">
            <div class="notifications__qui">
              <span v-if="p.row.destinataireNom">{{ p.row.destinataireNom }}</span>
              <span class="pochoir pochoir--brut chiffres">{{ p.row.telephone }}</span>
              <span v-if="p.row.etudiant?.matricule" class="pochoir pochoir--brut">
                {{ p.row.etudiant.matricule }}
              </span>
            </div>
          </q-td>
        </template>

        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              v-if="p.row.statut === 'ECHOUE'"
              flat dense round color="primary" icon="refresh"
              @click="renvoyer(p.row)"
            >
              <q-tooltip>Renvoyer</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-tab-panel>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import type { ChartConfiguration } from 'chart.js';
import { api } from '../boot/axios';
import {
  LIBELLE_SESSION_DELIBERATION,
  LIBELLE_STATUT_NOTIFICATION,
  dateHeureLisible,
} from '../utils/libelles';
import type { Notification, StatutNotification } from '../types';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ChartCanvas from '../components/ChartCanvas.vue';

const $q = useQuasar();
const auth = useAuthStore();

const onglet = ref('diffusion');

// ----------------------------------------------------------------- diffusion
const motifs = [
  { label: 'Avis', value: 'AVIS' },
  { label: 'Résultats', value: 'RESULTATS' },
  { label: 'Inscription', value: 'INSCRIPTION' },
  { label: 'Paiement', value: 'PAIEMENT' },
  { label: 'Convocation', value: 'CONVOCATION' },
  { label: 'Autre', value: 'AUTRE' },
];

const optionsDestinataires = [
  { label: 'Tous les étudiants inscrits (année en cours)', value: 'tous' },
  { label: 'Numéros saisis manuellement', value: 'numeros' },
  { label: 'Résultats de délibération', value: 'resultatsDeliberation' },
];

const motif = ref('AVIS');
const destination = ref<'tous' | 'numeros' | 'resultatsDeliberation'>('tous');
const numerosSaisis = ref('');
const message = ref('');
const envoi = ref(false);
const testEnvoi = ref(false);
const resume = ref<{ total: number; envoyees: number; echouees: number } | null>(null);

const nbInscrits = ref(0);

const numerosComptes = computed(() =>
  numerosSaisis.value
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean).length,
);

function decouperNumeros(texte: string): string[] {
  return texte
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

async function chargerNbInscrits() {
  try {
    const { data } = await api.get('/notifications/dest-inaires/estimes', {
      params: { mode: 'tousInscrits' },
    });
    nbInscrits.value = data?.total ?? 0;
  } catch {
    nbInscrits.value = 0;
  }
}

async function envoyer() {
  envoi.value = true;
  try {
    const numeros = destination.value === 'numeros' ? decouperNumeros(numerosSaisis.value) : [];
    if (destination.value === 'numeros' && !numeros.length) {
      $q.notify({ type: 'warning', message: 'Saisissez au moins un numéro.' });
      return;
    }
    const { data } = await api.post('/notifications', {
      message: message.value,
      motif: motif.value,
      tousInscrits: destination.value === 'tous',
      destinatairesTelephones: destination.value === 'numeros' ? numeros : undefined,
      mode: destination.value === 'tous' ? 'tousInscrits' : 'manuel',
    });
    resume.value = { total: data.total, envoyees: data.envoyees, echouees: data.echouees };
    $q.notify({
      type: data.echouees ? 'warning' : 'positive',
      message: `${data.envoyees} SMS envoyé(s)${data.echouees ? `, ${data.echouees} échoué(s)` : ''}.`,
    });
    await chargerHistorique();
    await chargerStats();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e.response?.data?.message ?? 'Envoi impossible.' });
  } finally {
    envoi.value = false;
  }
}

async function testerEnvoi() {
  if (!message.value.trim()) {
    $q.notify({ type: 'warning', message: 'Saisissez un message avant de tester.' });
    return;
  }
  testEnvoi.value = true;
  try {
    const { data } = await api.post('/notifications', {
      message: message.value,
      motif: motif.value,
      mode: 'manuel',
      destinatairesTelephones: ['+224000000001', '+224000000002'],
      simulation: true,
    });
    resume.value = { total: data.total, envoyees: data.envoyees, echouees: data.echouees };
    $q.notify({
      type: 'info',
      message: `Test envoyé à ${data.total} numéro(s) : ${data.envoyees} reçu(s).`,
    });
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e.response?.data?.message ?? 'Test impossible.' });
  } finally {
    testEnvoi.value = false;
  }
}

// ------------------------------------------------- délibération (résultats)
const deliberationId = ref<string | null>(null);
const deliberations = ref<{ id: string; session: string; annee: string; promotion: string; lignes: number }[]>([]);
const chargementDeliberations = ref(false);
const envoiResultats = ref(false);

const optionsDeliberations = computed(() =>
  deliberations.value.map((d) => ({
    label: `${d.annee} · ${d.promotion} · ${LIBELLE_SESSION_DELIBERATION[d.session as 'NORMALE' | 'RATTRAPAGE'] ?? d.session} (${d.lignes} lignes)`,
    value: d.id,
  })),
);

async function chargerDeliberations() {
  chargementDeliberations.value = true;
  try {
    const { data } = await api.get('/notifications/deliberations');
    deliberations.value = data;
  } catch {
    deliberations.value = [];
  } finally {
    chargementDeliberations.value = false;
  }
}

async function diffuserResultats() {
  if (!deliberationId.value) return;
  envoiResultats.value = true;
  try {
    const { data } = await api.post('/notifications/resultats-deliberation', {
      deliberationId: deliberationId.value,
    });
    resume.value = { total: data.total, envoyees: data.envoyees, echouees: data.echouees };
    $q.notify({
      type: data.echouees ? 'warning' : 'positive',
      message: `Résultats diffusés : ${data.envoyees} envoyé(s), ${data.echouees} échoué(s).`,
    });
    await chargerHistorique();
    await chargerStats();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e.response?.data?.message ?? 'Diffusion impossible.' });
  } finally {
    envoiResultats.value = false;
  }
}

// ------------------------------------------------------------- historique
const chargement = ref(false);
const lignes = ref<Notification[]>([]);
const pagination = ref({ page: 1, pageSize: 25, total: 0 });
const filtresHistorique = ref<Record<string, any>>({ recherche: '' });

const optionsStatuts = Object.entries(LIBELLE_STATUT_NOTIFICATION).map(([value, label]) => ({
  value: value as StatutNotification,
  label,
}));

const couleurStatut: Record<string, string> = {
  EN_ATTENTE: 'warning',
  ENVOYEE: 'positive',
  ECHOUE: 'negative',
};

const colonnes: QTableColumn[] = [
  {
    name: 'date',
    label: 'Date',
    field: (r: Notification) => r.createdAt,
    format: (v: string) => dateHeureLisible(v),
    align: 'left',
    sortable: true,
  },
  {
    name: 'destinataire',
    label: 'Destinataire',
    field: (r: Notification) => `${r.destinataireNom ?? ''} ${r.telephone}`,
    align: 'left',
  },
  { name: 'motif', label: 'Motif', field: (r: Notification) => r.motif ?? '—', align: 'left' },
  { name: 'statut', label: 'Statut', field: (r: Notification) => r.statut, align: 'left' },
  {
    name: 'message',
    label: 'Message',
    field: (r: Notification) => r.message,
    align: 'left',
  },
  {
    name: 'envoyePar',
    label: 'Émis par',
    field: (r: Notification) => r.envoyePar?.prenom ?? '',
    align: 'left',
  },
  {
    name: 'actions',
    label: '',
    field: 'id',
    align: 'right',
  },
];

async function chargerHistorique() {
  chargement.value = true;
  try {
    const f = filtresHistorique.value;
    const { data } = await api.get('/notifications', {
      params: {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        statut: f.statut ?? undefined,
        search: (f.recherche ?? '').toString().trim() || undefined,
        dateDebut: f.dateDebut || undefined,
        dateFin: f.dateFin || undefined,
      },
    });
    lignes.value = data.data;
    pagination.value.total = data.total;
  } finally {
    chargement.value = false;
  }
}

async function chargerToutHistorique() {
  pagination.value.page = 1;
  pagination.value.pageSize = Math.max(pagination.value.total, 200) || 200;
  await chargerHistorique();
}

watch(filtresHistorique, () => {
  pagination.value.page = 1;
  void chargerHistorique();
}, { deep: true });

async function renvoyer(n: Notification) {
  try {
    await api.post(`/notifications/${n.id}/renvoyer`);
    $q.notify({ type: 'positive', message: 'Renvoi demandé' });
    await chargerHistorique();
  } catch {
    /* le boot axios affiche le motif */
  }
}

// -------------------------------------------------------------------- stats
const stats = ref<{ EN_ATTENTE: number; ENVOYEE: number; ECHOUE: number } | null>(null);

async function chargerStats() {
  try {
    const { data } = await api.get('/notifications/stats');
    stats.value = data;
  } catch {
    stats.value = null;
  }
}

const repartition30j = ref<{ date: string; EN_ATTENTE: number; ENVOYEE: number; ECHOUE: number }[]>([]);

async function chargerRepartition() {
  try {
    const { data } = await api.get('/notifications/stats/repartition', {
      params: { jours: 30 },
    });
    repartition30j.value = Array.isArray(data) ? data : [];
  } catch {
    repartition30j.value = [];
  }
}

const chartConfig = computed<ChartConfiguration | null>(() => {
  if (!repartition30j.value.length) return null;
  return {
    type: 'bar',
    data: {
      labels: repartition30j.value.map((r) => r.date.slice(5)),
      datasets: [
        { label: 'En attente', data: repartition30j.value.map((r) => r.EN_ATTENTE), backgroundColor: '#EFB700' },
        { label: 'Envoyés', data: repartition30j.value.map((r) => r.ENVOYEE), backgroundColor: '#0F7A45' },
        { label: 'Échoués', data: repartition30j.value.map((r) => r.ECHOUE), backgroundColor: '#C4122E' },
      ],
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
    },
  };
});

watch(onglet, (v) => {
  if (v === 'historique') {
    void chargerRepartition();
  }
});

onMounted(() => {
  void chargerHistorique();
  void chargerStats();
  void chargerNbInscrits();
  void chargerRepartition();
  if (auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE'])) void chargerDeliberations();
});
</script>

<style scoped lang="scss">
.notifications {
  padding: var(--up-4) var(--up-3) var(--up-6);
}

.notifications__entete {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
  margin-bottom: var(--up-3);
}

.notifications__diffusion {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--up-4);
  align-items: start;
}

.notif-bloc {
  background: var(--up-plaque);
  border: var(--up-filet);
  padding: var(--up-4);
  display: flex;
  flex-direction: column;
  gap: var(--up-3);

  .section-titre {
    margin: 0;
  }
}

.notif-bloc__titre {
  margin: var(--up-2) 0 0;
  color: var(--up-encre-douce);
}

.notif-bloc__aide {
  margin: 0;
  font-size: 0.88rem;
  color: var(--up-encre-douce);
}

.notif-resume {
  margin-top: var(--up-4);
  display: grid;
  grid-template-columns: repeat(3, 1fr);

  & > * + * { border-left: var(--up-filet); }

  &--partiel { border-color: $rouge; }
}

.notif-resume__cellule {
  padding: var(--up-3);
  text-align: center;

  p { margin: 0; }
  .lettrage { font-size: 1.8rem; }
}

.notifications__qui {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notifications__message {
  max-width: 340px;
  font-size: 0.86rem;
  text-transform: none;
  letter-spacing: 0;
}

.notifications__message-texte {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.notifications__message-complet {
  max-width: 420px;
  white-space: pre-wrap;
  font-size: 12px;
  text-transform: none;
  letter-spacing: 0;
}
</style>
