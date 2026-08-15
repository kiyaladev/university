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
              exact
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

  return [
    {
      titre: 'Suivi',
      liens: [
        { to: '/', icone: 'dashboard', libelle: 'Tableau de bord' },
        ...(auth.peutPointer
          ? [{ to: '/controle', icone: 'fact_check', libelle: 'Contrôle des séances' }]
          : []),
        { to: '/seances', icone: 'event_note', libelle: 'Séances' },
        ...(est('ENSEIGNANT')
          ? [{ to: '/mes-seances', icone: 'person_pin', libelle: 'Mes séances' }]
          : []),
        ...(auth.peutPointer
          ? [{ to: '/statistiques', icone: 'query_stats', libelle: 'Statistiques' }]
          : []),
        // Les justificatifs sont un acte d'administration : la scolarité les
        // enregistre, la direction arbitre. Le contrôleur n'y agit pas.
        ...(est('ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'ENSEIGNANT')
          ? [
              {
                to: '/justificatifs',
                icone: 'assignment_late',
                libelle: 'Justificatifs',
                badge: justificatifsEnAttente.value || undefined,
              },
            ]
          : []),
      ],
    },
    {
      titre: 'Organisation',
      liens: [
        { to: '/emploi-du-temps', icone: 'calendar_month', libelle: 'Emploi du temps' },
        ...(est('ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'DIRECTION')
          ? [
              { to: '/affectations', icone: 'assignment_ind', libelle: "Charges d'enseignement" },
              { to: '/enseignants', icone: 'school', libelle: 'Enseignants' },
              { to: '/matieres', icone: 'menu_book', libelle: 'Matières' },
            ]
          : []),
        ...(est('ADMIN', 'SCOLARITE', 'DIRECTION')
          ? [{ to: '/structure', icone: 'account_tree', libelle: 'Structure académique' }]
          : []),
        ...(est('ADMIN', 'SCOLARITE', 'DIRECTION', 'CONTROLEUR')
          ? [{ to: '/salles', icone: 'meeting_room', libelle: 'Salles & QR' }]
          : []),
      ],
    },
    {
      titre: 'Scolarité',
      liens: [
        ...(est('ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT')
          ? [
              { to: '/etudiants', icone: 'groups', libelle: 'Étudiants' },
              { to: '/inscriptions', icone: 'how_to_reg', libelle: 'Inscriptions' },
            ]
          : []),
        ...(est('ADMIN', 'DIRECTION', 'SCOLARITE')
          ? [
              { to: '/paiements', icone: 'payments', libelle: 'Paiements' },
              { to: '/evaluations', icone: 'fact_check', libelle: 'Évaluations' },
              { to: '/notes', icone: 'edit_note', libelle: 'Saisie des notes' },
              { to: '/deliberations', icone: 'how_to_vote', libelle: 'Délibérations' },
              { to: '/attestations', icone: 'verified_user', libelle: 'Attestations QR' },
            ]
          : []),
      ],
    },
    {
      titre: 'Pilotage',
      liens: [
        ...(est('ADMIN', 'DIRECTION', 'SCOLARITE', 'CHEF_DEPARTEMENT')
          ? [{ to: '/rapports', icone: 'insights', libelle: 'Rapports & états' }]
          : []),
        ...(est('ADMIN', 'DIRECTION', 'SCOLARITE')
          ? [{ to: '/paie', icone: 'payments', libelle: 'Paie des vacataires' }]
          : []),
        ...(est('ADMIN', 'DIRECTION', 'SCOLARITE')
          ? [{ to: '/notifications', icone: 'sms', libelle: 'Notifications SMS' }]
          : []),
        ...(est('ADMIN')
          ? [
              { to: '/utilisateurs', icone: 'manage_accounts', libelle: 'Utilisateurs' },
              { to: '/parametres', icone: 'settings', libelle: 'Paramètres' },
            ]
          : []),
      ],
    },
    {
      titre: 'Étudiant',
      liens: [
        ...(est('ETUDIANT')
          ? [{ to: '/portail', icone: 'person', libelle: 'Mon espace' }]
          : []),
      ],
    },
    {
      titre: 'Campus',
      liens: [
        ...(est('ADMIN', 'DIRECTION', 'SCOLARITE')
          ? [
              { to: '/cites', icone: 'apartment', libelle: 'Cités universitaires' },
              { to: '/formations-admin', icone: 'workspace_premium', libelle: 'Formation continue' },
            ]
          : []),
        ...(est('ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT')
          ? [{ to: '/bibliotheque-gestion', icone: 'local_library', libelle: 'Bibliothèque numérique' }]
          : []),
        ...(est('ADMIN', 'DIRECTION', 'SCOLARITE', 'CONTROLEUR')
          ? [{ to: '/resto', icone: 'restaurant', libelle: 'Resto numérique' }]
          : []),
        ...(est('ADMIN', 'DIRECTION', 'SCOLARITE', 'ENSEIGNANT', 'CONTROLEUR')
          ? [
              { to: '/reservations', icone: 'event_seat', libelle: 'Salles & réservations' },
              { to: '/stages', icone: 'work', libelle: 'Stages & mémoires' },
              { to: '/helpdesk', icone: 'support_agent', libelle: 'Support IT' },
            ]
          : []),
      ],
    },
  ];
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
  font-size: 1.35rem;
  line-height: 1.25; // laisse respirer l'accent de « UniPrésence »
  color: #fff;
}

.entete__page {
  margin-left: var(--up-3);
  color: rgba(255, 255, 255, 0.74);
  padding-left: var(--up-3);
  border-left: 1px solid rgba(255, 255, 255, 0.34);
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
