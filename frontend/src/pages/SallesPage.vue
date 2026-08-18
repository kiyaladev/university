<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Salles &amp; QR</div>
        <div class="page-sous-titre">
          Chaque salle porte un QR affiché à l’entrée : le contrôleur le scanne pour
          attester sa présence sur place
        </div>
      </div>
      <div class="col-auto q-gutter-sm">
        <q-btn
          outline
          color="primary"
          no-caps
          icon="print"
          label="Imprimer les affiches"
          @click="imprimerQr()"
        >
          <q-tooltip>Une affiche par salle, à coller à l’entrée</q-tooltip>
        </q-btn>
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle salle"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (code, nom, bâtiment)…"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.batiment"
          :options="optionsBatiments"
          outlined
          dense
          clearable
          label="Bâtiment"
        />
        <q-select
          v-model="filtres.etat"
          :options="optionsEtat"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="État"
        />
        <q-select
          v-model="filtres.repere"
          :options="optionsRepere"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Repère GPS"
        />
      </template>
      <template #actions>
        <view-toggle
          cle="salles"
          :modes="['cartes', 'tableau']"
          defaut="cartes"
          @update:mode="(m) => (modeVue = m as 'tableau' | 'cartes')"
        />
      </template>
    </filter-bar>

    <q-linear-progress v-if="chargement" indeterminate color="primary" class="q-mb-sm" />

    <!-- Vue cartes : chaque plaque montre le QR tel qu'il sera affiché -->
    <div v-if="modeVue === 'cartes'" class="row q-col-gutter-md">
      <div v-for="s in sallesAffichees" :key="s.id" class="col-12 col-sm-6 col-md-4 col-lg-3">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="row items-start">
            <div class="col">
              <div class="text-h6">{{ s.code }}</div>
              <div class="text-caption text-grey-7">{{ s.nom }}</div>
              <div class="text-caption text-grey-7">{{ s.batiment ?? '—' }}</div>
            </div>
            <q-badge :color="s.actif ? 'positive' : 'grey-7'">
              {{ s.actif ? 'active' : 'inactive' }}
            </q-badge>
          </q-card-section>

          <q-card-section class="text-center q-pt-none">
            <canvas :ref="(el) => enregistrerCanvas(el, s)" :aria-label="`QR de la salle ${s.code}`" />
            <div class="text-caption text-grey-6 ellipsis">{{ s.qrToken }}</div>
          </q-card-section>

          <q-card-section class="q-pt-none text-caption">
            <div><q-icon name="groups" size="14px" /> {{ s.capacite }} places</div>
            <div v-if="s.latitude">
              <q-icon name="my_location" size="14px" />
              {{ s.latitude.toFixed(4) }}, {{ s.longitude?.toFixed(4) }} (± {{ s.rayonMetres }} m)
            </div>
            <div v-else class="text-grey-6">
              <q-icon name="location_off" size="14px" /> Sans repère GPS
            </div>
          </q-card-section>

          <q-separator />
          <q-card-actions align="right">
            <q-btn
              flat
              dense
              round
              icon="event_note"
              aria-label="Voir les séances de la salle"
              @click="voirSeances(s)"
            >
              <q-tooltip>Ses séances</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              icon="print"
              aria-label="Imprimer l’affiche de la salle"
              @click="imprimerQr(s.id)"
            >
              <q-tooltip>Affiche de cette salle</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutGerer"
              flat
              dense
              round
              icon="autorenew"
              aria-label="Régénérer le QR de la salle"
              @click="regenerer(s)"
            >
              <q-tooltip>Régénérer le QR</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutGerer"
              flat
              dense
              round
              icon="edit"
              aria-label="Modifier la salle"
              @click="ouvrir(s)"
            >
              <q-tooltip>Modifier</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutSupprimer"
              flat
              dense
              round
              color="negative"
              icon="delete"
              aria-label="Supprimer la salle"
              @click="supprimer(s)"
            >
              <q-tooltip>Supprimer</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!sallesAffichees.length && !chargement" class="col-12">
        <div class="etat-vide">
          <q-icon name="meeting_room" size="34px" />
          <div class="pochoir">{{ messageVide }}</div>
          <q-btn
            v-if="peutGerer && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Créer la première salle"
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
    </div>

    <!-- Vue tableau : pour comparer capacités, bâtiments et repères -->
    <q-table
      v-else
      flat
      bordered
      class="carte"
      :rows="sallesAffichees"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="etat-vide">
          <q-icon name="meeting_room" size="34px" />
          <div class="pochoir">{{ messageVide }}</div>
          <q-btn
            v-if="peutGerer && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Créer la première salle"
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

      <template #body-cell-etat="p">
        <q-td :props="p">
          <q-badge :color="p.row.actif ? 'positive' : 'grey-7'">
            {{ p.row.actif ? 'active' : 'inactive' }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="event_note"
            aria-label="Voir les séances de la salle"
            @click="voirSeances(p.row)"
          >
            <q-tooltip>Ses séances</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            aria-label="Imprimer l’affiche de la salle"
            @click="imprimerQr(p.row.id)"
          >
            <q-tooltip>Affiche de cette salle</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="autorenew"
            aria-label="Régénérer le QR de la salle"
            @click="regenerer(p.row)"
          >
            <q-tooltip>Régénérer le QR</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="edit"
            aria-label="Modifier la salle"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutSupprimer"
            flat
            dense
            round
            color="negative"
            icon="delete"
            aria-label="Supprimer la salle"
            @click="supprimer(p.row)"
          >
            <q-tooltip>Supprimer</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <pagination-bar
      v-if="sallesFiltrees.length"
      :page="page"
      :page-size="pageSize"
      :total="sallesFiltrees.length"
      @update:page="(v) => (page = v)"
      @update:page-size="(v) => { pageSize = v; page = 1; }"
      @tous="pageSize = Math.max(sallesFiltrees.length, 1)"
    />

    <!-- Formulaire salle -->
    <q-dialog v-model="dialogOuvert">
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ salleEditee ? 'Modifier la salle' : 'Nouvelle salle' }}
        </q-card-section>
        <q-card-section>
          <span class="section-titre">Identification</span>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-5">
              <q-input
                v-model="form.code"
                outlined
                dense
                label="Code *"
                hint="ex. AMPHI-A"
                :error="erreurs.code"
                error-message="Le code est obligatoire"
              />
            </div>
            <div class="col-12 col-sm-7">
              <q-input
                v-model="form.nom"
                outlined
                dense
                label="Nom *"
                :error="erreurs.nom"
                error-message="Le nom est obligatoire"
              />
            </div>
          </div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-7">
              <q-input v-model="form.batiment" outlined dense label="Bâtiment" />
            </div>
            <div class="col-5">
              <q-input
                v-model.number="form.capacite"
                type="number"
                min="0"
                outlined
                dense
                label="Capacité"
              />
            </div>
          </div>

          <span class="section-titre">Repère GPS (facultatif)</span>
          <p class="page-sous-titre q-mb-md">
            Permet de vérifier que le contrôleur est bien sur place au moment du pointage.
          </p>
          <div class="row q-col-gutter-md">
            <div class="col-4">
              <q-input v-model.number="form.latitude" type="number" outlined dense label="Latitude" />
            </div>
            <div class="col-4">
              <q-input v-model.number="form.longitude" type="number" outlined dense label="Longitude" />
            </div>
            <div class="col-4">
              <q-input
                v-model.number="form.rayonMetres"
                type="number"
                min="10"
                outlined
                dense
                label="Rayon (m)"
                :error="erreurs.rayon"
                error-message="Minimum 10 m"
              />
            </div>
          </div>
          <q-btn
            flat
            dense
            no-caps
            icon="my_location"
            label="Utiliser ma position actuelle"
            @click="positionActuelle"
          />

          <q-toggle v-model="form.actif" label="Salle utilisable" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Annuler" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            no-caps
            label="Enregistrer"
            :loading="enregistrement"
            @click="enregistrer"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import QRCode from 'qrcode';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import type { Salle, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const salles = ref<Salle[]>([]);
const chargement = ref(false);
const modeVue = ref<'tableau' | 'cartes'>('cartes');
const dialogOuvert = ref(false);
const salleEditee = ref<Salle | null>(null);
const enregistrement = ref(false);

const page = ref(1);
const pageSize = ref(20);
const filtres = ref<Record<string, any>>({});

/** Créer/modifier/régénérer : ADMIN et SCOLARITE. Supprimer : ADMIN (cf. backend). */
const peutGerer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE']));
const peutSupprimer = computed(() => auth.estAdmin);

const form = ref({
  code: '',
  nom: '',
  batiment: '',
  capacite: 0,
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
  rayonMetres: 80,
  actif: true,
});
const erreurs = ref({ code: false, nom: false, rayon: false });

const optionsEtat = [
  { label: 'Salles utilisables', value: 'actif' },
  { label: 'Salles hors service', value: 'inactif' },
];
const optionsRepere = [
  { label: 'Avec repère GPS', value: 'avec' },
  { label: 'Sans repère GPS', value: 'sans' },
];
const optionsBatiments = computed(() =>
  [
    ...new Set(
      salles.value.map((s) => s.batiment).filter((b): b is string => !!b),
    ),
  ].sort(),
);

const sallesFiltrees = computed(() =>
  salles.value.filter((s) => {
    const f = filtres.value;
    if (f.recherche) {
      const q = String(f.recherche).toLowerCase();
      const cible = `${s.code} ${s.nom} ${s.batiment ?? ''}`.toLowerCase();
      if (!cible.includes(q)) return false;
    }
    if (f.batiment && s.batiment !== f.batiment) return false;
    if (f.etat === 'actif' && !s.actif) return false;
    if (f.etat === 'inactif' && s.actif) return false;
    if (f.repere === 'avec' && !s.latitude) return false;
    if (f.repere === 'sans' && s.latitude) return false;
    return true;
  }),
);

/** Le listing est court : on pagine côté page, sans rappeler le serveur. */
const sallesAffichees = computed(() =>
  sallesFiltrees.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
);

const filtresActifs = computed(() =>
  Boolean(filtres.value.recherche || filtres.value.batiment || filtres.value.etat || filtres.value.repere),
);
const messageVide = computed(() =>
  filtresActifs.value ? 'Aucune salle pour ces critères.' : 'Aucune salle enregistrée.',
);

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
  if (filtres.value.batiment) {
    cs.push({ label: `Bâtiment : ${filtres.value.batiment}`, value: filtres.value.batiment, icone: 'apartment' });
  }
  if (filtres.value.etat) {
    cs.push({
      label: filtres.value.etat === 'actif' ? 'Utilisables' : 'Hors service',
      value: filtres.value.etat,
      icone: 'toggle_on', cle: 'etat'});
  }
  if (filtres.value.repere) {
    cs.push({
      label: filtres.value.repere === 'avec' ? 'Avec repère GPS' : 'Sans repère GPS',
      value: filtres.value.repere,
      icone: 'my_location', cle: 'repere'});
  }
  return cs;
});

const colonnes: QTableColumn[] = [
  { name: 'code', label: 'Code', field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: 'Nom', field: 'nom', align: 'left', sortable: true },
  { name: 'batiment', label: 'Bâtiment', field: (r: Salle) => r.batiment || '—', align: 'left' },
  { name: 'capacite', label: 'Capacité', field: 'capacite', align: 'right', sortable: true },
  {
    name: 'repere',
    label: 'Repère GPS',
    field: (r: Salle) => (r.latitude ? `± ${r.rayonMetres} m` : '—'),
    align: 'left',
  },
  { name: 'qr', label: 'Jeton QR', field: 'qrToken', align: 'left' },
  { name: 'etat', label: 'État', field: 'actif', align: 'left' },
  { name: 'actions', label: 'Actions', field: 'id', align: 'right' },
];

/** Dessine le QR de la salle dans sa carte. */
const canvasParSalle = new Map<string, HTMLCanvasElement>();

function enregistrerCanvas(el: any, salle: Salle) {
  if (!el) {
    canvasParSalle.delete(salle.id);
    return;
  }
  canvasParSalle.set(salle.id, el as HTMLCanvasElement);
  void QRCode.toCanvas(el as HTMLCanvasElement, salle.qrToken, { width: 132, margin: 1 });
}

function dessinerTousLesQr() {
  for (const salle of sallesAffichees.value) {
    const el = canvasParSalle.get(salle.id);
    if (el) void QRCode.toCanvas(el, salle.qrToken, { width: 132, margin: 1 });
  }
}

function ouvrir(s: Salle | null) {
  salleEditee.value = s;
  erreurs.value = { code: false, nom: false, rayon: false };
  form.value = {
    code: s?.code ?? '',
    nom: s?.nom ?? '',
    batiment: s?.batiment ?? '',
    capacite: s?.capacite ?? 0,
    latitude: s?.latitude ?? undefined,
    longitude: s?.longitude ?? undefined,
    rayonMetres: s?.rayonMetres ?? 80,
    actif: s?.actif ?? true,
  };
  dialogOuvert.value = true;
}

/** La salle se lit aussi par ce qui s'y passe : on ouvre son registre. */
function voirSeances(s: Salle) {
  void router.push({ path: '/seances', query: { salleId: s.id } });
}

function positionActuelle() {
  navigator.geolocation?.getCurrentPosition(
    (p) => {
      form.value.latitude = Number(p.coords.latitude.toFixed(6));
      form.value.longitude = Number(p.coords.longitude.toFixed(6));
      $q.notify({ type: 'positive', message: 'Position renseignée' });
    },
    () => $q.notify({ type: 'negative', message: 'Position indisponible' }),
  );
}

async function enregistrer() {
  erreurs.value = {
    code: !form.value.code.trim(),
    nom: !form.value.nom.trim(),
    rayon: !!form.value.rayonMetres && form.value.rayonMetres < 10,
  };
  if (erreurs.value.code || erreurs.value.nom || erreurs.value.rayon) {
    $q.notify({ type: 'warning', message: 'Complétez les champs obligatoires' });
    return;
  }

  enregistrement.value = true;
  try {
    const payload = { ...form.value, batiment: form.value.batiment || undefined };
    if (salleEditee.value) await api.put(`/salles/${salleEditee.value.id}`, payload);
    else await api.post('/salles', payload);
    $q.notify({ type: 'positive', message: 'Salle enregistrée' });
    dialogOuvert.value = false;
    await charger();
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Enregistrement impossible',
    });
  } finally {
    enregistrement.value = false;
  }
}

function regenerer(s: Salle) {
  $q.dialog({
    title: 'Régénérer le QR',
    message: `L’affiche actuelle de ${s.code} deviendra invalide. Continuer ?`,
    cancel: { label: 'Annuler', flat: true, noCaps: true },
    ok: { color: 'primary', label: 'Régénérer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.post(`/salles/${s.id}/qr`);
      $q.notify({ type: 'positive', message: 'Nouveau QR généré — pensez à réimprimer l’affiche' });
      await charger();
    } catch (e: any) {
      $q.notify({
        type: 'negative',
        message: e?.response?.data?.message ?? 'Régénération impossible',
      });
    }
  });
}

function supprimer(s: Salle) {
  $q.dialog({
    title: 'Supprimer la salle',
    message: `Supprimer « ${s.code} — ${s.nom} » ? Son affiche QR ne vaudra plus rien.`,
    cancel: { label: 'Annuler', flat: true, noCaps: true },
    ok: { color: 'negative', label: 'Supprimer', unelevated: true, noCaps: true },
  }).onOk(async () => {
    try {
      await api.delete(`/salles/${s.id}`);
      $q.notify({ type: 'positive', message: 'Salle supprimée' });
      await charger();
    } catch (e: any) {
      $q.notify({
        type: 'negative',
        message:
          e?.response?.data?.message ??
          'Suppression impossible — des séances s’y déroulent encore',
      });
    }
  });
}

function imprimerQr(salleId?: string) {
  const suffixe = salleId ? `&salleId=${salleId}` : '';
  window.open(`${API_URL}/impression/qr-salles?token=${auth.token}${suffixe}`, '_blank');
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/salles', { params: { all: '1' } });
    salles.value = data.data ?? [];
  } catch (e: any) {
    salles.value = [];
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement des salles impossible',
    });
  } finally {
    chargement.value = false;
  }
}

onMounted(charger);

// Un filtre qui vide la page courante doit ramener à la première.
watch(sallesFiltrees, (liste) => {
  const max = Math.max(1, Math.ceil(liste.length / pageSize.value));
  if (page.value > max) page.value = max;
});

// Les jetons changent (régénération) ou la page affichée change : on redessine.
watch(
  () => [modeVue.value, sallesAffichees.value.map((s) => `${s.id}:${s.qrToken}`).join('|')],
  () => void nextTick(dessinerTousLesQr),
);
</script>

<style scoped lang="scss">
</style>
