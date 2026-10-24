<template>
  <q-layout view="hHh LpR fFf">
    <q-header class="bandeau entete">
      <q-toolbar>
        <q-btn dense flat round icon="menu" :aria-label="t('layout.openMenu')" @click="menuOuvert = !menuOuvert" />

        <q-toolbar-title class="row items-center no-wrap">
          <span class="lettrage entete__marque">{{ $t('common.app.name') }}</span>
          <span class="pochoir entete__page gt-sm">{{ titrePage }}</span>
        </q-toolbar-title>

        <!-- Synchronisation des pointages hors ligne -->
        <q-btn
          v-if="pointages.enAttente || seancesHorsLigne.enAttente"
          flat
          dense
          no-caps
          icon="cloud_upload"
          :label="t('layout.toSync', { n: pointages.enAttente + seancesHorsLigne.enAttente })"
          :loading="pointages.synchronisation || seancesHorsLigne.synchronisation"
          @click="dialogPointages = true"
        />
        <q-chip v-if="!pointages.enLigne" dense color="warning" text-color="black" icon="cloud_off">
          {{ t('layout.offline') }}
        </q-chip>

        <q-btn flat round dense :aria-label="t('layout.myAccount')">
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
            <q-list dense role="presentation">
              <q-item-label header>{{ t('layout.preferences') }}</q-item-label>
              <div class="column q-px-md q-pb-sm">
                <q-btn flat dense no-caps align="left" icon="translate" :label="t('layout.changerLangue')">
                  <q-tooltip>{{ t('layout.changerLangue') }}</q-tooltip>
                  <q-menu>
                    <q-list dense role="menu">
                      <q-item
                        v-for="option in LANGUES"
                        :key="option.code"
                        v-close-popup
                        clickable
                        :active="localeCourante === option.code"
                        @click="changerLangue(option.code)"
                      >
                        <q-item-section>{{ option.libelle }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>

                <q-btn
                  v-close-popup
                  flat
                  dense
                  no-caps
                  align="left"
                  :icon="dark.isActive ? 'light_mode' : 'dark_mode'"
                  :label="t('layout.basculerTheme')"
                  @click="dark.toggle()"
                >
                  <q-tooltip>{{ t('layout.basculerTheme') }}</q-tooltip>
                </q-btn>
              </div>
              <q-item v-if="installable" clickable v-close-popup @click="installer">
                <q-item-section avatar><q-icon name="install_mobile" /></q-item-section>
                <q-item-section>
                  <q-item-label>{{ t('layout.install') }}</q-item-label>
                  <q-item-label caption>{{ t('layout.installHelp') }}</q-item-label>
                </q-item-section>
              </q-item>
              <!-- L'application Android n'a de sens que sur Android, et pas
                   depuis l'application elle-même. -->
              <q-item v-if="proposerApk" clickable v-close-popup tag="a" href="/telechargement/university.apk">
                <q-item-section avatar><q-icon name="android" /></q-item-section>
                <q-item-section>
                  <q-item-label>{{ t('layout.downloadAndroid') }}</q-item-label>
                  <q-item-label caption>
                    {{ t('layout.androidHelp') }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="dialogMotDePasse = true">
                <q-item-section avatar><q-icon name="lock_reset" /></q-item-section>
                <q-item-section>{{ t('layout.changePassword') }}</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="deconnexion">
                <q-item-section avatar><q-icon name="logout" /></q-item-section>
                <q-item-section>{{ t('common.actions.logout') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="menuOuvert" show-if-above bordered :width="264" class="index">
      <q-scroll-area class="fit">
        <q-list padding role="navigation" :aria-label="t('layout.openMenu')">
          <div class="index__recherche">
            <q-input v-model="rechercheMenu" outlined dense clearable type="search" :label="t('layout.searchModules')">
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </div>
          <template v-if="raccourcisVisibles.length">
            <div class="index__repere">{{ t('layout.frequentTasks') }}</div>
            <q-item
              v-for="lien in raccourcisVisibles"
              :key="lien.to"
              :to="lien.to"
              :exact="lien.exact"
              :active="familles[lien.to]?.includes(route.path) || undefined"
              class="index__lien"
              @click="avantNavigationMenu"
            >
              <q-item-section avatar><q-icon :name="lien.icone" /></q-item-section>
              <q-item-section>{{ lien.libelle }}</q-item-section>
              <q-item-section v-if="lien.badge" side
                ><q-badge color="negative">{{ lien.badge }}</q-badge></q-item-section
              >
            </q-item>
            <q-separator class="q-my-sm" />
          </template>
          <q-expansion-item
            v-for="groupe in rubriquesVisibles"
            :key="groupe.id"
            :label="groupe.titre"
            :icon="groupe.icone"
            :model-value="!!rechercheMenu || rubriqueOuverte === groupe.id"
            @update:model-value="ouvrirRubrique(groupe.id, $event)"
            header-class="index__titre"
          >
            <template v-for="(lien, indexLien) in groupe.liens" :key="lien.to">
              <q-item-label
                v-if="lien.section && (indexLien === 0 || groupe.liens[indexLien - 1].section !== lien.section)"
                header
                class="index__section"
                >{{ lien.section }}</q-item-label
              >
              <q-item
                clickable
                :to="lien.to"
                :exact="lien.exact"
                :active="familles[lien.to]?.includes(route.path) || undefined"
                class="index__lien"
                @click="avantNavigationMenu"
              >
                <q-item-section avatar><q-icon :name="lien.icone" /></q-item-section>
                <q-item-section>{{ lien.libelle }}</q-item-section>
                <q-item-section v-if="services.pilote(lien.to)" side
                  ><q-badge color="warning" text-color="dark"
                    >{{ t('servicesActifs.pilotShort') }}<q-tooltip>{{ t('servicesActifs.pilot') }}</q-tooltip></q-badge
                  ></q-item-section
                >
                <q-item-section v-if="lien.badge" side>
                  <q-badge color="negative">{{ lien.badge }}</q-badge>
                </q-item-section>
              </q-item>
            </template>
          </q-expansion-item>
          <div v-if="!raccourcisVisibles.length && !rubriquesVisibles.length" class="index__vide" role="status">
            {{ t('layout.noModule') }}
          </div>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <q-banner v-if="pointages.ancienneFile && auth.peutPointer" class="bg-orange-1 text-dark">{{
        t('filePointages.legacy')
      }}</q-banner>
      <router-view />
    </q-page-container>

    <pointages-en-attente v-model="dialogPointages" />

    <!-- Changement de mot de passe -->
    <q-dialog v-model="dialogMotDePasse">
      <q-card style="width: 380px; max-width: 95vw">
        <q-card-section class="text-h6">{{ t('layout.changePassword') }}</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input v-model="ancien" type="password" :label="t('layout.currentPassword')" outlined dense />
          <q-input v-model="nouveau" type="password" :label="t('layout.newPassword')" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.actions.cancel')" v-close-popup />
          <q-btn color="primary" :label="t('layout.confirm')" :loading="enregistrement" @click="changerMotDePasse" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useServicesActifsStore } from '../stores/servicesActifs';
import PointagesEnAttente from '@/features/presence/components/PointagesEnAttente.vue';
import { usePointagesStore } from '../stores/pointages';
import { useSeancesStore } from '../stores/seances';
import { LIBELLE_ROLE } from '@/shared/utils/libelles';
import { surAndroid } from '@/shared/services/empreinte';
import { api } from '../boot/axios';
import { titreRoute } from '@/shared/utils/titreRoute';
import { FAMILLES, menuPour, raccourcisPour } from '../navigation/menu';
import { getAppLocale, setAppLocale, type AppLocale } from '../boot/i18n';

const $q = useQuasar();
const dark = $q.dark;
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const services = useServicesActifsStore();
const pointages = usePointagesStore();
const seancesHorsLigne = useSeancesStore();

const menuOuvert = ref(false);
const rechercheMenu = ref('');
const rubriqueOuverte = ref<string | null>(null);
const dialogMotDePasse = ref(false);
const dialogPointages = ref(false);
const ancien = ref('');
const nouveau = ref('');
const enregistrement = ref(false);
const justificatifsEnAttente = ref(0);
const installable = ref(false);

/**
 * Invite d'installation que le navigateur déclenche (`beforeinstallprompt`).
 * L'événement n'est pas dans les types du DOM : on en décrit le minimum.
 */
interface InviteInstallation {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// `university.apk` est publié dans /telechargement/ (scripts/apk.sh, docs/android.md).
const APK_PUBLIE = true;
const proposerApk = computed(() => APK_PUBLIE && /android/i.test(navigator.userAgent) && !surAndroid());
let invite: InviteInstallation | null = null;

const { t } = useI18n();
const titrePage = computed(() => titreRoute(route.meta.titre));

// La langue se choisit dans l'interface : `setAppLocale` était écrit mais
// jamais appelé, si bien que l'application restait en français pour de bon.
const LANGUES = [
  { code: 'fr-FR' as AppLocale, libelle: 'Français' },
  { code: 'en-US' as AppLocale, libelle: 'English' },
];
const localeCourante = computed(() => getAppLocale());
function changerLangue(code: AppLocale) {
  setAppLocale(code);
}

/**
 * Le menu se déduit du manifeste de navigation (navigation/manifeste.ts) :
 * rôles, rubriques, intertitres, ordre et services y sont déclarés une fois,
 * et la route porte les mêmes rôles, si bien qu'un lien ne peut pas renvoyer
 * l'utilisateur à son accueil.
 */
const menu = computed(() =>
  menuPour(auth.utilisateur?.role ?? null, services.services, (cle) => t(cle)).map((rubrique) => ({
    id: rubrique.id,
    titre: t(rubrique.titre),
    icone: rubrique.icone,
    liens: rubrique.liens.map((lien) => ({
      to: lien.path,
      icone: lien.icone,
      libelle: titreRoute(lien.titre),
      badge: lien.path === '/justificatifs' ? justificatifsEnAttente.value || undefined : undefined,
      exact: lien.exact,
      section: lien.section ? t(lien.section) : '',
    })),
  })),
);

const raccourcis = computed(() => {
  const tous = menu.value.flatMap((groupe) => groupe.liens);
  return raccourcisPour(auth.utilisateur?.role ?? null).flatMap((to) => tous.filter((lien) => lien.to === to));
});
const familles = FAMILLES;
const normaliserRecherche = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
const rechercheNormalisee = computed(() => normaliserRecherche(rechercheMenu.value || ''));
const raccourcisVisibles = computed(() =>
  raccourcis.value.filter((lien) => normaliserRecherche(lien.libelle).includes(rechercheNormalisee.value)),
);
const rubriquesVisibles = computed(() => {
  const rapides = new Set(raccourcis.value.map((lien) => lien.to));
  return menu.value
    .map((groupe) => ({
      ...groupe,
      liens: groupe.liens.filter(
        (lien) =>
          !rapides.has(lien.to) &&
          normaliserRecherche(`${groupe.titre} ${lien.libelle}`).includes(rechercheNormalisee.value),
      ),
    }))
    .filter((groupe) => groupe.liens.length);
});
function ouvrirRubrique(id: string, ouverte: boolean) {
  if (!rechercheMenu.value)
    rubriqueOuverte.value = ouverte ? id : rubriqueOuverte.value === id ? null : rubriqueOuverte.value;
}
function fermerMenuMobile() {
  if ($q.screen.lt.md) menuOuvert.value = false;
}
function avantNavigationMenu() {
  rechercheMenu.value = '';
  fermerMenuMobile();
}
watch(
  () => route.path,
  (path) => {
    rechercheMenu.value = '';
    const lienActif = menu.value
      .flatMap((groupe) => groupe.liens)
      .filter(
        (lien) =>
          path === lien.to || familles[lien.to]?.includes(path) || (!lien.exact && path.startsWith(`${lien.to}/`)),
      )
      .sort((a, b) => b.to.length - a.to.length)[0];
    rubriqueOuverte.value =
      rubriquesVisibles.value.find((groupe) => groupe.liens.some((lien) => lien.to === lienActif?.to))?.id ?? null;
  },
  { immediate: true },
);

async function changerMotDePasse() {
  enregistrement.value = true;
  try {
    await auth.changerMotDePasse(ancien.value, nouveau.value);
    $q.notify({ type: 'positive', message: t('layout.passwordChanged') });
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
    invite = e as unknown as InviteInstallation;
    installable.value = true;
  });
  window.addEventListener('appinstalled', () => {
    installable.value = false;
    invite = null;
    $q.notify({ type: 'positive', message: t('layout.installed', { name: t('common.app.name') }) });
  });
}

async function installer() {
  if (!invite) return;
  await invite.prompt();
  const { outcome } = await invite.userChoice;
  if (outcome !== 'accepted') {
    $q.notify({
      message: t('layout.installDeferred'),
      caption: t('layout.installDeferredHint'),
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

// L'écoute réseau survit au démontage tant qu'on ne la retire pas : le store
// est unique mais ce composant part et revient à chaque page publique, et les
// doublons d'écoute rejouaient `synchroniser()` à chaque remontée.
let arreterEcouteReseau: (() => void) | null = null;

onBeforeUnmount(() => {
  arreterEcouteReseau?.();
  arreterEcouteReseau = null;
});

onMounted(async () => {
  preparerInstallation();
  try {
    await pointages.initialiser();
  } catch {
    $q.notify({ type: 'negative', message: t('filePointages.keyUnavailable') });
  }
  arreterEcouteReseau = pointages.ecouterReseau();
  void pointages.synchroniser();
  if (!auth.role || !router.resolve('/justificatifs').meta.roles?.includes(auth.role)) return;
  try {
    const { data } = await api.get('/justificatifs', {
      params: { statut: 'EN_ATTENTE', pageSize: 1 },
      silencieux: true,
    });
    justificatifsEnAttente.value = data.total;
  } catch {
    /* silencieux : simple indicateur */
  }
});
</script>

<style scoped lang="scss">
// La barre de tête est une chrome translucide (§12) : le filet du bas la
// termine, il ne la souligne pas. `.bandeau` porte le flou et le fond.
.entete {
  min-height: 48px;
}

.entete :deep(.q-toolbar) {
  min-height: 48px;
}

.entete__marque {
  // Corps « title » du système : la marque a le même poids dans les deux
  // enveloppes, publique et connectée.
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.021em;
  line-height: 1.3; // laisse respirer les lettres de « University »
  color: var(--up-craie-fixe);
}

// Le titre de page suit la marque en gris : c'est un fil d'Ariane, pas un
// second titre. Le filet vertical qui les séparait n'a plus lieu d'être —
// l'air suffit.
.entete__page {
  margin-left: var(--up-2);
  color: var(--up-sur-bandeau);
  font-size: 1.0625rem;
  letter-spacing: -0.021em;

  &::before {
    content: '/';
    margin-right: var(--up-2);
    color: var(--up-encre-tertiaire);
  }
}

.index {
  border-right: var(--up-filet-bandeau);
  background: var(--up-chaux);
}

// La rubrique de l'index : la petite capitale grise d'une barre latérale
// système, assez discrète pour qu'on lise les liens d'abord.
.index__titre {
  color: var(--up-encre-tertiaire);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
  padding: var(--up-2) var(--up-3);
}

.index__recherche {
  padding: var(--up-1) var(--up-2) var(--up-2);
}
.index__section {
  color: var(--up-encre-douce);
}
.index__repere {
  padding: var(--up-2) var(--up-3);
  font-size: 12px;
  color: var(--up-encre-douce);
  font-weight: 600;
}
.index__vide {
  padding: var(--up-3);
  color: var(--up-encre-douce);
}

// Un lien d'index n'est pas cerné : il est une pastille qui se remplit au
// survol, comme dans une barre latérale de Réglages.
.index__lien {
  border-bottom: 0;
  font-weight: 400;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}

body.body--dark .index__lien:hover {
  background: rgba(255, 255, 255, 0.06);
}
body.body--dark .index__lien.q-item--active {
  color: var(--up-encre);
}
</style>
