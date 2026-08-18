<template>
  <q-page class="scan-page q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Scan examens</div>
        <div class="page-sous-titre">
          Scannez le QR de la carte étudiante — ou saisissez le matricule — pour
          valider la présence à l'épreuve en cours.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          flat
          no-caps
          icon="arrow_back"
          label="Retour aux examens"
          @click="router.push({ name: 'examens' })"
        />
      </div>
    </div>

    <!-- Aucun examen ouvert : on dit pourquoi et on donne la sortie -->
    <div v-if="!chargementExamens && !examens.length" class="plaque q-pa-lg text-center text-grey-7">
      <q-icon name="event_busy" size="38px" color="grey-5" />
      <div class="q-mt-sm text-weight-medium">Aucun examen en cours</div>
      <div class="text-caption q-mt-xs">
        Le scan des cartes n'est possible qu'une fois l'épreuve démarrée depuis la
        page Examens.
      </div>
      <q-btn
        unelevated
        color="primary"
        no-caps
        icon="quiz"
        label="Voir les examens planifiés"
        class="q-mt-md"
        @click="router.push({ name: 'examens' })"
      />
    </div>

    <template v-else>
      <q-card flat bordered class="ratio-carte q-mb-md">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-caption text-grey-7">Présents / inscrits</div>
            <div class="lettrage chiffres text-h3 ratio-chiffre">
              {{ examenCourant?.nbPresents ?? 0 }} / {{ examenCourant?.nbInscrits ?? '—' }}
            </div>
            <div class="text-caption text-grey-7">
              Taux {{ pourcentLisible(tauxPresence) }}
              · {{ examenCourant?.nbInscrits ? `${nbRestant} restant(s)` : 'aucun inscrit' }}
            </div>
          </div>
          <div class="col-auto">
            <q-knob
              :model-value="tauxPresence"
              :max="100"
              :thickness="0.18"
              size="120px"
              readonly
              :color="tauxPresence >= 80 ? 'positive' : 'primary'"
              track-color="grey-3"
            >
              <div class="text-h5 text-weight-bold">{{ Math.round(tauxPresence) }}%</div>
            </q-knob>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="q-mb-md">
        <q-card-section class="row q-col-gutter-md items-end">
          <div class="col-12 col-md">
            <q-select
              v-model="examenId"
              :options="optionsExamens"
              outlined
              dense
              emit-value
              map-options
              label="Examen en cours *"
              @update:model-value="(v) => selectionnerExamen(String(v ?? ''))"
            />
          </div>
          <div v-if="examenCourant" class="col-12 col-md-auto">
            <q-btn
              flat
              dense
              no-caps
              icon="local_printshop"
              label="Tirage de cet examen"
              aria-label="Voir le tirage de cet examen"
              @click="router.push({ name: 'tirage', query: { examenId: examenCourant.id } })"
            />
          </div>
        </q-card-section>

        <q-card-section v-if="examenCourant" class="q-pt-none text-caption text-grey-7">
          {{ examenCourant.codeExamen }} ·
          {{ examenCourant.matiere?.intitule ?? '—' }} ·
          {{ examenCourant.promotion?.nom ?? '—' }} ·
          salle {{ examenCourant.salle?.code ?? '—' }} ·
          {{ examenCourant.heureDebut }}–{{ examenCourant.heureFin }}
        </q-card-section>

        <q-card-section class="row q-col-gutter-md items-end">
          <div class="col-12 col-md">
            <qr-scanner
          v-model="reference"
          label="Carte étudiante (QR ou matricule)"
          hint="Scannez la carte du candidat ou saisissez son matricule"
        />
          </div>
          <div class="col-12 col-md-auto">
            <q-btn
              unelevated
              color="primary"
              no-caps
              icon="check"
              label="Confirmer la présence"
              :disable="!reference || !examenCourant"
              :loading="envoiScan"
              @click="confirmer"
            />
          </div>
        </q-card-section>

        <q-card-section v-if="dernierResultat" class="q-pt-none">
          <q-banner :class="dernierResultat.valide ? 'bg-positive text-white' : 'bg-negative text-white'">
            <template #avatar>
              <q-icon :name="dernierResultat.valide ? 'check_circle' : 'cancel'" size="md" />
            </template>
            <div class="text-weight-bold">
              {{ dernierResultat.valide ? 'Présence validée' : 'Scan rejeté' }}
              <span v-if="dernierResultat.matriculeSaisi"> · {{ dernierResultat.matriculeSaisi }}</span>
            </div>
            <div v-if="dernierResultat.valide">
              {{ dernierResultat.prenomPorteur }} {{ dernierResultat.nomPorteur }}
            </div>
            <div v-else>
              Motif : {{ dernierResultat.motifRejet ?? 'carte inconnue' }}
            </div>
          </q-banner>
        </q-card-section>
      </q-card>

      <q-card v-if="dernierResultat?.valide" flat bordered class="carte-identite q-mb-md">
        <q-card-section class="text-center">
          <q-avatar size="120px" color="primary" text-color="white" class="q-mb-md">
            <q-icon name="person" size="80px" />
          </q-avatar>
          <div class="text-h4 text-weight-bold">
            {{ dernierResultat.prenomPorteur }} {{ dernierResultat.nomPorteur }}
          </div>
          <div class="text-h6 text-grey-7 q-mt-sm">
            {{ dernierResultat.matriculeSaisi ?? dernierResultat.inscription?.etudiant?.matricule ?? '—' }}
          </div>
          <div v-if="dernierResultat.inscription?.etudiant" class="text-caption text-grey-7 q-mt-sm">
            {{ dernierResultat.inscription.etudiant.nom }} {{ dernierResultat.inscription.etudiant.prenom }}
          </div>
        </q-card-section>
      </q-card>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import QrScanner from '../components/QrScanner.vue';
import { LIBELLE_TYPE_EXAMEN, dateLisible, pourcentLisible } from '../utils/libelles';
import type { Examen, ScanExamen } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const examens = ref<Examen[]>([]);
const chargementExamens = ref(true);
const examenId = ref<string | null>(null);
const examenCourant = ref<Examen | null>(null);
const reference = ref('');
const envoiScan = ref(false);
const dernierResultat = ref<ScanExamen | null>(null);

const optionsExamens = computed(() =>
  examens.value.map((e) => ({
    value: e.id,
    label: `${e.codeExamen} — ${e.intitule} (${LIBELLE_TYPE_EXAMEN[e.type] ?? e.type}, ${dateLisible(e.dateExamen)})`,
  })),
);

const tauxPresence = computed(() => {
  const ex = examenCourant.value;
  if (!ex?.nbInscrits) return 0;
  return Math.min(100, (ex.nbPresents / ex.nbInscrits) * 100);
});

const nbRestant = computed(() => {
  const ex = examenCourant.value;
  if (!ex) return 0;
  return Math.max(0, ex.nbInscrits - ex.nbPresents);
});

/**
 * Seuls les examens démarrés peuvent recevoir des scans. Si la page est
 * ouverte depuis la fiche d'un examen (`?examenId=`), on force sa présence
 * dans la liste pour que le lien de la chaîne aboutisse toujours.
 */
async function chargerExamens() {
  chargementExamens.value = true;
  try {
    const { data } = await api.get('/examens', {
      params: { all: '1', statut: 'EN_COURS', pageSize: 200 },
    });
    examens.value = data.data ?? [];

    const demande = String(route.query.examenId ?? '');
    if (demande && !examens.value.some((e) => e.id === demande)) {
      try {
        const { data: ex } = await api.get(`/examens/${demande}`);
        examens.value = [ex, ...examens.value];
        $q.notify({
          type: 'warning',
          message: "Cet examen n'est pas démarré : les scans seront refusés tant qu'il n'est pas lancé.",
        });
      } catch {
        $q.notify({ type: 'negative', message: 'Examen introuvable' });
      }
    }

    const cible = demande || examenId.value || examens.value[0]?.id;
    if (cible) await selectionnerExamen(cible);
  } catch (e: any) {
    examens.value = [];
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Chargement des examens impossible' });
  } finally {
    chargementExamens.value = false;
  }
}

async function selectionnerExamen(id: string) {
  examenId.value = id || null;
  dernierResultat.value = null;
  if (!id) {
    examenCourant.value = null;
    return;
  }
  try {
    const { data } = await api.get(`/examens/${id}`);
    examenCourant.value = data;
  } catch {
    examenCourant.value = null;
    $q.notify({ type: 'negative', message: 'Examen introuvable' });
  }
}

/** Rafraîchit les seuls compteurs — moins coûteux qu'un rechargement complet. */
async function rafraichirCompteurs() {
  const courant = examenCourant.value;
  if (!courant) return;
  try {
    const { data } = await api.get(`/examens/${courant.id}/stats`);
    examenCourant.value = { ...courant, ...data };
  } catch {
    /* le compteur se remettra à jour au prochain scan */
  }
}

async function confirmer() {
  if (!examenCourant.value || !reference.value.trim()) return;
  envoiScan.value = true;
  try {
    const { data } = await api.post('/examens/scan', {
      examenId: examenCourant.value.id,
      reference: reference.value.trim(),
      scanneurId: auth.utilisateur?.id,
    });
    dernierResultat.value = data;
    reference.value = '';
    await rafraichirCompteurs();
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.response?.data?.message ?? 'Scan impossible' });
  } finally {
    envoiScan.value = false;
  }
}

onMounted(chargerExamens);
</script>

<style scoped lang="scss">
.scan-page {
  min-height: 100vh;
  // `--up-fond` n'existe pas : la couleur de fond du panneau est `--up-chaux`,
  // et le repli codé en dur masquait l'erreur, y compris en thème sombre.
  background: var(--up-chaux);
}

// Un chiffre qu'on lit de loin, en salle d'examen : lettrage du panneau et
// chiffres tabulaires, pas une fonte d'emprunt.
.ratio-carte .ratio-chiffre {
  color: var(--up-encre);
  font-feature-settings: 'tnum' 1;
}

// Aplat franc : le monde n'a ni dégradé ni ombre portée.
.carte-identite {
  background: var(--up-craie);
}
</style>
