<template>
  <q-page class="q-pa-md row justify-center">
    <div class="col-12 col-sm-10 col-md-7 col-lg-6">
      <div class="row justify-end q-gutter-sm q-mb-sm">
        <q-btn flat dense no-caps icon="badge" :label="$t('verification.nav.verifyCard')" to="/verification-carte" />
        <q-btn flat dense no-caps icon="login" :label="$t('common.actions.login')" to="/connexion" />
      </div>
      <div class="text-center q-my-lg">
        <h1 class="lettrage page-titre">{{ $t('verification.title') }}</h1>
        <div class="page-sous-titre verification-intro">
          {{ $t('verification.subtitle') }}
        </div>
      </div>

      <!-- Formulaire de saisie / scan -->
      <div class="plaque q-pa-md q-mb-lg">
        <span class="section-titre">{{ $t('verification.form.sectionTitle') }}</span>
        <q-input
          v-model="numero"
          dense
          outlined
          clearable
          :label="$t('verification.form.numeroLabel')"
          :hint="$t('verification.form.numeroHint')"
        />
        <lecteur-qr v-model="codeQr" :label="$t('verification.form.qrLabel')" :hint="$t('verification.form.qrHint')" />
        <div class="text-caption text-grey-7 q-mt-xs">
          <i18n-t keypath="verification.form.qrParamsHint" tag="span">
            <template #ref
              ><code>{{ PARAMETRES_QR.ref }}</code></template
            >
            <template #k
              ><code>{{ PARAMETRES_QR.k }}</code></template
            >
          </i18n-t>
        </div>
        <div class="row justify-end q-mt-md">
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="verified_user"
            :label="$t('common.actions.verify')"
            :disable="!numero.trim() || !codeQr.trim()"
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
            {{ resultat.valide ? $t('verification.result.valid') : $t('verification.result.invalid') }}
          </div>

          <div v-if="resultat.valide && detail" class="q-mt-md text-left">
            <p class="q-mb-sm">
              <i18n-t keypath="verification.result.intro" tag="span">
                <template #numero
                  ><strong>{{ detail.numero }}</strong></template
                >
              </i18n-t>
            </p>
            <table class="table-verification">
              <tbody>
                <tr>
                  <td class="ta-intitule">{{ $t('verification.result.table.attestation') }}</td>
                  <td>
                    {{ LIBELLE_TYPE_ATTESTATION[detail.type ?? ''] ?? detail.type }}
                    {{ $t('verification.result.table.attestationValue', { numero: detail.numero }) }}
                  </td>
                </tr>
                <tr v-if="detail.etudiant">
                  <td class="ta-intitule">{{ $t('common.fields.student') }}</td>
                  <td>
                    {{ detail.etudiant.prenom }} {{ detail.etudiant.nom }}
                    {{ $t('verification.result.table.etudiantValue', { matricule: detail.etudiant.matricule }) }}
                  </td>
                </tr>
                <tr>
                  <td class="ta-intitule">{{ $t('verification.result.table.parcours') }}</td>
                  <td>
                    {{ detail.annee ?? '—' }}
                    {{ detail.promotion ? ` · ${detail.promotion}` : '' }}
                  </td>
                </tr>
                <tr v-if="detail.motif">
                  <td class="ta-intitule">{{ $t('common.fields.motif') }}</td>
                  <td>{{ detail.motif }}</td>
                </tr>
                <tr>
                  <td class="ta-intitule">{{ $t('common.fields.issuedOn') }}</td>
                  <td>{{ dateLongueLisible(detail.emiseLe) }}</td>
                </tr>
                <tr v-if="resultat.verificationId">
                  <td class="ta-intitule">{{ $t('verification.result.table.reference') }}</td>
                  <td class="chiffres">{{ resultat.verificationId }}</td>
                </tr>
              </tbody>
            </table>
            <div class="text-caption text-grey-7 q-mt-md">
              {{ $t('verification.result.checkedAt', { date: dateHeure(new Date()) }) }}
            </div>
          </div>

          <p v-else class="q-mt-md text-left">{{ resultat.raison }}</p>
        </div>
      </div>

      <div class="text-center q-mt-xl text-caption text-grey-7">
        {{ $t('verification.footer') }}
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import { dateHeureLisible, dateLongueLisible } from '@/shared/utils/format';
import LecteurQr from '@/shared/components/LecteurQr.vue';
import { LIBELLE_TYPE_ATTESTATION } from '@/shared/utils/libelles';

/**
 * Page publique de vérification : atteinte par le QR imprimé sur le document
 * (https://…/verification?ref=ATT-…&k=UP-DOC-…) ou par saisie manuelle.
 * Le composant LecteurQr ne restitue que le contenu brut scanné : on y
 * extrait les paramètres « ref » et « k », exactement comme le ferait le
 * navigateur pour l'URL complète.
 */
interface ResultatVerification {
  valide: boolean;
  raison?: string;
  verificationId?: string;
  attestation?: {
    numero?: string;
    type?: string;
    motif?: string | null;
    emiseLe?: string;
    etudiant?: { nom?: string; prenom?: string; matricule?: string } | null;
    annee?: string | null;
    promotion?: string | null;
  };
}

const route = useRoute();
const { t } = useI18n();
/** Noms des paramètres d'URL lus dans le QR : identifiants techniques, non traduits. */
const PARAMETRES_QR = { ref: 'ref', k: 'k' } as const;

const numero = ref('');
const codeQr = ref('');
const resultat = ref<ResultatVerification | null>(null);
const verificationEnCours = ref(false);

const detail = computed(() => resultat.value?.attestation ?? null);

// Ouverture directe depuis le QR : les paramètres sont déjà dans l'URL.
if (route.query.ref) numero.value = String(route.query.ref);
if (route.query.k) codeQr.value = String(route.query.k);

/** Analyse du contenu brut scanné : URL complète ou chaîne de paramètres. */
function analyserBrut(brut: string) {
  if (!brut.trim()) {
    codeQr.value = '';
    return;
  }
  let texte = brut.trim();
  // La caméra restitue l'URL complète : "https://…/verification?ref=…&k=…"
  const pos = texte.indexOf('?');
  if (pos !== -1) texte = texte.slice(pos + 1);
  const params = new URLSearchParams(texte);
  if (params.has('k')) {
    numero.value = String(params.get('ref') ?? numero.value);
    codeQr.value = String(params.get('k'));
  } else {
    // Saisie manuelle du contenu brut : on garde la valeur telle quelle.
    codeQr.value = brut.trim();
  }
}

watch(codeQr, (v) => {
  if (v && (v.includes('ref=') || v.includes('k='))) analyserBrut(v);
});

async function verifier() {
  verificationEnCours.value = true;
  resultat.value = null;
  try {
    // Silencieux : le verdict (y compris l'échec) s'affiche dans le panneau de résultat.
    const { data } = await api.get('/attestations/verifier', {
      silencieux: true,
      params: { ref: numero.value.trim(), k: codeQr.value.trim() },
    });
    resultat.value = data;
  } catch {
    resultat.value = {
      valide: false,
      raison: t('verification.errors.serviceUnavailable'),
    };
  } finally {
    verificationEnCours.value = false;
  }
}

function dateHeure(v: Date): string {
  return dateHeureLisible(v.toISOString(), {
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
