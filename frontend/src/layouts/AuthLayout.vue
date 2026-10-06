<template>
  <q-layout view="lHh Lpr lff">
    <q-header class="auth-entete">
      <q-toolbar class="auth-entete__barre">
        <q-toolbar-title class="auth-entete__marque">
          <router-link to="/connexion" class="auth-entete__logo lettrage">
            {{ $t('common.app.name') }}
          </router-link>
        </q-toolbar-title>
        <q-space />

        <!-- Sur écran large, les guichets publics sont tous à portée de vue. -->
        <nav class="auth-entete__liens gt-sm" :aria-label="$t('layout.publicNav.services')">
          <router-link
            v-for="l in liens"
            :key="l.vers"
            :to="l.vers"
            class="auth-entete__lien"
            active-class="auth-entete__lien--actif"
          >
            {{ l.libelle }}
          </router-link>
        </nav>

        <!-- Sur téléphone, la même liste tient dans un seul bouton. -->
        <q-btn flat dense no-caps icon="menu" :label="$t('layout.publicNav.menu')" class="lt-md" :aria-label="$t('layout.publicNav.services')">
          <q-menu>
            <q-list style="min-width: 230px">
              <q-item
                v-for="l in liens"
                :key="l.vers"
                clickable
                v-close-popup
                :to="l.vers"
                exact
              >
                <q-item-section avatar><q-icon :name="l.icone" /></q-item-section>
                <q-item-section>
                  <q-item-label>{{ l.libelle }}</q-item-label>
                  <q-item-label caption>{{ l.aide }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer class="auth-pied">
      <div class="auth-pied__contenu">
        <span class="pochoir">{{ $t('layout.publicNav.footer') }}</span>
        <q-space />
        <router-link to="/connexion" class="pochoir auth-pied__lien">{{ $t('layout.publicNav.personalArea') }}</router-link>
      </div>
    </q-footer>
  </q-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServicesActifsStore } from '../stores/servicesActifs';
/**
 * Enveloppe des écrans ouverts au public. Ils n'ont pas le panneau latéral de
 * l'application : c'est cette barre qui doit énumérer *tous* les guichets
 * publics, sans quoi la préinscription et les vérifications de documents ne
 * sont accessibles qu'en connaissant leur adresse par cœur.
 *
 * Toute route marquée `meta.public` dans router/routes.ts doit figurer ici.
 */
const { t } = useI18n();
const services = useServicesActifsStore();
const liens = computed(() => [
  { libelle: t('layout.publicNav.staffLogin'), vers: '/connexion', icone: 'login', aide: t('layout.publicNav.staffLoginHelp') },
  {
    libelle: t('layout.publicNav.studentPortal'),
    vers: '/portail-connexion',
    icone: 'person',
    aide: t('layout.publicNav.smsLogin'),
  },
  {
    libelle: t('layout.publicNav.preRegistration'),
    vers: '/s-inscrire',
    icone: 'how_to_reg',
    aide: t('layout.publicNav.submitApplication'),
  },
  {
    libelle: t('layout.publicNav.library'),
    vers: '/bibliotheque',
    icone: 'local_library',
    aide: t('layout.publicNav.digitalCollection'),
  },
  {
    libelle: t('layout.publicNav.training'),
    vers: '/formations',
    icone: 'workspace_premium',
    aide: t('layout.publicNav.trainingCatalog'),
  },
  {
    libelle: t('layout.publicNav.verifyCertificate'),
    vers: '/verification',
    icone: 'verified',
    aide: t('layout.publicNav.verifyByCode'),
  },
  {
    libelle: t('layout.publicNav.verifyCard'),
    vers: '/verification-carte',
    icone: 'badge',
    aide: t('layout.publicNav.verifyStudentCard'),
  },
  {
    libelle: t('layout.publicNav.verifyBadge'),
    vers: '/verification-badge',
    icone: 'how_to_reg',
    aide: t('layout.publicNav.verifyAccessBadge'),
  },
].filter(lien => services.autorise(lien.vers)));
</script>

<style scoped lang="scss">
// La barre publique est la même chrome translucide que celle du panneau
// connecté (§12) : le contenu défile dessous, un filet d'un cheveu la termine.
.auth-entete {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  color: var(--up-encre);
  min-height: 48px;
  border-bottom: var(--up-filet-bandeau);
}

body.body--dark .auth-entete {
  background: rgba(29, 29, 31, 0.72);
}

@media (prefers-reduced-transparency: reduce) {
  .auth-entete {
    background: var(--up-plaque);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.auth-entete__barre {
  min-height: 48px;
  padding: 0 var(--up-4);
}

// Même corps que la marque du panneau connecté : c'est le même produit.
.auth-entete__marque {
  font-size: 1.0625rem;
  flex: 0 0 auto;
  overflow: visible;
}

.auth-entete__logo {
  color: inherit;
  text-decoration: none;
  font-weight: 600;
  letter-spacing: -0.021em;
}

.auth-entete__liens {
  display: flex;
  gap: var(--up-4);
  align-items: center;
}

// Un lien de barre système est gris et devient encre au survol. Le trait
// dessous — 2px d'encre — appartenait au panneau peint.
.auth-entete__lien {
  color: var(--up-encre-douce);
  text-decoration: none;
  font-size: 0.75rem;
  letter-spacing: -0.01em;
  padding: 4px 0;
  transition: color var(--up-transition-rapide);
}

.auth-entete__lien:hover {
  color: var(--up-encre);
  text-decoration: none;
}

.auth-entete__lien--actif {
  color: var(--up-encre);
  font-weight: 590;
}

// Le pied d'Apple : un gris légèrement plus soutenu que la page, du texte
// petit et gris, aucun aplat d'encre.
.auth-pied {
  background: var(--up-chaux);
  color: var(--up-encre-douce);
  border-top: var(--up-filet-bandeau);
}

.auth-pied__contenu {
  display: flex;
  align-items: center;
  gap: var(--up-3);
  padding: var(--up-3) var(--up-4);
}

.auth-pied__lien {
  color: var(--up-vert-lien);
  text-decoration: none;

  &:hover { text-decoration: underline; }
}
</style>
