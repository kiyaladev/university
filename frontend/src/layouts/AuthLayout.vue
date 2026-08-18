<template>
  <q-layout view="lHh Lpr lFf">
    <q-header class="auth-entete">
      <q-toolbar class="auth-entete__barre">
        <q-toolbar-title class="auth-entete__marque">
          <router-link to="/connexion" class="auth-entete__logo lettrage">
            UniPrésence
          </router-link>
        </q-toolbar-title>
        <q-space />

        <!-- Sur écran large, les guichets publics sont tous à portée de vue. -->
        <nav class="auth-entete__liens gt-sm" aria-label="Services publics">
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
        <q-btn flat dense no-caps icon="menu" label="Services" class="lt-md" aria-label="Services publics">
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
        <span class="pochoir">UniPrésence — services publics de l’université</span>
        <q-space />
        <router-link to="/connexion" class="pochoir auth-pied__lien">Espace personnel</router-link>
      </div>
    </q-footer>
  </q-layout>
</template>

<script setup lang="ts">
/**
 * Enveloppe des écrans ouverts au public. Ils n'ont pas le panneau latéral de
 * l'application : c'est cette barre qui doit énumérer *tous* les guichets
 * publics, sans quoi la préinscription et les vérifications de documents ne
 * sont accessibles qu'en connaissant leur adresse par cœur.
 *
 * Toute route marquée `meta.public` dans router/routes.ts doit figurer ici.
 */
const liens = [
  { libelle: 'Connexion', vers: '/connexion', icone: 'login', aide: 'Personnel de l’université' },
  {
    libelle: 'Portail étudiant',
    vers: '/portail-connexion',
    icone: 'person',
    aide: 'Connexion par SMS',
  },
  {
    libelle: 'Préinscription',
    vers: '/s-inscrire',
    icone: 'how_to_reg',
    aide: 'Déposer une candidature',
  },
  {
    libelle: 'Bibliothèque',
    vers: '/bibliotheque',
    icone: 'local_library',
    aide: 'Consulter le fonds numérique',
  },
  {
    libelle: 'Formations',
    vers: '/formations',
    icone: 'workspace_premium',
    aide: 'Catalogue de la formation continue',
  },
  {
    libelle: 'Vérifier une attestation',
    vers: '/verification',
    icone: 'verified',
    aide: 'Contrôler un document par son code',
  },
  {
    libelle: 'Vérifier une carte',
    vers: '/verification-carte',
    icone: 'badge',
    aide: 'Contrôler une carte étudiante',
  },
  {
    libelle: 'Vérifier un badge',
    vers: '/verification-badge',
    icone: 'how_to_reg',
    aide: 'Contrôler un badge d’accès',
  },
];
</script>

<style scoped lang="scss">
.auth-entete {
  background: var(--up-plaque);
  color: var(--up-encre);
  min-height: 56px;
  border-bottom: 3px solid var(--up-encre);
}

.auth-entete__barre {
  min-height: 56px;
  padding: 0 var(--up-4);
}

// Même corps que la marque du panneau connecté : c'est le même produit.
.auth-entete__marque {
  font-size: 1.22rem;
}

.auth-entete__logo {
  color: inherit;
  text-decoration: none;
  letter-spacing: 0.04em;
}

.auth-entete__liens {
  display: flex;
  gap: var(--up-4);
  align-items: center;
}

.auth-entete__lien {
  color: inherit;
  text-decoration: none;
  font-size: 0.92rem;
  padding: 4px 0;
  border-bottom: 2px solid transparent;
}

.auth-entete__lien:hover {
  border-bottom-color: var(--up-encre);
}

.auth-entete__lien--actif {
  font-weight: 700;
  border-bottom-color: var(--up-encre);
}

.auth-pied {
  background: var(--up-encre);
  color: var(--up-craie);
}

.auth-pied__contenu {
  display: flex;
  align-items: center;
  gap: var(--up-3);
  padding: var(--up-2) var(--up-4);
}

.auth-pied__lien {
  color: inherit;
  text-decoration: underline;
}
</style>
