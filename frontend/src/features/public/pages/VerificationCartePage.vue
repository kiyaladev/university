<template>
  <q-page class="q-pa-md row justify-center">
    <div class="col-12 col-sm-10 col-md-7 col-lg-6">
      <div class="row justify-end q-gutter-sm q-mb-sm">
        <q-btn
          flat
          dense
          no-caps
          icon="fact_check"
          :label="$t('verificationCarte.actions.verifyAttestation')"
          to="/verification"
        />
        <q-btn flat dense no-caps icon="login" :label="$t('common.actions.login')" to="/connexion" />
      </div>
      <div class="text-center q-my-lg">
        <h1 class="lettrage page-titre">{{ $t('verificationCarte.title') }}</h1>
        <div class="page-sous-titre verification-intro">
          {{ $t('verificationCarte.subtitle') }}
        </div>
      </div>

      <!-- Formulaire de saisie / scan -->
      <div class="plaque q-pa-md q-mb-lg">
        <span class="section-titre">{{ $t('verificationCarte.form.sectionTitle') }}</span>
        <q-input
          v-model="identifiant"
          dense
          outlined
          clearable
          :label="$t('verificationCarte.form.identifierLabel')"
          :hint="$t('verificationCarte.form.identifierHint')"
        />
        <lecteur-qr
          v-model="codeQr"
          :label="$t('verificationCarte.form.qrLabel')"
          :hint="$t('verificationCarte.form.qrHint')"
        />
        <div class="text-caption text-grey-7 q-mt-xs">
          {{ $t('verificationCarte.form.qrExplanationPrefix') }}
          <code>{{ PARAMETRES_QR.carte }}</code> {{ $t('verificationCarte.form.qrExplanationAnd') }}
          <code>{{ PARAMETRES_QR.k }}</code>
          {{ $t('verificationCarte.form.qrExplanationSuffix') }}
        </div>
        <div class="row justify-end q-mt-md">
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="verified_user"
            :label="$t('common.actions.verify')"
            :disable="!identifiant.trim() || !codeQr.trim()"
            :loading="verificationEnCours"
            @click="verifier"
          />
        </div>
      </div>

      <!-- Résultat : plaque verte (authentique) ou rouge (révoqué / inconnu) -->
      <div v-if="resultat" class="q-mt-lg se-peint">
        <div
          class="plaque plaque-verite q-pa-lg text-center"
          :class="resultat.valide ? 'plaque-verite--valide' : 'plaque-verite--invalide'"
        >
          <q-icon
            :name="resultat.valide ? 'verified_user' : 'report_problem'"
            size="56px"
            :color="resultat.valide ? 'positive' : 'negative'"
          />
          <div class="lettrage resultat-titre">
            {{ resultat.valide ? $t('verificationCarte.result.valid') : $t('verificationCarte.result.invalid') }}
          </div>

          <div v-if="resultat.valide && resultat.carte" class="q-mt-md text-left">
            <p class="q-mb-sm">
              {{ $t('verificationCarte.result.introPrefix') }}
              <strong>{{ resultat.carte.identifiant }}</strong>
              {{ $t('verificationCarte.result.introSuffix') }}
            </p>
            <table class="table-verification">
              <tbody>
                <tr>
                  <td class="ta-intitule">{{ $t('common.fields.student') }}</td>
                  <td>{{ resultat.carte.etudiant ?? '—' }}</td>
                </tr>
                <tr>
                  <td class="ta-intitule">{{ $t('verificationCarte.result.table.cardNumber') }}</td>
                  <td>
                    <code>{{ resultat.carte.identifiant }}</code>
                  </td>
                </tr>
                <tr>
                  <td class="ta-intitule">{{ $t('common.fields.status') }}</td>
                  <td>{{ $t('verificationCarte.result.table.statusValue') }}</td>
                </tr>
                <tr>
                  <td class="ta-intitule">{{ $t('common.fields.issuedOn') }}</td>
                  <td>{{ dateLongue(resultat.carte.dateEmission) }}</td>
                </tr>
                <tr>
                  <td class="ta-intitule">{{ $t('verificationCarte.result.table.validUntil') }}</td>
                  <td>{{ dateLongue(resultat.carte.dateValidite) }}</td>
                </tr>
              </tbody>
            </table>
            <div class="text-caption text-grey-7 q-mt-md">
              {{ $t('verificationCarte.result.verifiedAt', { date: dateHeure(new Date()) }) }}
            </div>
          </div>

          <p v-else class="q-mt-md text-left">{{ resultat.raison }}</p>
        </div>
      </div>

      <div class="text-center q-mt-xl text-caption text-grey-7">
        {{ $t('verificationCarte.footer') }}
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import { getAppLocale } from '@/boot/i18n';
import LecteurQr from '@/shared/components/LecteurQr.vue';

/**
 * Page publique de vérification : atteinte par le QR imprimé sur la carte
 * (https://…/verification-carte?carte=…&k=UP-CARTE-…) ou par saisie manuelle.
 * Le composant LecteurQr ne restitue que le contenu brut scanné : on y
 * extrait les paramètres « carte » et « k », exactement comme le ferait le
 * navigateur pour l'URL complète.
 */
interface ResultatVerification {
  valide: boolean;
  raison?: string;
  carte?: {
    identifiant?: string;
    etudiant?: string | null;
    dateEmission?: string | null;
    dateValidite?: string | null;
  };
}

const route = useRoute();
const { t } = useI18n();
/** Noms des paramètres d'URL lus dans le QR : identifiants techniques, non traduits. */
const PARAMETRES_QR = { carte: 'carte', k: 'k' } as const;

const identifiant = ref('');
const codeQr = ref('');
const resultat = ref<ResultatVerification | null>(null);
const verificationEnCours = ref(false);

// Ouverture directe depuis le QR : les paramètres sont déjà dans l'URL.
if (route.query.carte) identifiant.value = String(route.query.carte);
if (route.query.k) codeQr.value = String(route.query.k);

/** Analyse du contenu brut scanné : URL complète ou chaîne de paramètres. */
function analyserBrut(brut: string) {
  if (!brut.trim()) {
    codeQr.value = '';
    return;
  }
  let texte = brut.trim();
  // La caméra restitue l'URL complète : "https://…/verification-carte?carte=…&k=…"
  const pos = texte.indexOf('?');
  if (pos !== -1) texte = texte.slice(pos + 1);
  const params = new URLSearchParams(texte);
  if (params.has('k')) {
    identifiant.value = String(params.get('carte') ?? identifiant.value);
    codeQr.value = String(params.get('k'));
  } else {
    // Saisie manuelle du contenu brut : on garde la valeur telle quelle.
    codeQr.value = brut.trim();
  }
}

watch(codeQr, (v) => {
  if (v && (v.includes('carte=') || v.includes('k='))) analyserBrut(v);
});

async function verifier() {
  verificationEnCours.value = true;
  resultat.value = null;
  try {
    // Silencieux : le verdict (y compris l'échec) s'affiche dans le panneau de résultat.
    const { data } = await api.get('/cartes-etudiantes/verifier', {
      silencieux: true,
      params: { carte: identifiant.value.trim(), k: codeQr.value.trim() },
    });
    resultat.value = data;
  } catch {
    resultat.value = {
      valide: false,
      raison: t('verificationCarte.messages.verificationFailed'),
    };
  } finally {
    verificationEnCours.value = false;
  }
}

/** Date en toutes lettres (« 12 mars 2026 »), dans la langue choisie. */
function dateLongue(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(getAppLocale(), { day: '2-digit', month: 'long', year: 'numeric' });
}

function dateHeure(v: Date): string {
  return v.toLocaleString(getAppLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<style scoped>
.verification-intro {
  margin: 0 auto;
}

.resultat-titre {
  font-size: 1.6rem;
  margin-top: var(--up-2);
}

.plaque-verite {
  border-width: 2px !important;
}

.plaque-verite--valide {
  border-color: #027a0b !important;
}

.plaque-verite--invalide {
  border-color: #b71c1c !important;
}

.table-verification {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--up-2);
}

.table-verification td {
  border: 1px solid rgba(16, 37, 30, 0.38);
  padding: 6px 8px;
  vertical-align: top;
  font-size: 13.5px;
}

.ta-intitule {
  width: 150px;
  font-weight: 590;
  font-size: 11px !important;
  letter-spacing: -0.01em;
  background: rgba(16, 37, 30, 0.06);
}
</style>
