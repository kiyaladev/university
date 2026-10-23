<template>
  <!--
    Cette page est montée hors de tout layout (route attrape-tout de
    router/routes.ts) : elle ne peut pas utiliser <q-page>, qui exige un
    QLayout parent, et porte donc elle-même son cadre et sa navigation.
  -->
  <main class="introuvable">
    <p class="pochoir introuvable__code">{{ $t('errorNotFound.code') }}</p>
    <h1 class="lettrage introuvable__titre">{{ $t('errorNotFound.title') }}</h1>
    <p class="introuvable__texte">
      <i18n-t keypath="errorNotFound.text" tag="span">
        <template #adresse><strong class="introuvable__adresse">{{ adresse }}</strong></template>
      </i18n-t>
    </p>

    <div class="introuvable__actions">
      <q-btn
        unelevated
        color="primary"
        no-caps
        size="lg"
        :icon="auth.connecte ? 'home' : 'login'"
        :label="auth.connecte ? $t('errorNotFound.actions.backHome') : $t('errorNotFound.actions.login')"
        @click="retour"
      />
      <q-btn
        v-if="!auth.connecte"
        outline
        no-caps
        size="lg"
        icon="phone_android"
        :label="$t('errorNotFound.actions.studentPortal')"
        to="/portail-connexion"
      />
      <q-btn v-else flat no-caps size="lg" icon="logout" :label="$t('common.actions.logout')" @click="seDeconnecter" />
    </div>

    <nav class="introuvable__services" :aria-label="$t('errorNotFound.services.ariaLabel')">
      <p class="pochoir introuvable__services-titre">{{ $t('errorNotFound.services.title') }}</p>
      <ul class="introuvable__liens">
        <li><router-link to="/s-inscrire" class="introuvable__lien">{{ $t('errorNotFound.services.preinscription') }}</router-link></li>
        <li><router-link to="/formations" class="introuvable__lien">{{ $t('errorNotFound.services.formationContinue') }}</router-link></li>
        <li><router-link to="/bibliotheque" class="introuvable__lien">{{ $t('errorNotFound.services.bibliotheque') }}</router-link></li>
        <li><router-link to="/verification" class="introuvable__lien">{{ $t('errorNotFound.services.verification') }}</router-link></li>
        <li><router-link to="/verification-carte" class="introuvable__lien">{{ $t('errorNotFound.services.verificationCarte') }}</router-link></li>
      </ul>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

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
@use '@/css/mixins' as *;
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

// Hors enseigne, la page pose elle-même le filet du drapeau.
.introuvable::before { @include filetDrapeau; }

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
