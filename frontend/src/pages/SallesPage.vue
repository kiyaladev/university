<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Salles & codes QR</div>
        <div class="page-sous-titre">
          Chaque salle porte un QR affiché à l’entrée : le contrôleur le scanne pour
          attester sa présence sur place
        </div>
      </div>
      <div class="col-auto q-gutter-sm">
        <q-btn outline color="primary" no-caps icon="print" label="Imprimer les affiches" @click="imprimerQr()" />
        <q-btn
          v-if="auth.peutPlanifier"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle salle"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div v-for="s in salles" :key="s.id" class="col-12 col-sm-6 col-md-4 col-lg-3">
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
            <canvas :ref="(el) => enregistrerCanvas(el, s)" />
            <div class="text-caption text-grey-6 ellipsis">{{ s.qrToken }}</div>
          </q-card-section>

          <q-card-section class="q-pt-none text-caption">
            <div><q-icon name="groups" size="14px" /> {{ s.capacite }} places</div>
            <div v-if="s.latitude">
              <q-icon name="my_location" size="14px" />
              {{ s.latitude.toFixed(4) }}, {{ s.longitude?.toFixed(4) }} (± {{ s.rayonMetres }} m)
            </div>
            <div v-else class="text-grey-6"><q-icon name="location_off" size="14px" /> Sans repère GPS</div>
          </q-card-section>

          <q-separator />
          <q-card-actions align="right">
            <q-btn flat dense round icon="print" @click="imprimerQr(s.id)">
              <q-tooltip>Affiche de cette salle</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.peutPlanifier"
              flat
              dense
              round
              icon="autorenew"
              @click="regenerer(s)"
            >
              <q-tooltip>Régénérer le QR</q-tooltip>
            </q-btn>
            <q-btn v-if="auth.peutPlanifier" flat dense round icon="edit" @click="ouvrir(s)" />
          </q-card-actions>
        </q-card>
      </div>
    </div>

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
              <q-input v-model="form.code" outlined dense label="Code *" hint="ex. AMPHI-A" />
            </div>
            <div class="col-12 col-sm-7">
              <q-input v-model="form.nom" outlined dense label="Nom *" />
            </div>
          </div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-7">
              <q-input v-model="form.batiment" outlined dense label="Bâtiment" />
            </div>
            <div class="col-5">
              <q-input v-model.number="form.capacite" type="number" outlined dense label="Capacité" />
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
              <q-input v-model.number="form.rayonMetres" type="number" outlined dense label="Rayon (m)" />
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
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn color="primary" unelevated label="Enregistrer" :loading="enregistrement" @click="enregistrer" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import QRCode from 'qrcode';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import type { Salle } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const salles = ref<Salle[]>([]);
const dialogOuvert = ref(false);
const salleEditee = ref<Salle | null>(null);
const enregistrement = ref(false);

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

/** Dessine le QR de la salle dans sa carte. */
function enregistrerCanvas(el: any, salle: Salle) {
  if (!el) return;
  void QRCode.toCanvas(el as HTMLCanvasElement, salle.qrToken, { width: 132, margin: 1 });
}

function ouvrir(s: Salle | null) {
  salleEditee.value = s;
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
  enregistrement.value = true;
  try {
    const payload = { ...form.value, batiment: form.value.batiment || undefined };
    if (salleEditee.value) await api.put(`/salles/${salleEditee.value.id}`, payload);
    else await api.post('/salles', payload);
    $q.notify({ type: 'positive', message: 'Salle enregistrée' });
    dialogOuvert.value = false;
    await charger();
  } finally {
    enregistrement.value = false;
  }
}

function regenerer(s: Salle) {
  $q.dialog({
    title: 'Régénérer le QR',
    message: `L’affiche actuelle de ${s.code} deviendra invalide. Continuer ?`,
    cancel: true,
  }).onOk(async () => {
    await api.post(`/salles/${s.id}/qr`);
    $q.notify({ type: 'positive', message: 'Nouveau QR généré — pensez à réimprimer l’affiche' });
    await charger();
  });
}

function imprimerQr(salleId?: string) {
  const suffixe = salleId ? `&salleId=${salleId}` : '';
  window.open(`${API_URL}/impression/qr-salles?token=${auth.token}${suffixe}`, '_blank');
}

async function charger() {
  const { data } = await api.get('/salles', { params: { all: '1' } });
  salles.value = data.data;
  await nextTick();
}

onMounted(charger);
watch(salles, () => nextTick());
</script>
