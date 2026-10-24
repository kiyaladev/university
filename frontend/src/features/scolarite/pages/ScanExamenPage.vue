<template>
  <q-page class="scan-page q-pa-md">
    <en-tete-page :title="$t('scanExamen.title')" :subtitle="$t('scanExamen.subtitle')">
      <template #actions>
        <q-btn
          flat
          no-caps
          icon="arrow_back"
          :label="$t('scanExamen.actions.backToExamens')"
          @click="router.push({ name: 'examens' })"
        />
      </template>
    </en-tete-page>

    <!-- Aucun examen ouvert : on dit pourquoi et on donne la sortie -->
    <etat-vide
      v-if="!chargementExamens && !examens.length"
      class="plaque"
      icone="event_busy"
      :titre="$t('scanExamen.emptyState.title')"
      :aide="$t('scanExamen.emptyState.description')"
    >
      <template #action>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="quiz"
          :label="$t('scanExamen.actions.seePlannedExams')"
          @click="router.push({ name: 'examens' })"
        />
      </template>
    </etat-vide>

    <template v-else>
      <q-card flat bordered class="ratio-carte q-mb-md">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-caption text-grey-7">{{ $t('scanExamen.stats.presentsOverEnrolled') }}</div>
            <div class="lettrage chiffres text-h3 ratio-chiffre">
              {{ examenCourant?.nbPresents ?? 0 }} / {{ examenCourant?.nbInscrits ?? '—' }}
            </div>
            <div class="text-caption text-grey-7">
              {{ $t('scanExamen.stats.rate', { rate: pourcentLisible(tauxPresence) }) }}
              ·
              {{
                examenCourant?.nbInscrits
                  ? $t('scanExamen.stats.remaining', { count: nbRestant })
                  : $t('scanExamen.stats.noEnrolled')
              }}
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
              :label="$t('scanExamen.form.currentExam')"
              @update:model-value="(v) => selectionnerExamen(String(v ?? ''))"
            />
          </div>
          <div v-if="examenCourant" class="col-12 col-md-auto">
            <q-btn
              flat
              dense
              no-caps
              icon="local_printshop"
              :label="$t('scanExamen.actions.seeDraw')"
              :aria-label="$t('scanExamen.actions.seeDrawTooltip')"
              @click="router.push({ name: 'tirage', query: { examenId: examenCourant.id } })"
            />
          </div>
        </q-card-section>

        <q-card-section v-if="examenCourant" class="q-pt-none text-caption text-grey-7">
          {{
            $t('scanExamen.summary.slots', {
              code: examenCourant.codeExamen,
              subject: examenCourant.matiere?.intitule ?? '—',
              promotion: examenCourant.promotion?.nom ?? '—',
              room: examenCourant.salle?.code ?? '—',
              start: examenCourant.heureDebut,
              end: examenCourant.heureFin,
            })
          }}
        </q-card-section>

        <q-card-section class="row q-col-gutter-md items-end">
          <div class="col-12 col-md">
            <lecteur-qr
              v-model="reference"
              :label="$t('scanExamen.form.cardLabel')"
              :hint="$t('scanExamen.form.cardHint')"
            />
          </div>
          <div class="col-12 col-md-auto">
            <q-btn
              unelevated
              color="primary"
              no-caps
              icon="check"
              :label="$t('scanExamen.actions.confirmPresence')"
              :disable="!reference || !examenCourant"
              :loading="envoiScan"
              @click="confirmer"
            />
          </div>
        </q-card-section>

        <q-card-section v-if="dernierResultat" class="q-pt-none">
          <q-banner
            :class="
              dernierResultat.dejaEnregistre
                ? 'bg-warning text-dark'
                : dernierResultat.valide
                  ? 'bg-positive text-white'
                  : 'bg-negative text-white'
            "
          >
            <template #avatar>
              <q-icon
                :name="dernierResultat.dejaEnregistre ? 'info' : dernierResultat.valide ? 'check_circle' : 'cancel'"
                size="md"
              />
            </template>
            <div class="text-weight-bold">
              {{
                dernierResultat.dejaEnregistre
                  ? $t('scanExamen.result.alreadyRecorded')
                  : dernierResultat.valide
                    ? $t('scanExamen.result.validated')
                    : $t('scanExamen.result.rejected')
              }}
              <span v-if="dernierResultat.matriculeSaisi"> · {{ dernierResultat.matriculeSaisi }}</span>
            </div>
            <div v-if="dernierResultat.valide">
              {{ dernierResultat.prenomPorteur }} {{ dernierResultat.nomPorteur }}
            </div>
            <div v-else>
              {{
                $t('scanExamen.result.reason', {
                  reason: dernierResultat.motifRejet ?? $t('scanExamen.result.unknownCard'),
                })
              }}
            </div>
          </q-banner>
        </q-card-section>
      </q-card>

      <q-card
        v-if="dernierResultat?.valide && !dernierResultat.dejaEnregistre"
        flat
        bordered
        class="carte-identite q-mb-md"
      >
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
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import LecteurQr from '@/shared/components/LecteurQr.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { LIBELLE_TYPE_EXAMEN, dateLisible, pourcentLisible } from '@/shared/utils/libelles';
import { examensService, type ScanExamenEntree } from '../services/examens';
import type { Examen, ScanExamen } from '@/types';

const $q = useQuasar();
const { t } = useI18n();
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
    examens.value = await examensService.tous({ all: '1', statut: 'EN_COURS', pageSize: 200 });

    const demande = String(route.query.examenId ?? '');
    if (demande && !examens.value.some((e) => e.id === demande)) {
      try {
        const ex = await examensService.lire(demande);
        examens.value = [ex, ...examens.value];
        $q.notify({
          type: 'warning',
          message: t('scanExamen.messages.examNotStarted'),
        });
      } catch {
        /* notifié par l'intercepteur */
      }
    }

    const cible = demande || examenId.value || examens.value[0]?.id;
    if (cible) await selectionnerExamen(cible);
  } catch {
    examens.value = [];
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
    examenCourant.value = await examensService.lire(id);
  } catch {
    examenCourant.value = null;
  }
}

/** Rafraîchit les seuls compteurs — moins coûteux qu'un rechargement complet. */
async function rafraichirCompteurs() {
  const courant = examenCourant.value;
  if (!courant) return;
  try {
    const data = await examensService.stats(courant.id);
    examenCourant.value = { ...courant, ...(data as Partial<Examen>) };
  } catch {
    /* le compteur se remettra à jour au prochain scan */
  }
}

async function confirmer() {
  if (!examenCourant.value || !reference.value.trim()) return;
  envoiScan.value = true;
  try {
    const charge: ScanExamenEntree = {
      examenId: examenCourant.value.id,
      reference: reference.value.trim(),
      scanneurId: auth.utilisateur?.id,
    };
    // Le service renvoie le scan enregistré : on garde le modèle complet.
    dernierResultat.value = (await examensService.scanner(charge)) as unknown as ScanExamen;
    reference.value = '';
    await rafraichirCompteurs();
  } catch {
    /* notifié par l'intercepteur */
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
