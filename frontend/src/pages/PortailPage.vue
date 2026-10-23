<template>
  <q-page class="portail">
    <!-- Vue réservée aux comptes étudiants : un autre rôle ne voit rien -->
    <div v-if="auth.role !== 'ETUDIANT'" class="plaque portail__autre-role">
      <q-icon name="person_off" size="46px" color="grey-7" />
      <span class="lettrage portail__autre-titre">{{ $t('portail.otherRole.title') }}</span>
      <p class="portail__autre-texte">
        {{ $t('portail.otherRole.message') }}
      </p>
      <div class="portail__autre-actions">
        <q-btn unelevated color="primary" no-caps icon="home" :label="$t('portail.actions.home')" to="/" />
        <q-btn flat no-caps icon="logout" :label="$t('portail.actions.logout')" @click="seDeconnecter" />
      </div>
    </div>

    <!-- Le dossier n'a pas pu être chargé : on le dit et on propose la suite -->
    <div v-else-if="erreur" class="plaque portail__autre-role">
      <q-icon name="error_outline" size="46px" color="negative" />
      <span class="lettrage portail__autre-titre">{{ $t('portail.errorState.title') }}</span>
      <p class="portail__autre-texte">{{ erreur }}</p>
      <div class="portail__autre-actions">
        <q-btn unelevated color="primary" no-caps icon="refresh" :label="$t('portail.actions.retry')" @click="charger" />
        <q-btn flat no-caps icon="logout" :label="$t('portail.actions.logout')" @click="seDeconnecter" />
      </div>
    </div>

    <template v-else-if="profil">
      <!-- Bandeau de bienvenue -->
      <header class="bandeau portail__entete">
        <div>
          <p class="pochoir portail__sur-titre">{{ $t('portail.header.subtitle') }}</p>
          <h1 class="lettrage portail__bonjour">
            {{ $t('portail.header.greeting', { prenom: profil.etudiant.prenom || profil.etudiant.nom }) }}
          </h1>
          <p class="pochoir portail__matricule">
            {{ $t('portail.header.matricule', { matricule: profil.etudiant.matricule }) }}
          </p>
        </div>

      </header>

      <!-- Tout ce que l'étudiant peut faire, au même endroit -->


      <div class="portail__grille">
        <!-- Inscription -->
        <section class="plaque carte-portail">
          <h2 class="pochoir section-titre">{{ $t('portail.sections.inscription.title') }}</h2>
          <template v-if="profil.inscription">
            <div class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">{{ $t('portail.sections.inscription.statut') }}</span>
              <PastilleStatut domaine="inscription" :statut="profil.inscription.statut" />
            </div>
            <div class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">{{ $t('portail.sections.inscription.promotion') }}</span>
              <span>{{ profil.inscription.promotion.nom }}</span>
            </div>
            <div class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">{{ $t('portail.sections.inscription.annee') }}</span>
              <span>{{ profil.inscription.annee.libelle }}</span>
            </div>
            <div v-if="profil.inscription.promotion.filiere" class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">{{ $t('portail.sections.inscription.filiere') }}</span>
              <span>{{ profil.inscription.promotion.filiere }}</span>
            </div>
          </template>
          <p v-else class="carte-portail__vide">{{ $t('portail.sections.inscription.empty') }}</p>
        </section>

        <!-- Frais -->
        <section class="plaque carte-portail">
          <h2 class="pochoir section-titre">{{ $t('portail.sections.frais.title') }}</h2>
          <template v-if="profil.frais">
            <div class="carte-portail__recap">
              <span class="lettrage chiffres carte-portail__montant">
                {{ montantLisible(profil.frais.montant) }}
                <span class="carte-portail__devise">{{ profil.frais.devise }}</span>
              </span>
            </div>
            <div class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">{{ $t('portail.sections.frais.paye') }}</span>
              <span class="chiffres">{{ montantLisible(profil.frais.paye) }} {{ profil.frais.devise }}</span>
            </div>
            <div class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">{{ $t('portail.sections.frais.restant') }}</span>
              <span class="chiffres">{{ montantLisible(profil.frais.solde) }} {{ profil.frais.devise }}</span>
            </div>
            <barre-taux :valeur="profil.frais.taux" :seuil-bas="60" :seuil-haut="90" class="carte-portail__jauge" />
          </template>
          <p v-else class="carte-portail__aucun">{{ $t('portail.sections.frais.empty') }}</p>
        <!-- Paiements récents -->
        <q-expansion-item :label="$t('simplification.history')" class="q-mt-md">
          <ul v-if="profil.paiements.length" class="carte-portail__liste">
            <li v-for="p in profil.paiements.slice(0, 5)" :key="p.id" class="carte-portail__ligne">
              <span class="carte-portail__item-texte">
                <span class="lettrage carte-portail__item-titre">
                  {{ LIBELLE_STATUT_PAIEMENT[p.statut] ?? p.statut }}
                </span>
                <span class="pochoir pochoir--brut carte-portail__date chiffres">
                  {{ p.reference }} · {{ LIBELLE_MODE_PAIEMENT[p.mode] ?? p.mode }} ·
                  {{ dateLisible(p.horodatage) }}
                </span>
              </span>
              <span class="chiffres carte-portail__montant-petit">
                {{ montantLisible(p.montant) }} {{ p.devise }}
              </span>
            </li>
          </ul>
          <p v-else class="carte-portail__aucune">{{ $t('portail.sections.paiements.empty') }}</p>
        </q-expansion-item>

        </section>

        <!-- Résultats -->
        <section class="plaque carte-portail carte-portail--resultat">
          <h2 class="pochoir section-titre">{{ $t('portail.sections.resultat.title') }}</h2>
          <template v-if="resultats?.finale">
            <div class="carte-portail__resultat-panneau">
              <span
                class="lettrage carte-portail__resultat-moyenne chiffres"
                :class="tonResultat(resultats.finale.decision)"
              >
                {{ resultats.finale.moyenne.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) }}
                <span class="carte-portail__resultat-surligne">/20</span>
              </span>
              <q-chip
                :color="resultats.finale.decision === 'ADMIS' ? 'positive' : 'negative'"
                text-color="white"
                square
                class="carte-portail__resultat-decision"
              >
                {{ LIBELLE_DECISION_JURY[resultats.finale.decision] }}
                <q-tooltip v-if="resultats.finale.rang">{{ $t('portail.sections.resultat.rankTooltip') }}</q-tooltip>
              </q-chip>
            </div>
            <p class="carte-portail__resultat-details">
              {{ LIBELLE_SESSION_DELIBERATION[resultats.finale.session] }} ·
              {{ resultats.finale.promotion }}
              <span v-if="resultats.finale.mention"> · {{ resultats.finale.mention }}</span>
              <span v-if="resultats.finale.rang" class="chiffres"> · {{ $t('portail.sections.resultat.rank', { rang: resultats.finale.rang }) }}</span>
            </p>
          </template>
          <p v-else class="carte-portail__aucune">
            {{ $t('portail.sections.resultat.empty') }}
          </p>
        </section>

        <!-- Attestations -->
        <q-expansion-item class="plaque carte-portail carte-portail--large" :label="$t('portail.sections.attestations.title')">
          <ul v-if="profil.attestations.length" class="carte-portail__liste">
            <li
              v-for="a in profil.attestations"
              :key="a.id"
              class="carte-portail__ligne"
              :class="{ 'carte-portail__ligne--revokee': a.statut === 'REVOQUEE' }"
            >
              <span class="carte-portail__item-texte">
                <span class="lettrage carte-portail__item-titre">{{ LIBELLE_TYPE_ATTESTATION[a.type] }}</span>
                <span class="pochoir pochoir--brut chiffres carte-portail__date">
                  {{ a.numero }} · {{ dateLisible(a.emiseLe) }}
                  <span v-if="a.statut === 'REVOQUEE'" class="text-negative"> · {{ $t('portail.sections.attestations.revoked') }}</span>
                </span>
              </span>
              <q-btn
                unelevated
                color="primary"
                dense
                no-caps
                icon="visibility"
                :label="$t('portail.actions.view')"
                @click="voirAttestation(a)"
              >
                <q-tooltip>{{ $t('portail.sections.attestations.viewTooltip') }}</q-tooltip>
              </q-btn>
            </li>
          </ul>
          <p v-else class="carte-portail__aucune">
            {{ $t('portail.sections.attestations.empty') }}
            <router-link to="/demandes-docs/mes" class="carte-portail__lien">
              {{ $t('portail.sections.attestations.emptyLink') }}
            </router-link>.
          </p>
          <p class="carte-portail__note">
            {{ $t('portail.sections.attestations.note') }}
            <router-link to="/verification" class="carte-portail__lien">
              {{ $t('portail.sections.attestations.noteLink') }}
            </router-link>.
          </p>
        </q-expansion-item>

        <!-- Portefeuille resto — section appendée (module resto) -->
        <q-expansion-item v-if="resto" class="plaque carte-portail carte-portail--large" :label="$t('portail.sections.resto.title')">
          <div class="carte-portail__recap">
            <span class="lettrage chiffres carte-portail__montant">
              {{ montantLisible(resto.solde) }}
              <span class="carte-portail__devise">{{ $t('statistiquesMesrs.chart.axis.gnf') }}</span>
            </span>
          </div>
          <p class="carte-portail__vide">
            {{ $t('portail.sections.resto.description') }}
          </p>

          <ul v-if="resto.lignes.length" class="carte-portail__liste">
            <li v-for="l in resto.lignes" :key="l.cle" class="carte-portail__ligne">
              <span class="carte-portail__item-texte">
                <span class="lettrage carte-portail__item-titre">{{ l.libelle }}</span>
                <span class="pochoir pochoir--brut chiffres carte-portail__date">
                  {{ dateHeureLisible(l.date) }} · {{ l.statut }}
                </span>
              </span>
              <span
                class="chiffres carte-portail__montant-petit"
                :class="l.montant < 0 ? 'text-negative' : 'text-positive'"
              >
                {{ l.montant < 0 ? '−' : '+' }}{{ montantLisible(Math.abs(l.montant)) }}
              </span>
            </li>
          </ul>
          <p v-else class="carte-portail__aucune">{{ $t('portail.sections.resto.empty') }}</p>

          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="add_card"
            :label="$t('portail.actions.recharge')"
            @click="dialogResto = true"
          />
          <p v-if="resto.instructions" class="pochoir carte-portail__avertissement">
            {{ resto.instructions }}
          </p>
        </q-expansion-item>
      </div>

      <nav class="plaque portail__services" :aria-label="$t('portail.nav.title')">
        <h2 class="pochoir section-titre">{{ $t('portail.nav.title') }}</h2>
        <ul class="portail__services-liste">
          <li v-for="s in services.slice(0, 3)" :key="s.vers">
            <router-link :to="s.vers" class="portail__service">
              <q-icon :name="s.icone" size="24px" />
              <span class="portail__service-texte">
                <span class="lettrage portail__service-titre">{{ s.libelle }}</span>
                <span v-if="s.aide" class="portail__service-aide">{{ s.aide }}</span>
              </span>
              <q-icon name="east" size="18px" class="portail__service-fleche" />
            </router-link>
          </li>
        </ul>
        <q-expansion-item v-if="services.length > 3" :label="$t('simplification.otherServices')">
          <q-list>
            <q-item v-for="s in services.slice(3)" :key="s.vers" clickable :to="s.vers">
              <q-item-section avatar><q-icon :name="s.icone" /></q-item-section>
              <q-item-section>{{ s.libelle }}</q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>
      </nav>

      <!-- Dialogue de rechargement du portefeuille resto -->
      <dialogue-formulaire
        v-model="dialogResto"
        :titre="$t('portail.dialogResto.title')"
        taille="s"
        :envoi="rechargementResto"
        :libelle-valider="$t('portail.dialogResto.submit')"
        :desactive="!montantResto || montantResto < 500"
        @valider="rechargerResto"
      >
        <q-input
          v-model.number="montantResto"
          type="number"
          min="500"
          step="500"
          outlined
          dense
          :label="$t('portail.dialogResto.montantLabel')"
          suffix="GNF"
          :hint="$t('portail.dialogResto.montantHint')"
          :error="!montantResto || montantResto < 500"
          :error-message="$t('portail.dialogResto.montantError')"
        />
        <q-select
          v-model="operateurResto"
          :options="optionsOperateursResto"
          emit-value
          map-options
          :label="$t('portail.dialogResto.operateurLabel')"
          outlined
          dense
          class="q-mt-md"
        />
        <p class="pochoir carte-portail__vide q-mt-md">
          {{ $t('portail.dialogResto.note') }}
        </p>
      </dialogue-formulaire>
    </template>

    <div v-else class="portail__chargement">
      <q-spinner color="primary" size="42px" />
      <span class="pochoir">{{ $t('portail.loading') }}</span>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '../components/PastilleStatut.vue';
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useServicesActifsStore } from '../stores/servicesActifs';
const modules = useServicesActifsStore();
import BarreTaux from '../components/BarreTaux.vue';
import DialogueFormulaire from '../components/DialogueFormulaire.vue';
import { ouvrirImpression } from '../services/impression';
import {
  LIBELLE_DECISION_JURY,
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_OPERATEUR_MM,
  LIBELLE_STATUT_CONSOMMATION,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_SESSION_DELIBERATION,
  LIBELLE_TYPE_ATTESTATION,
  LIBELLE_TYPE_REPAS,
  dateHeureLisible,
  dateLisible,
  montantLisible,
} from '../utils/libelles';

const { t } = useI18n();

/**
 * Tout ce que l'étudiant peut faire depuis son espace. Chaque cible est une
 * route réelle de router/routes.ts ouverte au rôle ETUDIANT (ou publique).
 */
const services = computed(() => [
  { vers: '/emploi-du-temps', icone: 'calendar_month', libelle: t('nav.emploi-du-temps'), aide: '' },
  {
    vers: '/ma-carte',
    icone: 'badge',
    libelle: t('portail.services.maCarte.label'),
    aide: t('portail.services.maCarte.help'),
  },
  {
    vers: '/mes-demarches',
    icone: 'description',
    libelle: t('simplification.procedures'),
    aide: t('portail.services.demandesDocuments.help'),
  },
  {
    vers: '/elections/vote',
    icone: 'how_to_vote',
    libelle: t('portail.services.vote.label'),
    aide: t('portail.services.vote.help'),
  },
  {
    vers: '/bibliotheque',
    icone: 'menu_book',
    libelle: t('portail.services.bibliotheque.label'),
    aide: t('portail.services.bibliotheque.help'),
  },
  {
    vers: '/formations',
    icone: 'workspace_premium',
    libelle: t('portail.services.formations.label'),
    aide: t('portail.services.formations.help'),
  },
].filter(service => modules.autorise(service.vers)));

interface PaiementPortail {
  id: string;
  reference: string;
  montant: number;
  devise: string;
  mode: string;
  operateur?: string | null;
  statut: string;
  horodatage: string;
  motif?: string | null;
}

interface AttestationPortail {
  id: string;
  numero: string;
  type: string;
  motif?: string | null;
  statut: 'EMISE' | 'REVOQUEE';
  emiseLe: string;
}

interface LigneResultat {
  id: string;
  session: 'NORMALE' | 'RATTRAPAGE';
  statutDeliberation: string;
  valideeLe?: string | null;
  annee: string;
  promotion: string;
  moyenne: number;
  decision: 'ADMIS' | 'AJOURNE' | 'DEFAILLANT';
  mention?: string | null;
  rang?: number | null;
}

interface PortailProfil {
  etudiant: {
    id: string;
    matricule: string;
    nom: string;
    prenom: string;
    email?: string | null;
    telephone?: string | null;
    actif: boolean;
  };
  inscription: {
    id: string;
    numero: string;
    statut: string;
    dateInscription?: string | null;
    montantFrais: number;
    annee: { libelle?: string };
    promotion: { nom?: string; niveau?: string; filiere?: string | null };
  } | null;
  frais: { montant: number; devise: string; paye: number; solde: number; taux: number } | null;
  paiements: PaiementPortail[];
  attestations: AttestationPortail[];
}

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const profil = ref<PortailProfil | null>(null);
const resultats = ref<{ deliberations: LigneResultat[]; finale: LigneResultat | null } | null>(null);
const erreur = ref('');

function tonResultat(decision: string) {
  return decision === 'ADMIS' ? 'carte-portail__admis' : 'carte-portail__ajourne';
}

function seDeconnecter() {
  auth.deconnexion();
  void router.push('/portail-connexion');
}

/** Attestation de scolarité : ouverte dans un onglet neuf, jeton en en-tête. */
function voirAttestation(a: AttestationPortail) {
  void ouvrirImpression(`/attestations/${a.id}/imprimer`);
}

/**
 * Le dossier et les résultats se chargent ensemble. Un échec n'est jamais
 * muet : sans message, l'étudiant reste devant un sablier sans fin.
 */
async function charger() {
  erreur.value = '';
  profil.value = null;
  try {
    const [p, r] = await Promise.all([
      api.get('/portail/me', { silencieux: true }),
      api.get('/portail/resultats', { silencieux: true }),
    ]);
    profil.value = p.data;
    resultats.value = r.data;
  } catch (e: any) {
    const message = e?.response?.data?.message;
    erreur.value = Array.isArray(message)
      ? message.join(' · ')
      : (message ?? t('portail.messages.loadError'));
  }
}

// ---------------------------------------------------------------- resto
// Section portefeuille resto (module resto — appendée sans rien casser).

interface LigneResto {
  cle: string;
  date: string;
  libelle: string;
  montant: number;
  statut: string;
}

interface PortefeuilleRestoPortail {
  solde: number;
  lignes: LigneResto[];
  instructions?: string | null;
}

const dialogResto = ref(false);
const montantResto = ref(10_000);
const operateurResto = ref('ORANGE_MONEY');
const rechargementResto = ref(false);
const resto = ref<PortefeuilleRestoPortail | null>(null);

// Les opérateurs sont nommés une seule fois pour toute l'application.
const optionsOperateursResto = (['ORANGE_MONEY', 'MTN_MOMO', 'TELECEL'] as const).map((value) => ({
  value,
  label: LIBELLE_OPERATEUR_MM[value] ?? value,
}));

function lignesResto(donnees: any): LigneResto[] {
  const recharges = (donnees.recharges ?? []).map((r: any) => ({
    cle: `r-${r.id}`,
    date: r.rechargeLe,
    libelle: t('portail.sections.resto.rechargeLabel', { statut: LIBELLE_STATUT_PAIEMENT[r.statut] ?? r.statut }),
    montant: r.montant,
    statut: LIBELLE_STATUT_PAIEMENT[r.statut] ?? r.statut,
  }));
  const consommations = (donnees.consommations ?? []).map((c: any) => ({
    cle: `c-${c.id}`,
    date: c.consommeLe,
    libelle: `${LIBELLE_TYPE_REPAS[c.repas] ?? c.repas}${c.cantine ? ` · ${c.cantine}` : ''}`,
    montant: -c.montant,
    statut: LIBELLE_STATUT_CONSOMMATION[c.statut] ?? c.statut,
  }));
  return [...recharges, ...consommations]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);
}

async function chargerResto() {
  try {
    const { data } = await api.get('/portail/resto/me', { silencieux: true });
    // Les instructions de paiement déjà affichées survivent au rechargement.
    resto.value = {
      solde: data.solde,
      lignes: lignesResto(data),
      instructions: resto.value?.instructions ?? null,
    };
  } catch {
    // Sans portefeuille, la section reste masquée.
  }
}

async function rechargerResto() {
  rechargementResto.value = true;
  try {
    const { data } = await api.post('/portail/resto/recharger', {
      montant: montantResto.value,
      mode: 'MOBILE_MONEY',
      operateur: operateurResto.value,
    });
    dialogResto.value = false;
    await chargerResto();
    if (resto.value) resto.value.instructions = data.instructions;
    $q.notify({
      type: 'info',
      message: t('portail.messages.rechargeInfo', { reference: data.paiement.reference }),
    });
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    rechargementResto.value = false;
  }
}

onMounted(() => {
  void charger();
  if (modules.services.find(s => s.id === 'restauration')?.actif !== false) void chargerResto();
});
</script>

<style scoped lang="scss">
.portail {
  padding: var(--up-4) var(--up-3) var(--up-6);
}

.portail__entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
  padding: var(--up-4) var(--up-4);
  margin-bottom: var(--up-4);
  border: var(--up-filet);
}

.portail__sur-titre {
  margin: 0 0 4px;
  color: var(--up-encre-tertiaire);
}

.portail__bonjour {
  font-size: clamp(1.5rem, 1.1rem + 1.6vw, 2.1rem);
  margin: 0;
}

.portail__matricule {
  margin: 6px 0 0;
  color: var(--up-encre-douce);
}

// ------------------------------------------------------------ démarches
// L'espace étudiant est d'abord une porte : tout ce qui lui est ouvert est
// listé ici, une ligne par démarche.
.portail__services {
  padding: var(--up-4);
  margin-bottom: var(--up-4);

  .section-titre { margin: 0 0 var(--up-3); }
}

.portail__services-liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--up-2);
}

.portail__service {
  display: flex;
  align-items: center;
  gap: var(--up-3);
  padding: var(--up-3);
  border: var(--up-filet-fin);
  color: var(--up-encre);
  text-decoration: none;
  height: 100%;

  &:hover,
  &:focus-visible {
    border: var(--up-filet);
    background: var(--up-craie);
  }
}

.portail__service-texte {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.portail__service-titre { font-size: 0.98rem; }

.portail__service-aide {
  font-size: 0.82rem;
  color: var(--up-encre-douce);
}

.portail__service-fleche { color: var(--up-encre-douce); }

.portail__grille {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--up-4);
  align-items: start;
}

.carte-portail {
  padding: var(--up-4);
  display: flex;
  flex-direction: column;
  gap: var(--up-2);

  .section-titre {
    margin: 0 0 var(--up-2);
  }
}

.carte-portail--large {
  grid-column: 1 / -1;
}

.carte-portail__ligne {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-2);
  flex-wrap: wrap;
  font-size: 0.95rem;
}

.carte-portail__libelle {
  color: var(--up-encre-douce);
}

.carte-portail__recap {
  display: flex;
  align-items: baseline;
  gap: var(--up-2);
}

.carte-portail__montant {
  font-size: clamp(1.6rem, 1.2rem + 1.4vw, 2.2rem);
}

.carte-portail__devise {
  font-size: 0.72em;
  color: var(--up-encre-douce);
}

.carte-portail__jauge {
  margin-top: var(--up-2);
}

.carte-portail__liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.carte-portail__montant-petit {
  font-weight: 590;
}

.carte-portail__date {
  color: var(--up-encre-douce);
}

.carte-portail__aucune,
.carte-portail__aucun,
.carte-portail__vide {
  color: var(--up-encre-douce);
  font-size: 0.9rem;
  margin: 0;
}

// ------------------------------------------------------------ résultat
.carte-portail--resultat {
  gap: var(--up-3);
}

.carte-portail__resultat-panneau {
  display: flex;
  align-items: center;
  gap: var(--up-3);
  flex-wrap: wrap;
}

.carte-portail__resultat-moyenne {
  font-size: clamp(2.6rem, 1.8rem + 3.2vw, 4.2rem);
  line-height: 1;
}

.carte-portail__resultat-surligne {
  font-size: 0.45em;
  color: var(--up-encre-douce);
}

.carte-portail__admis { color: $vert; }
.carte-portail__ajourne { color: $rouge; }

.carte-portail__resultat-details {
  margin: 0;
  color: var(--up-encre-douce);
  font-size: 0.92rem;
}

// ---------------------------------------------------------- attestations
.carte-portail__item-texte {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.carte-portail__item-titre {
  font-size: 0.92rem;
}

.carte-portail__ligne--revokee {
  opacity: 0.55;
}

.carte-portail__avertissement {
  color: $jaune-fonce;
  margin: var(--up-2) 0 0;
  border-top: var(--up-filet-fin);
  padding-top: var(--up-2);
}

.carte-portail__note {
  color: var(--up-encre-douce);
  font-size: 0.85rem;
  margin: var(--up-2) 0 0;
  border-top: var(--up-filet-fin);
  padding-top: var(--up-2);
}

.carte-portail__lien {
  color: inherit;
  text-decoration: underline;

  &:hover,
  &:focus-visible { color: var(--up-encre); }
}

// ------------------------------------------------- autres rôles & chargement
.portail__autre-role {
  max-width: 480px;
  margin: var(--up-6) auto;
  padding: var(--up-5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--up-2);
  text-align: center;
}

.portail__autre-titre {
  font-size: 1.3rem;
}

.portail__autre-texte {
  margin: 0;
  color: var(--up-encre-douce);
}

.portail__autre-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--up-2);
  margin-top: var(--up-2);
}

.portail__chargement {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--up-3);
  padding: var(--up-6);
  color: var(--up-encre-douce);
}
</style>
