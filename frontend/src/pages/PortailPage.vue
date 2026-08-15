<template>
  <q-page class="portail">
    <!-- Vue réservée aux comptes étudiants : un autre rôle ne voit rien -->
    <div v-if="auth.role !== 'ETUDIANT'" class="plaque portail__autre-role">
      <q-icon name="person_off" size="46px" color="grey-7" />
      <span class="lettrage portail__autre-titre">Espace étudiant</span>
      <p class="portail__autre-texte">
        Cette vue est réservée aux comptes étudiants, ouverts par connexion
        par SMS depuis le portail.
      </p>
      <q-btn unelevated color="primary" no-caps icon="logout" label="Se déconnecter" @click="seDeconnecter" />
    </div>

    <template v-else-if="profil && resultats">
      <!-- Bandeau de bienvenue -->
      <header class="bandeau portail__entete">
        <div>
          <h1 class="lettrage portail__bonjour">
            Bonjour, {{ profil.etudiant.prenom || profil.etudiant.nom }}
          </h1>
          <p class="pochoir portail__matricule">
            Matricule {{ profil.etudiant.matricule }}
          </p>
        </div>
        <q-btn
          flat
          color="white"
          no-caps
          icon="logout"
          label="Se déconnecter"
          @click="seDeconnecter"
        />
      </header>

      <div class="portail__grille">
        <!-- Inscription -->
        <section class="plaque carte-portail">
          <h2 class="pochoir section-titre">Inscription</h2>
          <template v-if="profil.inscription">
            <div class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">Statut</span>
              <q-chip
                :color="couleurInscription[profil.inscription.statut] ?? 'grey-8'"
                text-color="white"
                square
              >
                {{ LIBELLE_STATUT_INSCRIPTION[profil.inscription.statut] }}
              </q-chip>
            </div>
            <div class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">Promotion</span>
              <span>{{ profil.inscription.promotion.nom }}</span>
            </div>
            <div class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">Année</span>
              <span>{{ profil.inscription.annee.libelle }}</span>
            </div>
            <div v-if="profil.inscription.promotion.filiere" class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">Filière</span>
              <span>{{ profil.inscription.promotion.filiere }}</span>
            </div>
          </template>
          <p v-else class="carte-portail__vide">Aucune inscription enregistrée.</p>
        </section>

        <!-- Frais -->
        <section class="plaque carte-portail">
          <h2 class="pochoir section-titre">Frais d'inscription</h2>
          <template v-if="profil.frais">
            <div class="carte-portail__recap">
              <span class="lettrage chiffres carte-portail__montant">
                {{ montantLisible(profil.frais.montant) }}
                <span class="carte-portail__devise">{{ profil.frais.devise }}</span>
              </span>
            </div>
            <div class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">Payé</span>
              <span class="chiffres">{{ montantLisible(profil.frais.paye) }} {{ profil.frais.devise }}</span>
            </div>
            <div class="carte-portail__ligne">
              <span class="pochoir carte-portail__libelle">Restant</span>
              <span class="chiffres">{{ montantLisible(profil.frais.solde) }} {{ profil.frais.devise }}</span>
            </div>
            <barre-taux :valeur="profil.frais.taux" :seuil-bas="60" :seuil-haut="90" class="carte-portail__jauge" />
          </template>
          <p v-else class="carte-portail__aucun">Aucun frais pour cette année.</p>
        </section>

        <!-- Paiements récents -->
        <section class="plaque carte-portail">
          <h2 class="pochoir section-titre">Paiements récents</h2>
          <ul v-if="profil.paiements.length" class="carte-portail__liste">
            <li v-for="p in profil.paiements.slice(0, 5)" :key="p.id" class="carte-portail__ligne">
              <span class="carte-portail__libelle">
                {{ LIBELLE_STATUT_PAIEMENT[p.statut] ?? p.statut }}
              </span>
              <span class="chiffres carte-portail__montant-petit">
                {{ montantLisible(p.montant) }} {{ p.devise }}
              </span>
              <span class="pochoir pochoir--brut carte-portail__date chiffres">
                {{ dateLisible(p.horodatage) }}
              </span>
            </li>
          </ul>
          <p v-else class="carte-portail__aucune">Aucun paiement enregistré.</p>
        </section>

        <!-- Résultats -->
        <section class="plaque carte-portail carte-portail--resultat">
          <h2 class="pochoir section-titre">Résultat</h2>
          <template v-if="resultats.finale">
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
                <q-tooltip v-if="resultats.finale.rang">Rang dans la promotion</q-tooltip>
              </q-chip>
            </div>
            <p class="carte-portail__resultat-details">
              {{ LIBELLE_SESSION_DELIBERATION[resultats.finale.session] }} ·
              {{ resultats.finale.promotion }}
              <span v-if="resultats.finale.mention"> · {{ resultats.finale.mention }}</span>
              <span v-if="resultats.finale.rang" class="chiffres"> · rang {{ resultats.finale.rang }}</span>
            </p>
          </template>
          <p v-else class="carte-portail__aucune">
            Aucun résultat publié pour le moment. Les délibérations validées par
            le jury apparaîtront ici.
          </p>
        </section>

        <!-- Attestations -->
        <section class="plaque carte-portail carte-portail--large">
          <h2 class="pochoir section-titre">Attestations</h2>
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
                  <span v-if="a.statut === 'REVOQUEE'" class="text-negative"> · révoquée</span>
                </span>
              </span>
              <q-btn
                unelevated
                color="primary"
                dense
                no-caps
                icon="visibility"
                label="Voir"
                @click="voirAttestation(a)"
              >
                <q-tooltip>Ouvrir l'impression de l'attestation (nouvel onglet)</q-tooltip>
              </q-btn>
            </li>
          </ul>
          <p v-else class="carte-portail__aucune">Aucune attestation émise.</p>
          <p class="pochoir carte-portail__avertissement">
            L'impression des attestations sera bientôt accessible depuis ce
            portail — l'onglet peut n'afficher rien pour le moment.
          </p>
        </section>

        <!-- Portefeuille resto — section appendée (module resto) -->
        <section
          v-if="auth.role === 'ETUDIANT' && resto"
          class="plaque carte-portail carte-portail--large"
        >
          <h2 class="pochoir section-titre">Portefeuille resto</h2>
          <div class="carte-portail__recap">
            <span class="lettrage chiffres carte-portail__montant">
              {{ montantLisible(resto.solde) }}
              <span class="carte-portail__devise">GNF</span>
            </span>
          </div>
          <p class="carte-portail__vide">
            Le solde sert au restaurant universitaire : scannez votre carte au
            guichet à chaque repas. Rechargez par Mobile Money et le solde est
            crédité après confirmation du guichet.
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
          <p v-else class="carte-portail__aucune">Aucune activité pour le moment.</p>

          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="add_card"
            label="Recharger"
            @click="dialogResto = true"
          />
          <p v-if="resto.instructions" class="pochoir carte-portail__avertissement">
            {{ resto.instructions }}
          </p>
        </section>

        <!-- Dialogue de rechargement du portefeuille resto -->
        <q-dialog v-model="dialogResto">
          <q-card style="width: 400px; max-width: 95vw">
            <q-card-section class="text-h6">Recharger le portefeuille resto</q-card-section>
            <q-card-section>
              <q-input
                v-model.number="montantResto"
                type="number"
                min="500"
                step="500"
                outlined
                dense
                label="Montant (GNF)"
                suffix="GNF"
              />
              <q-select
                v-model="operateurResto"
                :options="optionsOperateursResto"
                label="Opérateur Mobile Money"
                outlined
                dense
                class="q-mt-md"
              />
              <p class="pochoir carte-portail__vide q-mt-md">
                Vous paierez par Mobile Money : une référence vous sera
                communiquée pour le transfert.
              </p>
            </q-card-section>
            <q-card-actions align="right">
              <q-btn flat label="Annuler" v-close-popup />
              <q-btn
                color="primary"
                unelevated
                label="Demander le paiement"
                :loading="rechargementResto"
                :disable="!montantResto || montantResto < 500"
                @click="rechargerResto"
              />
            </q-card-actions>
          </q-card>
        </q-dialog>
      </div>
    </template>

    <div v-else class="portail__chargement">
      <q-spinner color="primary" size="42px" />
      <span class="pochoir">Chargement de votre dossier…</span>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import BarreTaux from '../components/BarreTaux.vue';
import {
  LIBELLE_DECISION_JURY,
  LIBELLE_STATUT_CONSOMMATION,
  LIBELLE_STATUT_INSCRIPTION,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_SESSION_DELIBERATION,
  LIBELLE_TYPE_ATTESTATION,
  LIBELLE_TYPE_REPAS,
  dateHeureLisible,
  dateLisible,
  montantLisible,
} from '../utils/libelles';

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
  deliberations: LigneResultat[];
  attestations: AttestationPortail[];
}

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const profil = ref<PortailProfil | null>(null);
const resultats = ref<{ deliberations: LigneResultat[]; finale: LigneResultat | null } | null>(null);

const couleurInscription: Record<string, string> = {
  VALIDEE: 'positive',
  PAYEE: 'positive',
  EN_ATTENTE_PAIEMENT: 'warning',
  BROUILLON: 'grey-8',
  ANNULEE: 'negative',
};

function tonResultat(decision: string) {
  return decision === 'ADMIS' ? 'carte-portail__admis' : 'carte-portail__ajourne';
}

function seDeconnecter() {
  auth.deconnexion();
  void router.push('/portail-connexion');
}

/** Ouvre l'impression de l'attestation, comme pour les états imprimables :
 *  jeton en paramètre d'URL (pas d'en-tête possible dans un onglet neuf). */
function voirAttestation(a: AttestationPortail) {
  const url = `${API_URL}/attestations/${a.id}/imprimer?token=${auth.token}`;
  const fenetre = window.open(url, '_blank');
  if (!fenetre) {
    $q.notify({
      type: 'warning',
      message: 'Autorisez les fenêtres contextuelles pour ouvrir l’attestation.',
    });
  }
}

onMounted(async () => {
  try {
    const [p, r] = await Promise.all([
      api.get('/portail/me', { silencieux: true } as never),
      api.get('/portail/resultats', { silencieux: true } as never),
    ]);
    profil.value = p.data;
    resultats.value = r.data;
  } catch {
    profil.value = null;
  }
});

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

const optionsOperateursResto = [
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'MTN_MOMO', label: 'MTN MoMo' },
  { value: 'TELECEL', label: 'Telecel' },
];

function lignesResto(donnees: any): LigneResto[] {
  const recharges = (donnees.recharges ?? []).map((r: any) => ({
    cle: `r-${r.id}`,
    date: r.rechargeLe,
    libelle: `Recharge — ${LIBELLE_STATUT_PAIEMENT[r.statut] ?? r.statut}`,
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
    const { data } = await api.get('/portail/resto/me', { silencieux: true } as never);
    resto.value = { solde: data.solde, lignes: lignesResto(data) };
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
    if (resto.value) resto.value.instructions = data.instructions;
    $q.notify({
      type: 'info',
      message: `Recharge ${data.paiement.reference} en attente — suivez les instructions de paiement`,
    });
    dialogResto.value = false;
    await chargerResto();
  } finally {
    rechargementResto.value = false;
  }
}

onMounted(() => {
  void chargerResto();
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
  border: 2px solid var(--up-encre);
}

.portail__bonjour {
  font-size: clamp(1.5rem, 1.1rem + 1.6vw, 2.1rem);
  margin: 0;
}

.portail__matricule {
  margin: 6px 0 0;
  color: rgba(250, 250, 247, 0.74);
}

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
  font-weight: 700;
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

.portail__chargement {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--up-3);
  padding: var(--up-6);
  color: var(--up-encre-douce);
}
</style>