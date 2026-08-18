<template>
  <!--
    Cette page est montée hors de tout layout (route attrape-tout de
    router/routes.ts) : elle ne peut pas utiliser <q-page>, qui exige un
    QLayout parent, et porte donc elle-même son cadre et sa navigation.
  -->
  <main class="introuvable">
    <div class="introuvable__bandes" aria-hidden="true">
      <span class="bande bande--rouge" />
      <span class="bande bande--jaune" />
      <span class="bande bande--vert" />
    </div>

    <p class="pochoir introuvable__code">Erreur 404</p>
    <h1 class="lettrage introuvable__titre">Page introuvable</h1>
    <p class="introuvable__texte">
      L’adresse <strong class="introuvable__adresse">{{ adresse }}</strong> ne
      correspond à aucune page d’UniPrésence. Le lien est peut-être périmé, ou
      la rubrique a changé de nom.
    </p>

    <div class="introuvable__actions">
      <q-btn
        unelevated
        color="primary"
        no-caps
        size="lg"
        :icon="auth.connecte ? 'home' : 'login'"
        :label="auth.connecte ? 'Retour à mon accueil' : 'Se connecter'"
        @click="retour"
      />
      <q-btn
        v-if="!auth.connecte"
        outline
        no-caps
        size="lg"
        icon="phone_android"
        label="Portail étudiant"
        to="/portail-connexion"
      />
      <q-btn v-else flat no-caps size="lg" icon="logout" label="Se déconnecter" @click="seDeconnecter" />
    </div>

    <nav class="introuvable__services" aria-label="Pages accessibles sans compte">
      <p class="pochoir introuvable__services-titre">Sans compte</p>
      <ul class="introuvable__liens">
        <li><router-link to="/s-inscrire" class="introuvable__lien">Se préinscrire en ligne →</router-link></li>
        <li><router-link to="/formations" class="introuvable__lien">Formation continue →</router-link></li>
        <li><router-link to="/bibliotheque" class="introuvable__lien">Bibliothèque numérique →</router-link></li>
        <li><router-link to="/verification" class="introuvable__lien">Vérifier une attestation →</router-link></li>
        <li><router-link to="/verification-carte" class="introuvable__lien">Vérifier une carte étudiante →</router-link></li>
      </ul>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const adresse = computed(() => route.fullPath);

/** L'étudiant rentre chez lui, le personnel au tableau de bord, le visiteur à la porte. */
function retour() {
  if (!auth.connecte) return void router.push('/connexion');
  void router.push(auth.role === 'ETUDIANT' ? '/portail' : '/');
}

function seDeconnecter() {
  auth.deconnexion();
  void router.push('/connexion');
}
</script>

<style scoped lang="scss">
.introuvable {
  min-height: 100vh;
  background: var(--up-chaux);
  color: var(--up-encre);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--up-3);
  padding: var(--up-6) var(--up-4);
  max-width: 640px;
  margin-inline: auto;
}

// Les bandes du panneau : hors enseigne, la page les peint elle-même.
.introuvable__bandes {
  display: flex;
  height: 14px;
  max-width: 220px;

  .bande { flex: 1; }
  .bande--rouge { background: $rouge; }
  .bande--jaune { background: $jaune; }
  .bande--vert { background: $vert; }
}

.introuvable__code {
  margin: 0;
  color: var(--up-encre-douce);
}

.introuvable__titre {
  font-size: clamp(2.2rem, 1.6rem + 3vw, 3.4rem);
  margin: 0;
}

.introuvable__texte {
  margin: 0;
  line-height: 1.55;
  max-width: 52ch;
}

.introuvable__adresse {
  word-break: break-all;
}

.introuvable__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--up-2);
  margin-top: var(--up-2);
}

.introuvable__services {
  border-top: var(--up-filet-fin);
  padding-top: var(--up-3);
  margin-top: var(--up-2);
}

.introuvable__services-titre {
  margin: 0 0 var(--up-2);
  color: var(--up-encre-douce);
}

.introuvable__liens {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-1);
  font-size: 0.9rem;
}

.introuvable__lien {
  color: var(--up-encre-douce);
  text-decoration: none;

  &:hover,
  &:focus-visible { color: var(--up-encre); text-decoration: underline; }
}
</style>
