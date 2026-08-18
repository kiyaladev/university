<template>
  <q-layout view="hHh LpR fFf">
    <q-header class="bandeau entete">
      <q-toolbar>
        <q-btn dense flat round icon="menu" aria-label="Ouvrir le menu" @click="menuOuvert = !menuOuvert" />

        <q-toolbar-title class="row items-center no-wrap">
          <span class="lettrage entete__marque">UniPrésence</span>
          <span class="pochoir entete__page gt-sm">{{ titrePage }}</span>
        </q-toolbar-title>

        <!-- Synchronisation des pointages hors ligne -->
        <q-btn
          v-if="pointages.enAttente"
          flat
          dense
          no-caps
          icon="cloud_upload"
          :label="`${pointages.enAttente} à synchroniser`"
          :loading="pointages.synchronisation"
          @click="pointages.synchroniser()"
        />
        <q-chip v-if="!pointages.enLigne" dense color="warning" text-color="black" icon="cloud_off">
          Hors ligne
        </q-chip>

        <q-btn flat round dense :icon="dark.isActive ? 'light_mode' : 'dark_mode'" @click="dark.toggle()">
          <q-tooltip>Basculer le thème</q-tooltip>
        </q-btn>

        <q-btn flat round dense aria-label="Mon compte">
          <q-avatar square size="32px" color="secondary" text-color="white" class="pochoir">
            {{ auth.initiales }}
          </q-avatar>
          <q-menu>
            <div class="q-pa-md" style="min-width: 230px">
              <div class="text-weight-bold">{{ auth.nomComplet }}</div>
              <div class="text-caption text-grey-7">{{ auth.utilisateur?.email }}</div>
              <q-chip dense size="sm" color="primary" text-color="white" class="q-mt-sm">
                {{ LIBELLE_ROLE[auth.utilisateur!.role] }}
              </q-chip>
            </div>
            <q-separator />
            <q-list dense>
              <q-item v-if="installable" clickable v-close-popup @click="installer">
                <q-item-section avatar><q-icon name="install_mobile" /></q-item-section>
                <q-item-section>
                  <q-item-label>Installer sur cet appareil</q-item-label>
                  <q-item-label caption>Ouvrir la tournée depuis l’écran d’accueil</q-item-label>
                </q-item-section>
              </q-item>
              <!-- L'application Android n'a de sens que sur Android, et pas
                   depuis l'application elle-même. -->
              <q-item
                v-if="proposerApk"
                clickable
                v-close-popup
                tag="a"
                href="/telechargement/unipresence.apk"
              >
                <q-item-section avatar><q-icon name="android" /></q-item-section>
                <q-item-section>
                  <q-item-label>Télécharger l’application Android</q-item-label>
                  <q-item-label caption>
                    Nécessaire pour le lecteur d’empreintes branché au téléphone
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="dialogMotDePasse = true">
                <q-item-section avatar><q-icon name="lock_reset" /></q-item-section>
                <q-item-section>Changer mon mot de passe</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="deconnexion">
                <q-item-section avatar><q-icon name="logout" /></q-item-section>
                <q-item-section>Se déconnecter</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="menuOuvert" show-if-above bordered :width="264" class="index">
      <q-scroll-area class="fit">
        <q-list padding>
          <template v-for="(groupe, i) in menu" :key="i">
            <q-item-label v-if="groupe.liens.length" header class="pochoir index__titre">
              {{ groupe.titre }}
            </q-item-label>
            <q-item
              v-for="lien in groupe.liens"
              :key="lien.to"
              clickable
              :to="lien.to"
              :exact="lien.exact"
              class="index__lien"
            >
              <q-item-section avatar><q-icon :name="lien.icone" /></q-item-section>
              <q-item-section>{{ lien.libelle }}</q-item-section>
              <q-item-section v-if="lien.badge" side>
                <q-badge color="negative">{{ lien.badge }}</q-badge>
              </q-item-section>
            </q-item>
          </template>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- Changement de mot de passe -->
    <q-dialog v-model="dialogMotDePasse">
      <q-card style="min-width: 340px">
        <q-card-section class="text-h6">Changer mon mot de passe</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="ancien" type="password" label="Mot de passe actuel" outlined dense />
          <q-input v-model="nouveau" type="password" label="Nouveau mot de passe" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn color="primary" label="Valider" :loading="enregistrement" @click="changerMotDePasse" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useAuthStore } from '../stores/auth';
import { usePointagesStore } from '../stores/pointages';
import { LIBELLE_ROLE } from '../utils/libelles';
import { surAndroid } from '../services/empreinte';
import { api } from '../boot/axios';

const $q = useQuasar();
const dark = $q.dark;
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const pointages = usePointagesStore();

const menuOuvert = ref(false);
const dialogMotDePasse = ref(false);
const ancien = ref('');
const nouveau = ref('');
const enregistrement = ref(false);
const justificatifsEnAttente = ref(0);
const installable = ref(false);

const proposerApk = computed(
  () => /android/i.test(navigator.userAgent) && !surAndroid(),
);
let invite: any = null;

const titrePage = computed(() => route.meta.titre ?? '');

const menu = computed(() => {
  const r = auth.utilisateur?.role;
  const est = (...roles: string[]) => !!r && roles.includes(r);
  /**
   * Un lien n'apparaît que pour les rôles que la route accepte : la liste de
   * rôles écrite ici doit rester le miroir exact de `meta.roles` dans
   * router/routes.ts, sinon le lien renvoie l'utilisateur à son accueil.
   */
  const lien = (
    roles: string[] | null,
    to: string,
    icone: string,
    libelle: string,
    badge?: number,
  ) => (roles === null || est(...roles) ? [{ to, icone, libelle, badge, exact: false }] : []);

  const groupes = [
    // L'étudiant ouvre le panneau sur ce qui le concerne : sa rubrique passe
    // avant celles du personnel, qui pour lui sont toutes vides.
    {
      titre: 'Mon espace',
      liens: [
        ...lien(['ETUDIANT'], '/portail', 'person', 'Mon espace'),
        ...lien(['ETUDIANT'], '/emploi-du-temps', 'calendar_month', 'Emploi du temps'),
        ...lien(['ETUDIANT'], '/vod', 'play_circle', 'Cours en vidéo'),
        ...lien(['ETUDIANT'], '/ma-carte', 'badge', 'Ma carte étudiante'),
        ...lien(['ETUDIANT'], '/demandes-docs/mes', 'description', 'Mes demandes de documents'),
        ...lien(['ETUDIANT'], '/reclamations/mes', 'support_agent', 'Mes réclamations'),
        ...lien(['ETUDIANT'], '/elections/vote', 'how_to_vote', 'Voter'),
      ],
    },
    {
      titre: 'Suivi',
      liens: [
        ...lien(
          ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR', 'ENSEIGNANT'],
          '/',
          'dashboard',
          'Tableau de bord',
        ),
        ...lien(
          ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'],
          '/controle',
          'fact_check',
          'Contrôle des séances',
        ),
        ...lien(
          ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR', 'ENSEIGNANT'],
          '/seances',
          'event_note',
          'Séances',
        ),
        ...lien(['ENSEIGNANT'], '/mes-seances', 'person_pin', 'Mes séances'),
        // Les justificatifs sont un acte d'administration : l'enseignant
        // dépose, la scolarité enregistre, la direction arbitre. Le contrôleur
        // constate sur le terrain mais n'instruit pas.
        ...lien(
          ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'ENSEIGNANT'],
          '/justificatifs',
          'assignment_late',
          'Justificatifs d’absence',
          justificatifsEnAttente.value || undefined,
        ),
        ...lien(
          ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
          '/statistiques',
          'query_stats',
          'Statistiques',
        ),
      ],
    },
    {
      titre: 'Organisation',
      liens: [
        ...lien(
          ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR', 'ENSEIGNANT'],
          '/emploi-du-temps',
          'calendar_month',
          'Emploi du temps',
        ),
        ...lien(
          ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'],
          '/affectations',
          'assignment_ind',
          'Charges d’enseignement',
        ),
        ...lien(['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'], '/enseignants', 'person', 'Enseignants'),
        ...lien(['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION'], '/matieres', 'menu_book', 'Matières'),
        ...lien(['ADMIN', 'SCOLARITE', 'DIRECTION'], '/structure', 'account_tree', 'Structure académique'),
        ...lien(['ADMIN', 'SCOLARITE', 'DIRECTION', 'CONTROLEUR'], '/salles', 'meeting_room', 'Salles & QR'),
      ],
    },
    {
      titre: 'Scolarité',
      liens: [
        ...lien(['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'], '/etudiants', 'groups', 'Étudiants'),
        ...lien(['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'], '/inscriptions', 'how_to_reg', 'Inscriptions'),
        ...lien(['ADMIN', 'DIRECTION', 'SCOLARITE'], '/paiements', 'payments', 'Paiements'),
        ...lien(['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'], '/evaluations', 'fact_check', 'Évaluations'),
        ...lien(['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'], '/notes', 'edit_note', 'Saisie des notes'),
      ],
    },
    // De l'épreuve au diplôme : composer, tirer, scanner, délibérer, éditer.
    {
      titre: 'Examens & résultats',
      liens: [
        ...lien(['ADMIN', 'SCOLARITE', 'DIRECTION'], '/examens', 'quiz', 'Examens'),
        ...lien(
          ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT', 'CONTROLEUR'],
          '/examens/scan',
          'qr_code_scanner',
          'Scan examens',
        ),
        ...lien(['ADMIN', 'SCOLARITE'], '/tirage', 'local_printshop', 'Tirage des épreuves'),
        ...lien(
          ['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT'],
          '/deliberations',
          'gavel',
          'Délibérations',
        ),
        ...lien(['ADMIN', 'SCOLARITE', 'DIRECTION'], '/bulletins', 'school', 'Bulletins'),
        ...lien(['ADMIN', 'SCOLARITE', 'DIRECTION'], '/attestations', 'verified_user', 'Attestations'),
        ...lien(['ADMIN', 'DIRECTION'], '/plagiat', 'find_in_page', 'Anti-plagiat'),
      ],
    },
    // Le guichet : ce que l'étudiant demande et ce qu'on lui délivre.
    {
      titre: 'Guichet & documents',
      liens: [
        ...lien(['ADMIN', 'SCOLARITE', 'DIRECTION'], '/reclamations', 'support_agent', 'Réclamations & requêtes'),
        ...lien(['ADMIN', 'SCOLARITE'], '/demandes-docs', 'description', 'Demandes de documents'),
        ...lien(['ADMIN', 'SCOLARITE'], '/cartes-etudiantes', 'badge', 'Cartes étudiantes'),
        ...lien(['ADMIN', 'SCOLARITE'], '/badges', 'how_to_reg', 'Badges & visiteurs'),
      ],
    },
    {
      titre: 'Campus',
      liens: [
        ...lien(['ADMIN', 'DIRECTION', 'SCOLARITE'], '/cites', 'apartment', 'Cités universitaires'),
        ...lien(['ADMIN', 'DIRECTION', 'SCOLARITE', 'CONTROLEUR'], '/resto', 'restaurant', 'Resto numérique'),
        ...lien(
          ['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT'],
          '/bibliotheque-gestion',
          'local_library',
          'Bibliothèque numérique',
        ),
        ...lien(['ENSEIGNANT', 'ADMIN', 'SCOLARITE', 'DIRECTION'], '/vod', 'play_circle', 'VOD des cours'),
        ...lien(
          ['ADMIN', 'DIRECTION', 'SCOLARITE'],
          '/formations-admin',
          'workspace_premium',
          'Formation continue',
        ),
        ...lien(
          ['ADMIN', 'SCOLARITE', 'DIRECTION', 'ENSEIGNANT'],
          '/stages',
          'work',
          'Stages & mémoires',
        ),
        ...lien(
          ['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT', 'CONTROLEUR'],
          '/reservations',
          'event_seat',
          'Réservations de salles',
        ),
        ...lien(
          ['ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT', 'CONTROLEUR'],
          '/helpdesk',
          'headset_mic',
          'Support IT',
        ),
      ],
    },
    {
      titre: 'Vie universitaire',
      liens: [
        ...lien(['ADMIN', 'SCOLARITE', 'DIRECTION'], '/elections', 'how_to_vote', 'Élections'),
        ...lien(['ENSEIGNANT', 'CONTROLEUR', 'ADMIN'], '/elections/vote', 'ballot', 'Voter'),
      ],
    },
    {
      titre: 'Pilotage & administration',
      liens: [
        ...lien(
          ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
          '/rapports',
          'insights',
          'Rapports & états',
        ),
        ...lien(['ADMIN', 'DIRECTION'], '/statistiques-mesrs', 'analytics', 'Statistiques MESRS'),
        ...lien(['ADMIN', 'DIRECTION'], '/rectorat', 'account_balance', 'Tableau de bord Rectorat'),
        ...lien(['ADMIN', 'SCOLARITE', 'DIRECTION'], '/recettes', 'request_quote', 'Régie des recettes'),
        ...lien(['ADMIN', 'DIRECTION', 'SCOLARITE'], '/paie', 'payments', 'Paie des vacataires'),
        ...lien(['ADMIN', 'SCOLARITE', 'DIRECTION'], '/patrimoine', 'inventory_2', 'Patrimoine & matériel'),
        ...lien(
          ['ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT'],
          '/courrier',
          'mail',
          'Courrier administratif',
        ),
        ...lien(['ADMIN', 'DIRECTION', 'SCOLARITE'], '/notifications', 'sms', 'Notifications SMS'),
      ],
    },
    {
      titre: 'Paramétrage',
      liens: [
        ...lien(['ADMIN'], '/demandes-docs/tarifs', 'price_change', 'Tarifs des demandes'),
        ...lien(['ADMIN'], '/utilisateurs', 'manage_accounts', 'Utilisateurs'),
        ...lien(['ADMIN'], '/parametres', 'settings', 'Paramètres'),
      ],
    },
  ];

  /**
   * Un lien ne se surligne « exactement » que s'il chapeaute d'autres liens du
   * panneau (« /examens » face à « /examens/scan ») : ailleurs, la
   * correspondance large permet à la rubrique de rester allumée sur ses pages
   * de détail, comme « /plagiat » quand on lit une suspicion.
   */
  const adresses = groupes.flatMap((g) => g.liens.map((l) => l.to));
  for (const groupe of groupes) {
    for (const l of groupe.liens) {
      l.exact = l.to === '/' || adresses.some((a) => a.startsWith(`${l.to}/`));
    }
  }
  return groupes;
});

async function changerMotDePasse() {
  enregistrement.value = true;
  try {
    await auth.changerMotDePasse(ancien.value, nouveau.value);
    $q.notify({ type: 'positive', message: 'Mot de passe modifié' });
    dialogMotDePasse.value = false;
    ancien.value = nouveau.value = '';
  } finally {
    enregistrement.value = false;
  }
}

/**
 * Installation sur l'écran d'accueil. Le navigateur propose sa propre bannière,
 * mais elle passe inaperçue : la scolarité doit pouvoir installer l'application
 * sur le téléphone du contrôleur depuis l'application elle-même.
 */
function preparerInstallation() {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    invite = e as any;
    installable.value = true;
  });
  window.addEventListener('appinstalled', () => {
    installable.value = false;
    invite = null;
    $q.notify({ type: 'positive', message: 'UniPrésence est installée sur cet appareil' });
  });
}

async function installer() {
  if (!invite) return;
  await invite.prompt();
  const { outcome } = await invite.userChoice;
  if (outcome !== 'accepted') {
    $q.notify({
      message: 'Installation reportée',
      caption: 'Vous pourrez la relancer depuis ce menu.',
      icon: 'info',
    });
  }
  invite = null;
  installable.value = false;
}

function deconnexion() {
  auth.deconnexion();
  void router.push({ name: 'connexion' });
}

onMounted(async () => {
  document.documentElement.lang = 'fr';
  preparerInstallation();
  pointages.ecouterReseau();
  void pointages.synchroniser();
  try {
    const { data } = await api.get('/justificatifs', {
      params: { statut: 'EN_ATTENTE', pageSize: 1 },
    });
    justificatifsEnAttente.value = data.total;
  } catch {
    /* silencieux : simple indicateur */
  }
});
</script>

<style scoped lang="scss">
.entete {
  border-bottom: 3px solid var(--up-encre);
}

.entete__marque {
  // Corps « title » du système : la marque a le même poids dans les deux
  // enveloppes, publique et connectée.
  font-size: 1.22rem;
  line-height: 1.25; // laisse respirer l'accent de « UniPrésence »
  color: var(--up-craie-fixe);
}

.entete__page {
  margin-left: var(--up-3);
  color: var(--up-sur-bandeau);
  padding-left: var(--up-3);
  border-left: var(--up-filet-bandeau);
}

.index {
  // Même filet que toutes les séparations de régions du panneau.
  border-right: var(--up-filet);
}

.index__titre {
  color: var(--up-encre-douce);
  padding-top: var(--up-4);
  padding-bottom: var(--up-1);
}

.index__lien {
  border-bottom: var(--up-filet-fin);
  font-weight: 600;
}
</style>
