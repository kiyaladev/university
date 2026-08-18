<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import QRCode from 'qrcode';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { CLASSE_STATUT_CARTE, LIBELLE_STATUT_CARTE } from '../utils/libelles';
import type { CarteEtudiante } from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const carte = ref<CarteEtudiante | null>(null);
const canvasQr = ref<HTMLCanvasElement | null>(null);
const urlVerification = ref('');
const chargement = ref(false);

const nipDialog = ref(false);
const nipValeur = ref('');
const nipConfirmation = ref('');

/** Une carte révoquée ne s'imprime plus et n'accepte plus de NIP. */
const carteUtilisable = computed(() => Boolean(carte.value && carte.value.statut === 'EMISE'));

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/cartes-etudiantes/me');
    carte.value = data;
    urlVerification.value = `${window.location.origin}/#/verification-carte?carte=${encodeURIComponent(data.id)}&k=${encodeURIComponent(data.qrToken)}`;
    await nextTick();
    if (canvasQr.value) {
      await QRCode.toCanvas(canvasQr.value, urlVerification.value, {
        width: 260,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    }
  } catch {
    // 404 : aucune carte émise. Toute autre erreur est déjà notifiée par l'API.
    carte.value = null;
  } finally {
    chargement.value = false;
  }
}

/** Ouvre la page publique de vérification, exactement comme le ferait un scan. */
function ouvrirVerification() {
  if (urlVerification.value) window.open(urlVerification.value, '_blank');
}

async function copierUrlVerification() {
  try {
    await navigator.clipboard.writeText(urlVerification.value);
    $q.notify({ type: 'positive', message: 'Lien de vérification copié.' });
  } catch {
    $q.notify({ type: 'warning', message: 'Copie impossible : sélectionnez le lien à la main.' });
  }
}

function ouvrirDialogNip() {
  nipValeur.value = '';
  nipConfirmation.value = '';
  nipDialog.value = true;
}

async function confirmerNip() {
  if (!/^\d{4,6}$/.test(nipValeur.value)) {
    $q.notify({ type: 'warning', message: 'Le NIP doit comporter 4 à 6 chiffres.' });
    return;
  }
  if (nipValeur.value !== nipConfirmation.value) {
    $q.notify({ type: 'warning', message: 'Les deux NIP ne correspondent pas.' });
    return;
  }
  if (!carte.value) return;
  try {
    await api.post(`/cartes-etudiantes/${carte.value.id}/nip`, { nip: nipValeur.value });
    $q.notify({ type: 'positive', message: 'NIP enregistré.' });
    nipDialog.value = false;
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Impossible d\'enregistrer le NIP.' });
  }
}

function imprimer() {
  if (!carte.value) return;
  window.open(`${API_URL}/cartes-etudiantes/${carte.value.id}/imprimer?token=${auth.token}`, '_blank');
}

function dateFr(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

onMounted(charger);
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Ma carte étudiante</div>
        <div class="page-sous-titre">
          Votre carte numérique, vérifiable en ligne par QR code, avec un NIP
          personnel pour le resto U, la cité et les contrôles.
        </div>
      </div>
    </div>

    <q-card v-if="chargement" class="carte q-pa-md">
      <q-spinner /> Chargement de votre carte…
    </q-card>

    <q-card v-else-if="!carte" class="carte ma-carte q-pa-md text-center">
      <q-icon name="badge" size="42px" color="grey-5" />
      <div class="text-subtitle1 q-mt-sm">Aucune carte émise</div>
      <div class="text-body2 text-grey-8 q-mt-xs">
        La scolarité génère votre carte à partir de votre inscription. Si votre
        inscription est validée depuis plusieurs jours, demandez un duplicata ou
        ouvrez une réclamation.
      </div>
      <div class="row justify-center q-gutter-sm q-mt-md">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="description"
          label="Demander un document"
          :to="{ name: 'mes-demandes-docs' }"
        />
        <q-btn
          outline
          color="primary"
          no-caps
          icon="support_agent"
          label="Ouvrir une réclamation"
          :to="{ name: 'mes-reclamations' }"
        />
      </div>
    </q-card>

    <q-card v-else class="carte ma-carte">
      <q-card-section class="row items-center q-gutter-md">
        <q-avatar size="80px" color="grey-3" text-color="primary">
          <img v-if="carte.photoUrl" :src="carte.photoUrl" :alt="carte.etudiant?.prenom" />
          <q-icon v-else name="person" size="48px" />
        </q-avatar>
        <div class="col">
          <div class="text-h6">
            {{ carte.etudiant?.prenom }} {{ carte.etudiant?.nom }}
          </div>
          <div class="text-caption">
            Matricule <code>{{ carte.etudiant?.matricule }}</code>
          </div>
          <div class="q-mt-sm">
            <span class="champ champ-statut" :class="CLASSE_STATUT_CARTE[carte.statut]">
              <span class="pochoir">{{ LIBELLE_STATUT_CARTE[carte.statut] }}</span>
            </span>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-banner v-if="!carteUtilisable" class="note--erreur">
        <template #avatar><q-icon name="block" /></template>
        Cette carte a été révoquée par l'établissement : elle n'est plus
        valable et son QR affiche « carte non valable ».
        <span v-if="carte.motifRevocation"> Motif : {{ carte.motifRevocation }}.</span>
        Demandez un duplicata à la scolarité.
      </q-banner>

      <q-card-section>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <div class="text-caption text-grey-7">Émise le</div>
            <div class="text-body1">{{ dateFr(carte.dateEmission) }}</div>
          </div>
          <div class="col-12 col-md-6">
            <div class="text-caption text-grey-7">Valable jusqu'au</div>
            <div class="text-body1">{{ dateFr(carte.dateValidite) }}</div>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="text-center">
        <canvas ref="canvasQr" />
        <div class="text-caption text-grey-7 q-mt-sm">
          Scannez ce QR pour vérifier votre carte. Toute consultation est journalisée.
        </div>
        <div class="text-caption text-grey-7 q-mt-xs url-verification">
          <code>{{ urlVerification }}</code>
        </div>
        <div class="row justify-center q-gutter-sm q-mt-sm">
          <q-btn flat dense no-caps icon="content_copy" label="Copier le lien" @click="copierUrlVerification" />
          <q-btn
            flat
            dense
            no-caps
            icon="verified_user"
            label="Ouvrir la vérification"
            @click="ouvrirVerification"
          />
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="lock"
          label="Définir un NIP"
          :disable="!carteUtilisable"
          @click="ouvrirDialogNip"
        />
        <q-btn flat no-caps icon="print" label="Imprimer A4" :disable="!carteUtilisable" @click="imprimer" />
      </q-card-actions>
    </q-card>

    <q-dialog v-model="nipDialog">
      <q-card style="min-width: 420px">
        <q-card-section>
          <div class="text-h6">Définir votre NIP</div>
          <div class="text-caption text-grey-7">
            Le NIP est un code personnel à 4 à 6 chiffres qui authentifie votre carte
            pour les partenaires (resto U, cité, contrôles à distance).
          </div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="nipValeur"
            label="NIP (4 à 6 chiffres)"
            outlined
            dense
            mask="######"
            hint="Saisissez 4 à 6 chiffres."
          />
          <q-input
            v-model="nipConfirmation"
            label="Confirmation"
            outlined
            dense
            mask="######"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" no-caps @click="nipDialog = false" />
          <q-btn unelevated color="primary" no-caps label="Enregistrer" :disable="!nipValeur || !nipConfirmation" @click="confirmerNip" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.ma-carte {
  max-width: 720px;
  margin: 0 auto;
}

/* Pastille de statut : même gabarit que sur l'écran de gestion. */
.champ-statut {
  display: inline-flex;
  padding: 3px 8px;
  min-height: 24px;
}
.badge--ok { background: #e3f5e9; color: #17683a; }
.badge--ko { background: #fdeaea; color: #a52020; }

.url-verification code {
  word-break: break-all;
}
</style>