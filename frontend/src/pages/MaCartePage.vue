<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { CLASSE_STATUT_CARTE, LIBELLE_STATUT_CARTE } from '../utils/libelles';
import type { CarteEtudiante } from '../types';
import { ouvrirImpression } from '../services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

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
    $q.notify({ type: 'positive', message: t('maCarte.messages.linkCopied') });
  } catch {
    $q.notify({ type: 'warning', message: t('maCarte.messages.copyError') });
  }
}

function ouvrirDialogNip() {
  nipValeur.value = '';
  nipConfirmation.value = '';
  nipDialog.value = true;
}

async function confirmerNip() {
  if (!/^\d{4,6}$/.test(nipValeur.value)) {
    $q.notify({ type: 'warning', message: t('maCarte.messages.nipLength') });
    return;
  }
  if (nipValeur.value !== nipConfirmation.value) {
    $q.notify({ type: 'warning', message: t('maCarte.messages.nipMismatch') });
    return;
  }
  if (!carte.value) return;
  try {
    await api.post(`/cartes-etudiantes/${carte.value.id}/nip`, { nip: nipValeur.value });
    $q.notify({ type: 'positive', message: t('maCarte.messages.nipSaved') });
    nipDialog.value = false;
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? t('maCarte.messages.nipSaveError'),
    });
  }
}

function imprimer() {
  if (!carte.value) return;
  void ouvrirImpression(`/cartes-etudiantes/${carte.value.id}/imprimer`);
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
        <h1 class="page-titre">{{ $t('maCarte.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('maCarte.subtitle') }}
        </div>
      </div>
    </div>

    <q-card v-if="chargement" class="carte q-pa-md">
      <q-spinner /> {{ $t('maCarte.loading') }}
    </q-card>

    <q-card v-else-if="!carte" class="carte ma-carte q-pa-md text-center">
      <q-icon name="badge" size="42px" color="grey-5" />
      <div class="text-subtitle1 q-mt-sm">{{ $t('maCarte.noCard.title') }}</div>
      <div class="text-body2 text-grey-8 q-mt-xs">
        {{ $t('maCarte.noCard.description') }}
      </div>
      <div class="row justify-center q-gutter-sm q-mt-md">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="description"
          :label="$t('maCarte.noCard.requestDocument')"
          :to="{ name: 'mes-demandes-docs' }"
        />
        <q-btn
          outline
          color="primary"
          no-caps
          icon="support_agent"
          :label="$t('maCarte.noCard.openComplaint')"
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
            {{ $t('maCarte.card.matricule') }} <code>{{ carte.etudiant?.matricule }}</code>
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
        {{ $t('maCarte.card.revoked.text') }}
        <span v-if="carte.motifRevocation">{{ $t('maCarte.card.revoked.reasonSuffix', { reason: carte.motifRevocation }) }}</span>
        {{ $t('maCarte.card.revoked.requestDuplicate') }}
      </q-banner>

      <q-card-section>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <div class="text-caption text-grey-7">{{ $t('maCarte.card.issuedOn') }}</div>
            <div class="text-body1">{{ dateFr(carte.dateEmission) }}</div>
          </div>
          <div class="col-12 col-md-6">
            <div class="text-caption text-grey-7">{{ $t('maCarte.card.validUntil') }}</div>
            <div class="text-body1">{{ dateFr(carte.dateValidite) }}</div>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="text-center">
        <canvas ref="canvasQr" />
        <div class="text-caption text-grey-7 q-mt-sm">
          {{ $t('maCarte.card.qrHint') }}
        </div>
        <div class="text-caption text-grey-7 q-mt-xs url-verification">
          <code>{{ urlVerification }}</code>
        </div>
        <div class="row justify-center q-gutter-sm q-mt-sm">
          <q-btn flat dense no-caps icon="content_copy" :label="$t('maCarte.card.copyLink')" @click="copierUrlVerification" />
          <q-btn
            flat
            dense
            no-caps
            icon="verified_user"
            :label="$t('maCarte.card.openVerification')"
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
          :label="$t('maCarte.card.setNip')"
          :disable="!carteUtilisable"
          @click="ouvrirDialogNip"
        />
        <q-btn flat no-caps icon="print" :label="$t('maCarte.card.print')" :disable="!carteUtilisable" @click="imprimer" />
      </q-card-actions>
    </q-card>

    <q-dialog v-model="nipDialog">
      <q-card style="min-width: 420px">
        <q-card-section>
          <div class="text-h6">{{ $t('maCarte.dialog.title') }}</div>
          <div class="text-caption text-grey-7">
            {{ $t('maCarte.dialog.description') }}
          </div>
        </q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="nipValeur"
            :label="$t('maCarte.dialog.nipLabel')"
            outlined
            dense
            mask="######"
            :hint="$t('maCarte.dialog.nipHint')"
          />
          <q-input
            v-model="nipConfirmation"
            :label="$t('maCarte.dialog.confirmLabel')"
            outlined
            dense
            mask="######"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('maCarte.dialog.cancel')" no-caps @click="nipDialog = false" />
          <q-btn unelevated color="primary" no-caps :label="$t('maCarte.dialog.save')" :disable="!nipValeur || !nipConfirmation" @click="confirmerNip" />
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
.badge--ok { background: #f1fbf2; color: #027a0b; }
.badge--ko { background: #fff1f2; color: #c10000; }

.url-verification code {
  word-break: break-all;
}
</style>
