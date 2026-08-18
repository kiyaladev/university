<template>
  <q-page class="q-pa-md row justify-center">
    <div class="col-12 col-sm-10 col-md-7 col-lg-6">
      <div class="row justify-end q-gutter-sm q-mb-sm">
        <q-btn flat dense no-caps icon="fact_check" label="Vérifier une attestation" to="/verification" />
        <q-btn flat dense no-caps icon="login" label="Se connecter" to="/connexion" />
      </div>
      <div class="text-center q-my-lg">
        <div class="lettrage page-titre">Vérification de carte étudiante</div>
        <div class="page-sous-titre verification-intro">
          Cette page publique atteste de l'authenticité d'une carte étudiante
          numérique délivrée par l'établissement : la carte existe, est intacte
          et n'a pas été révoquée. Chaque consultation est journalisée.
        </div>
      </div>

      <!-- Formulaire de saisie / scan -->
      <div class="plaque q-pa-md q-mb-lg">
        <span class="section-titre">Saisir l'identifiant et le code du QR</span>
        <q-input
          v-model="identifiant"
          dense
          outlined
          clearable
          label="Identifiant de la carte"
          hint="UUID inscrit sous le QR"
        />
        <qr-scanner
          v-model="codeQr"
          label="Code QR de la carte"
          hint="Scannez le QR de la carte ou saisissez le code"
        />
        <div class="text-caption text-grey-7 q-mt-xs">
          Le QR scanné (ou collé) est une URL : ses paramètres
          <code>carte</code> et <code>k</code> remplissent le formulaire
          automatiquement.
        </div>
        <div class="row justify-end q-mt-md">
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="verified_user"
            label="Vérifier"
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
            {{ resultat.valide ? 'Carte authentique' : 'Carte non valable' }}
          </div>

          <div v-if="resultat.valide && resultat.carte" class="q-mt-md text-left">
            <p class="q-mb-sm">
              La carte <strong>{{ resultat.carte.identifiant }}</strong> existe bien
              dans le registre de l'établissement. Mentions vérifiées :
            </p>
            <table class="table-verification">
              <tbody>
                <tr>
                  <td class="ta-intitule">Étudiant</td>
                  <td>{{ resultat.carte.etudiant ?? '—' }}</td>
                </tr>
                <tr>
                  <td class="ta-intitule">Numéro de carte</td>
                  <td><code>{{ resultat.carte.identifiant }}</code></td>
                </tr>
                <tr>
                  <td class="ta-intitule">Statut</td>
                  <td>Émise — non révoquée, validité en cours</td>
                </tr>
                <tr>
                  <td class="ta-intitule">Émise le</td>
                  <td>{{ dateFr(resultat.carte.dateEmission) }}</td>
                </tr>
                <tr>
                  <td class="ta-intitule">Valable jusqu'au</td>
                  <td>{{ dateFr(resultat.carte.dateValidite) }}</td>
                </tr>
              </tbody>
            </table>
            <div class="text-caption text-grey-7 q-mt-md">
              Vérifié le {{ dateHeureFr(new Date()) }} — cette consultation a été
              enregistrée dans le journal de la carte.
            </div>
          </div>

          <p v-else class="q-mt-md text-left">{{ resultat.raison }}</p>
        </div>
      </div>

      <div class="text-center q-mt-xl text-caption text-grey-7">
        La vérification est gratuite et ne requiert aucun compte. Une carte
        révoquée ou un identifiant inconnu ne prouve rien — méfiance.
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../boot/axios';
import QrScanner from '../components/QrScanner.vue';

/**
 * Page publique de vérification : atteinte par le QR imprimé sur la carte
 * (https://…/verification-carte?carte=…&k=UP-CARTE-…) ou par saisie manuelle.
 * Le composant QrScanner ne restitue que le contenu brut scanné : on y
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
    const { data } = await api.get('/cartes-etudiantes/verifier', {
      params: { carte: identifiant.value.trim(), k: codeQr.value.trim() },
    });
    resultat.value = data;
  } catch {
    resultat.value = {
      valide: false,
      raison:
        "La vérification n'a pas pu aboutir : le service est momentanément indisponible. Réessayez dans un instant.",
    };
  } finally {
    verificationEnCours.value = false;
  }
}

function dateFr(v?: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function dateHeureFr(v: Date): string {
  return v.toLocaleString('fr-FR', {
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
  border-color: #2e7d32 !important;
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
  font-weight: 700;
  text-transform: uppercase;
  font-size: 11px !important;
  letter-spacing: 0.06em;
  background: rgba(16, 37, 30, 0.06);
}
</style>