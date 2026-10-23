<script setup lang="ts">
import SectionNavigation from '@/shared/components/SectionNavigation.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { computed, nextTick, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import { useAuthStore } from '@/stores/auth';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import DialogueCarte from '../components/DialogueCarte.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import CartesEtudiantesTableau from '../components/CartesEtudiantesTableau.vue';
import CartesEtudiantesCartes from '../components/CartesEtudiantesCartes.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import type { CarteEtudiante } from '@/types';
import { ouvrirImpression } from '@/shared/services/impression';
import { cartesEtudiantesService } from '../services/cartes-etudiantes';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

/**
 * Liaison depuis les autres écrans du dossier (demandes de documents,
 * réclamations) : `/cartes-etudiantes?etudiantId=…` ouvre directement la ou
 * les cartes de l'étudiant concerné (relu de l'URL par `syncUrl`).
 */
const filtres = ref<Record<string, any>>({ recherche: '', etudiantId: '' });
const liste = reactive(
  useListePaginee<CarteEtudiante>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      cartesEtudiantesService.liste({
        ...pageApi(p),
        search: texteApi(f.recherche),
        etudiantId: f.etudiantId || undefined,
      }),
  }),
);

const modeVue = usePresentationListe();

const peutEmettre = computed(() => auth.peut('cartes.emettre'));
const peutModifier = computed(() => auth.peut('cartes.modifier'));
const peutRevoquer = computed(() => auth.peut('cartes.revoquer'));

const dialogEmission = ref(false);
const dialogRevocation = ref(false);
const dialogDetail = ref(false);
const carteEnEdition = ref<CarteEtudiante | null>(null);
const carteRevocation = ref<CarteEtudiante | null>(null);
const carteDetail = ref<CarteEtudiante | null>(null);
const motifRevocation = ref('');
const canvasQr = ref<HTMLCanvasElement | null>(null);
const urlVerification = ref('');

function ouvrirDetail(c: CarteEtudiante) {
  carteDetail.value = c;
  urlVerification.value = `${window.location.origin}/#/verification-carte?carte=${encodeURIComponent(c.id)}&k=${encodeURIComponent(c.qrToken)}`;
  dialogDetail.value = true;
  void nextTick(() => {
    if (canvasQr.value) {
      void QRCode.toCanvas(canvasQr.value, urlVerification.value, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    }
  });
}

/** Ouvre la page publique de vérification, exactement comme le ferait un scan. */
function ouvrirVerification() {
  if (urlVerification.value) window.open(urlVerification.value, '_blank');
}

async function copierUrlVerification() {
  try {
    await navigator.clipboard.writeText(urlVerification.value);
    $q.notify({ type: 'positive', message: t('carteEtudiante.messages.linkCopied') });
  } catch {
    $q.notify({ type: 'warning', message: t('carteEtudiante.messages.copyError') });
  }
}

function imprimer(c: CarteEtudiante) {
  void ouvrirImpression(`/cartes-etudiantes/${c.id}/imprimer`);
}

function ouvrirRevocation(c: CarteEtudiante) {
  carteRevocation.value = c;
  motifRevocation.value = '';
  dialogRevocation.value = true;
}

async function confirmerRevocation() {
  if (!carteRevocation.value || motifRevocation.value.trim().length < 3) return;
  try {
    await cartesEtudiantesService.revoquer(carteRevocation.value.id, motifRevocation.value.trim());
    $q.notify({ type: 'warning', message: t('carteEtudiante.messages.revoked') });
    dialogRevocation.value = false;
    await liste.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
}

/** Retire le filtre « un seul étudiant » posé par un lien entrant. */
function retirerFiltreEtudiant() {
  filtres.value = { ...filtres.value, etudiantId: '' };
}

function ouvrirModification(c: CarteEtudiante) {
  carteEnEdition.value = c;
  dialogEmission.value = true;
}

function ouvrirEmission() {
  carteEnEdition.value = null;
  dialogEmission.value = true;
}
</script>

<template>
  <q-page class="q-pa-md">
    <section-navigation section="documents" />
    <en-tete-page :title="$t('carteEtudiante.title')" :subtitle="$t('carteEtudiante.subtitle')">
      <template v-if="peutEmettre" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('carteEtudiante.actions.issue')"
          @click="ouvrirEmission"
        />
      </template>
    </en-tete-page>

    <q-banner v-if="filtres.etudiantId" class="note--info q-mb-md">
      {{ $t('carteEtudiante.studentBanner.message') }}
      <template #action>
        <q-btn flat no-caps :label="$t('carteEtudiante.studentBanner.seeAll')" @click="retirerFiltreEtudiant" />
      </template>
    </q-banner>

    <barre-filtres v-model="filtres" :placeholder="$t('carteEtudiante.filters.searchPlaceholder')" />

    <barre-pagination
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      :show-all="false"
    />

    <!-- Vue tableau -->
    <cartes-etudiantes-tableau
      v-if="modeVue === 'tableau'"
      :rows="liste.lignes"
      :chargement="liste.chargement"
      :peut-modifier="peutModifier"
      :peut-revoquer="peutRevoquer"
      @detail="ouvrirDetail"
      @imprimer="imprimer"
      @modifier="ouvrirModification"
      @revoquer="ouvrirRevocation"
    />

    <!-- Vue cartes -->
    <cartes-etudiantes-cartes
      v-else
      :rows="liste.lignes"
      :chargement="liste.chargement"
      :peut-modifier="peutModifier"
      :peut-revoquer="peutRevoquer"
      @detail="ouvrirDetail"
      @imprimer="imprimer"
      @modifier="ouvrirModification"
      @revoquer="ouvrirRevocation"
    />

    <!-- Dialog émission / édition -->
    <dialogue-carte v-model="dialogEmission" :carte="carteEnEdition" @enregistre="liste.recharger()" />

    <!-- Dialog révocation -->
    <dialogue-formulaire
      v-model="dialogRevocation"
      :titre="$t('carteEtudiante.revokeDialog.title')"
      :sous-titre="
        carteRevocation?.etudiant
          ? `${carteRevocation.etudiant.prenom} ${carteRevocation.etudiant.nom} · ${carteRevocation.etudiant.matricule}`
          : undefined
      "
      taille="s"
      :libelle-valider="$t('carteEtudiante.revokeDialog.confirm')"
      couleur-valider="negative"
      :desactive="motifRevocation.trim().length < 3"
      @valider="confirmerRevocation"
    >
      <q-banner class="note--alerte q-mb-md">
        {{ $t('carteEtudiante.revokeDialog.warning') }}
      </q-banner>
      <q-input
        v-model="motifRevocation"
        :label="$t('carteEtudiante.revokeDialog.motifLabel')"
        :hint="$t('carteEtudiante.revokeDialog.motifHint')"
        outlined
        dense
        type="textarea"
        autogrow
      />
    </dialogue-formulaire>

    <!-- Dialog détail + QR -->
    <q-dialog v-model="dialogDetail">
      <q-card style="min-width: 360px">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">{{ $t('carteEtudiante.detailDialog.title') }}</div>
            <div v-if="carteDetail?.etudiant" class="text-caption text-grey-7">
              {{ carteDetail.etudiant.prenom }} {{ carteDetail.etudiant.nom }} ·
              {{ carteDetail.etudiant.matricule }}
            </div>
          </div>
          <q-btn flat round dense icon="close" :aria-label="$t('common.actions.close')" @click="dialogDetail = false" />
        </q-card-section>
        <q-card-section class="text-center">
          <canvas ref="canvasQr" />
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ $t('carteEtudiante.detailDialog.scanHint') }}
          </div>
          <div class="text-caption text-grey-7 q-mt-xs url-verification">
            <code>{{ urlVerification }}</code>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            flat
            no-caps
            icon="content_copy"
            :label="$t('carteEtudiante.detailDialog.copyLink')"
            @click="copierUrlVerification"
          />
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="verified_user"
            :label="$t('carteEtudiante.detailDialog.openVerification')"
            @click="ouvrirVerification"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.url-verification code {
  word-break: break-all;
}
</style>
