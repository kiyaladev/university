<script setup lang="ts">
/**
 * Lecteur d'une ressource VOD (`/vod/lecteur/:id`). On garde les contrôles
 * natifs du navigateur — ils sont accessibles au clavier et aux lecteurs
 * d'écran — et on y ajoute une barre de reprise (lecture/pause, vitesse,
 * plein écran) qui pilote le même élément média.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../boot/axios';
import type { CoursVOD } from '../types';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();

const vod = ref<CoursVOD | null>(null);
const chargement = ref(false);

const mediaRef = ref<HTMLVideoElement | HTMLAudioElement | null>(null);
const enLecture = ref(false);
const dureeActuelle = ref(0);
const dureeMax = ref(0);
const volume = ref(1);
const vitesse = ref(1);
const pleinEcran = ref(false);

const SEUIL_COMPLET = 0.9;
let dernierSignal = 0;

const typeMedia = computed<'video' | 'audio'>(() => {
  if (vod.value?.type === 'AUDIO') return 'audio';
  return 'video';
});

const progression = computed(() => {
  if (!dureeMax.value) return 0;
  return Math.min(100, (dureeActuelle.value / dureeMax.value) * 100);
});

async function charger() {
  const id = route.params.id as string;
  chargement.value = true;
  try {
    const { data } = await api.get(`/vod/${id}`);
    vod.value = data;
    dureeMax.value = data.dureeSecondes ?? 0;
  } catch {
    $q.notify({ type: 'negative', message: 'Ressource introuvable.' });
    retour();
  } finally {
    chargement.value = false;
  }
}

/**
 * Retour au catalogue. Une URL de lecteur peut être ouverte directement (lien
 * partagé) : sans historique, `back()` sortirait de l'application.
 */
function retour() {
  if (window.history.length > 1) router.back();
  else void router.push({ name: 'vod' });
}

function basculerLecture() {
  if (!mediaRef.value) return;
  if (mediaRef.value.paused) {
    void mediaRef.value.play();
  } else {
    mediaRef.value.pause();
  }
}

function surLecture() { enLecture.value = true; }
function surPause() { enLecture.value = false; }

function surTimeUpdate() {
  if (!mediaRef.value) return;
  dureeActuelle.value = mediaRef.value.currentTime;
  if (dureeMax.value === 0 && mediaRef.value.duration) {
    dureeMax.value = mediaRef.value.duration;
  }
  if (dureeMax.value > 0 && dureeActuelle.value / dureeMax.value >= SEUIL_COMPLET) {
    const maintenant = Date.now();
    if (maintenant - dernierSignal > 15_000) {
      void signalerVue(true);
      dernierSignal = maintenant;
    }
  } else if (Date.now() - dernierSignal > 15_000) {
    void signalerVue(false);
  }
}

async function signalerVue(termine: boolean) {
  if (!vod.value) return;
  dernierSignal = Date.now();
  try {
    await api.post(`/vod/${vod.value.id}/vue`, {
      positionSecondes: Math.floor(dureeActuelle.value),
      dureeSecondes: Math.floor(dureeMax.value),
      termine,
    });
  } catch { /* silencieux */ }
}

function changerVitesse(v: number) {
  vitesse.value = v;
  if (mediaRef.value) mediaRef.value.playbackRate = v;
}

async function basculerPleinEcran() {
  if (!mediaRef.value) return;
  const racine = mediaRef.value.parentElement;
  try {
    if (!pleinEcran.value) {
      if (racine?.requestFullscreen) await racine.requestFullscreen();
      pleinEcran.value = true;
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      pleinEcran.value = false;
    }
  } catch { /* silencieux */ }
}

function surFin() {
  enLecture.value = false;
  void signalerVue(true);
}

function formaterDuree(secondes: number): string {
  const s = Math.floor(secondes);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

watch(() => route.params.id, () => { if (route.params.id) charger(); });
onMounted(charger);
onBeforeUnmount(() => { void signalerVue(false); });
</script>

<template>
  <q-page class="q-pa-md lecteur-page">
    <q-btn flat icon="arrow_back" label="Retour au catalogue" no-caps @click="retour" />

    <q-card v-if="chargement" class="q-pa-md q-mt-md">
      <q-spinner /> Chargement…
    </q-card>

    <q-card v-else-if="vod" class="lecteur-carte q-mt-md">
      <q-card-section>
        <div class="text-h6">{{ vod.titre }}</div>
        <div class="text-caption text-grey-7">
          {{ vod.enseignant ? `${vod.enseignant.prenom} ${vod.enseignant.nom}` : '' }}
          <span v-if="vod.matiere"> · {{ vod.matiere.code }} — {{ vod.matiere.intitule }}</span>
        </div>
      </q-card-section>

      <q-card-section class="lecteur-media">
        <video
          v-if="typeMedia === 'video'"
          ref="mediaRef"
          :src="vod.url"
          :aria-label="`Vidéo : ${vod.titre}`"
          controls
          preload="metadata"
          class="lecteur-video"
          @play="surLecture"
          @pause="surPause"
          @timeupdate="surTimeUpdate"
          @ended="surFin"
          @loadedmetadata="surTimeUpdate"
        />
        <audio
          v-else
          ref="mediaRef"
          :src="vod.url"
          :aria-label="`Audio : ${vod.titre}`"
          controls
          preload="metadata"
          class="lecteur-audio"
          @play="surLecture"
          @pause="surPause"
          @timeupdate="surTimeUpdate"
          @ended="surFin"
          @loadedmetadata="surTimeUpdate"
        />
      </q-card-section>

      <q-card-section>
        <q-linear-progress
          :value="progression / 100"
          color="primary"
          class="q-mb-sm"
          role="progressbar"
          :aria-valuenow="Math.round(progression)"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Progression de la lecture"
        />
        <div class="row items-center q-col-gutter-md">
          <q-btn
            unelevated
            color="primary"
            :icon="enLecture ? 'pause' : 'play_arrow'"
            round
            size="lg"
            :aria-label="enLecture ? 'Mettre en pause' : 'Lancer la lecture'"
            @click="basculerLecture"
          >
            <q-tooltip>{{ enLecture ? 'Pause' : 'Lecture' }}</q-tooltip>
          </q-btn>
          <span class="text-caption">
            {{ formaterDuree(dureeActuelle) }} / {{ formaterDuree(dureeMax) }}
          </span>
          <q-space />
          <q-select
            :model-value="vitesse"
            :options="[0.5, 1, 1.25, 1.5, 2]"
            dense
            outlined
            label="Vitesse"
            style="min-width: 110px"
            @update:model-value="changerVitesse"
          />
          <q-btn
            flat
            icon="fullscreen"
            round
            dense
            :aria-label="pleinEcran ? 'Quitter le plein écran' : 'Passer en plein écran'"
            @click="basculerPleinEcran"
          >
            <q-tooltip>{{ pleinEcran ? 'Quitter le plein écran' : 'Plein écran' }}</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>

      <q-card-section v-if="vod.description">
        <div class="text-caption text-grey-7">{{ vod.description }}</div>
      </q-card-section>
    </q-card>

    <q-card v-else class="lecteur-carte q-mt-md q-pa-lg text-center text-grey-7">
      <q-icon name="videocam_off" size="38px" color="grey-5" />
      <div class="q-mt-sm">Cette ressource n'est pas disponible.</div>
      <div class="text-caption q-mt-xs">
        Elle a peut-être été archivée ou n'est pas ouverte à votre profil.
      </div>
      <q-btn
        flat
        no-caps
        color="primary"
        icon="arrow_back"
        label="Retour au catalogue"
        class="q-mt-sm"
        @click="retour"
      />
    </q-card>
  </q-page>
</template>

<style scoped>
.lecteur-carte {
  max-width: 920px;
  margin: 0 auto;
}
.lecteur-video {
  width: 100%;
  max-height: 520px;
  background: black;
}
.lecteur-audio {
  width: 100%;
}
</style>