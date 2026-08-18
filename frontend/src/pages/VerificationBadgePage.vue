<template>
  <q-page class="q-pa-md row justify-center">
    <div class="col-12 col-sm-10 col-md-7 col-lg-6">
      <div class="row justify-end q-gutter-sm q-mb-sm">
        <q-btn flat dense no-caps icon="badge" label="Vérifier une carte" to="/verification-carte" />
        <q-btn flat dense no-caps icon="fact_check" label="Vérifier une attestation" to="/verification" />
      </div>
      <div class="text-center q-my-lg">
        <div class="lettrage page-titre">Vérification de badge d’accès</div>
        <div class="page-sous-titre verification-intro">
          Cette page publique atteste qu’un badge présenté à l’entrée a bien été
          délivré par l’établissement, qu’il n’a pas été annulé et que sa
          validité court toujours. Chaque consultation est journalisée.
        </div>
      </div>

      <div class="plaque q-pa-md q-mb-lg">
        <span class="section-titre">Saisir l’identifiant et le code du QR</span>
        <q-input
          v-model="identifiant"
          dense
          outlined
          clearable
          label="Identifiant du badge"
          hint="UUID inscrit sous le QR"
        />
        <qr-scanner
          v-model="codeQr"
          label="Code QR du badge"
          hint="Scannez le QR du badge ou saisissez le code"
        />
        <div class="text-caption text-grey-7 q-mt-xs">
          Le QR scanné (ou collé) est une URL : ses paramètres
          <code>badge</code> et <code>k</code> remplissent le formulaire
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
            {{ resultat.valide ? 'Badge authentique' : 'Badge non valable' }}
          </div>

          <div v-if="resultat.valide && resultat.badge" class="q-mt-md text-left">
            <p class="q-mb-sm">
              Le badge <strong>{{ resultat.badge.numero }}</strong> figure bien au
              registre de l’établissement. Mentions vérifiées :
            </p>
            <table class="table-verification">
              <tbody>
                <tr>
                  <td class="pochoir ta-intitule">Porteur</td>
                  <td>{{ resultat.badge.porteur ?? '—' }}</td>
                </tr>
                <tr>
                  <td class="pochoir ta-intitule">Numéro</td>
                  <td><code>{{ resultat.badge.numero }}</code></td>
                </tr>
                <tr>
                  <td class="pochoir ta-intitule">Type</td>
                  <td>{{ LIBELLE_TYPE_BADGE[resultat.badge.type ?? ''] ?? resultat.badge.type }}</td>
                </tr>
                <tr v-if="resultat.badge.fonction || resultat.badge.organisation">
                  <td class="pochoir ta-intitule">Qualité</td>
                  <td>
                    {{ [resultat.badge.fonction, resultat.badge.organisation].filter(Boolean).join(' — ') }}
                  </td>
                </tr>
                <tr>
                  <td class="pochoir ta-intitule">Statut</td>
                  <td>Actif — non annulé, validité en cours</td>
                </tr>
                <tr v-if="resultat.badge.zonesAccess">
                  <td class="pochoir ta-intitule">Zones autorisées</td>
                  <td>{{ resultat.badge.zonesAccess }}</td>
                </tr>
                <tr>
                  <td class="pochoir ta-intitule">Délivré le</td>
                  <td>{{ dateLisible(resultat.badge.dateDelivrance) }}</td>
                </tr>
                <tr>
                  <td class="pochoir ta-intitule">Valable jusqu’au</td>
                  <td>{{ dateLisible(resultat.badge.dateValidite) }}</td>
                </tr>
              </tbody>
            </table>
            <div class="text-caption text-grey-7 q-mt-md">
              Vérifié le {{ dateHeureLisible(new Date().toISOString()) }} — cette
              consultation a été enregistrée dans le journal du badge.
            </div>
          </div>

          <p v-else class="q-mt-md text-left">{{ resultat.raison }}</p>
        </div>
      </div>

      <div class="text-center q-mt-xl text-caption text-grey-7">
        La vérification est gratuite et ne requiert aucun compte. Un badge annulé
        ou un identifiant inconnu ne prouve rien — méfiance.
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../boot/axios';
import QrScanner from '../components/QrScanner.vue';
import { LIBELLE_TYPE_BADGE, dateHeureLisible, dateLisible } from '../utils/libelles';

/**
 * Page publique de vérification d'un badge d'accès, jumelle de celle des
 * cartes étudiantes. Elle est la destination du QR imprimé sur le badge
 * (https://…/#/verification-badge?badge=…&k=UP-BADGE-…) : sans elle, tout scan
 * de badge tombait sur la page « introuvable ».
 */
interface ResultatVerification {
  valide: boolean;
  raison?: string;
  badge?: {
    numero?: string;
    type?: string;
    porteur?: string | null;
    fonction?: string | null;
    organisation?: string | null;
    zonesAccess?: string | null;
    dateDelivrance?: string | null;
    dateValidite?: string | null;
  };
}

const route = useRoute();

const identifiant = ref('');
const codeQr = ref('');
const resultat = ref<ResultatVerification | null>(null);
const verificationEnCours = ref(false);

// Ouverture directe depuis le QR : les paramètres sont déjà dans l'URL.
if (route.query.badge) identifiant.value = String(route.query.badge);
if (route.query.k) codeQr.value = String(route.query.k);

/** Analyse du contenu brut scanné : URL complète ou chaîne de paramètres. */
function analyserBrut(brut: string) {
  if (!brut.trim()) {
    codeQr.value = '';
    return;
  }
  let texte = brut.trim();
  const pos = texte.indexOf('?');
  if (pos !== -1) texte = texte.slice(pos + 1);
  const params = new URLSearchParams(texte);
  if (params.has('k')) {
    identifiant.value = String(params.get('badge') ?? identifiant.value);
    codeQr.value = String(params.get('k'));
  } else {
    // Saisie manuelle du contenu brut : on garde la valeur telle quelle.
    codeQr.value = brut.trim();
  }
}

watch(codeQr, (v) => {
  if (v && (v.includes('badge=') || v.includes('k='))) analyserBrut(v);
});

async function verifier() {
  verificationEnCours.value = true;
  resultat.value = null;
  try {
    const { data } = await api.get('/badges/verifier', {
      params: { badge: identifiant.value.trim(), k: codeQr.value.trim() },
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
</script>

<style scoped lang="scss">
@use '../css/quasar.variables' as *;

.verification-intro {
  margin: 0 auto;
}

.resultat-titre {
  font-size: 1.22rem;
  margin-top: var(--up-2);
}

.plaque-verite {
  border-width: 2px !important;
}

.plaque-verite--valide {
  border-color: $vert !important;
}

.plaque-verite--invalide {
  border-color: $rouge !important;
}

.table-verification {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--up-2);
}

.table-verification td {
  border: var(--up-filet-fin);
  padding: 6px 8px;
  vertical-align: top;
}

.ta-intitule {
  width: 150px;
  background: var(--up-craie);
}
</style>
