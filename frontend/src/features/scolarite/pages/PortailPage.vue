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
        <q-btn unelevated color="primary" no-caps icon="refresh" :label="$t('common.actions.retry')" @click="charger" />
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
        <portail-inscription-panel :inscription="profil.inscription" />

        <!-- Frais -->
        <portail-frais-panel :frais="profil.frais" :paiements="profil.paiements" />

        <!-- Résultats -->
        <portail-resultats-panel :resultats="resultats" />

        <!-- Attestations -->
        <portail-attestations-panel :attestations="profil.attestations" @voir="voirAttestation" />

        <!-- Portefeuille resto — section appendée (module resto) -->
        <portail-resto-panel v-if="resto" :resto="resto" @recharger="dialogResto = true" />
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
        <q-expansion-item v-if="services.length > 3" :label="$t('portail.otherServices')">
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
          :suffix="DEVISE"
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
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useServicesActifsStore } from '@/stores/servicesActifs';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { ouvrirImpression } from '@/shared/services/impression';
import { DEVISE } from '@/shared/utils/format';
import {
  LIBELLE_OPERATEUR_MM,
  LIBELLE_STATUT_CONSOMMATION,
  LIBELLE_STATUT_PAIEMENT,
  LIBELLE_TYPE_REPAS,
} from '@/shared/utils/libelles';
import PortailAttestationsPanel from '../components/PortailAttestationsPanel.vue';
import PortailFraisPanel from '../components/PortailFraisPanel.vue';
import PortailInscriptionPanel from '../components/PortailInscriptionPanel.vue';
import PortailResultatsPanel from '../components/PortailResultatsPanel.vue';
import PortailRestoPanel from '../components/PortailRestoPanel.vue';
import type { ReponseRestoPortail } from '../components/PortailResto.types';
import { portailService, type ResultatsPortail } from '../services/portail';
import type { AttestationPortail, LigneResto, PortailProfil, PortefeuilleRestoPortail } from '../types';

const { t } = useI18n();
const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();
const modules = useServicesActifsStore();

/**
 * Tout ce que l'étudiant peut faire depuis son espace. Chaque cible est une
 * route réelle de router/routes.ts ouverte au rôle ETUDIANT (ou publique).
 */
const services = computed(() =>
  [
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
      libelle: t('layout.sections.procedures'),
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
  ].filter((service) => modules.autorise(service.vers)),
);

const profil = ref<PortailProfil | null>(null);
const resultats = ref<ResultatsPortail | null>(null);
const erreur = ref('');

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
      portailService.profil({ silencieux: true }),
      portailService.resultats({ silencieux: true }),
    ]);
    profil.value = p;
    resultats.value = r;
  } catch (e: any) {
    const message = e?.response?.data?.message;
    erreur.value = Array.isArray(message) ? message.join(' · ') : (message ?? t('portail.messages.loadError'));
  }
}

// ---------------------------------------------------------------- resto
// Section portefeuille resto (module resto — appendée sans rien casser).

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

function lignesResto(donnees: ReponseRestoPortail): LigneResto[] {
  const recharges = (donnees.recharges ?? []).map((r) => ({
    cle: `r-${r.id}`,
    date: r.rechargeLe,
    libelle: t('portail.sections.resto.rechargeLabel', { statut: LIBELLE_STATUT_PAIEMENT[r.statut] ?? r.statut }),
    montant: r.montant,
    statut: LIBELLE_STATUT_PAIEMENT[r.statut] ?? r.statut,
  }));
  const consommations = (donnees.consommations ?? []).map((c) => ({
    cle: `c-${c.id}`,
    date: c.consommeLe,
    libelle: `${LIBELLE_TYPE_REPAS[c.repas] ?? c.repas}${c.cantine ? ` · ${c.cantine}` : ''}`,
    montant: -c.montant,
    statut: LIBELLE_STATUT_CONSOMMATION[c.statut] ?? c.statut,
  }));
  return [...recharges, ...consommations].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
}

async function chargerResto() {
  try {
    const data = (await portailService.resto({ silencieux: true })) as unknown as ReponseRestoPortail;
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
    const data = await portailService.rechargerResto({
      montant: montantResto.value,
      mode: 'MOBILE_MONEY',
      operateur: operateurResto.value,
    });
    dialogResto.value = false;
    await chargerResto();
    if (resto.value) resto.value.instructions = data.instructions;
    // Sans référence de paiement, rien n'est annoncé (l'API garantit le paiement).
    const reference = data.paiement?.reference;
    if (reference === undefined) return;
    $q.notify({
      type: 'info',
      message: t('portail.messages.rechargeInfo', { reference }),
    });
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    rechargementResto.value = false;
  }
}

onMounted(() => {
  void charger();
  if (modules.services.find((s) => s.id === 'restauration')?.actif !== false) void chargerResto();
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

  .section-titre {
    margin: 0 0 var(--up-3);
  }
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

.portail__service-titre {
  font-size: 0.98rem;
}

.portail__service-aide {
  font-size: 0.82rem;
  color: var(--up-encre-douce);
}

.portail__service-fleche {
  color: var(--up-encre-douce);
}

.portail__grille {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--up-4);
  align-items: start;
}

// La note du dialogue de recharge, seule survivante de la carte « porte-plaque ».
.carte-portail__vide {
  color: var(--up-encre-douce);
  font-size: 0.9rem;
  margin: 0;
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
