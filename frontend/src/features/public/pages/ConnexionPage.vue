<template>
  <q-page class="acces">
    <!-- L'enseigne : le panneau que l'on voit avant d'entrer -->
    <section class="enseigne">
      <p class="pochoir enseigne__sur-titre">{{ $t('loginPage.signage.overline') }}</p>
      <h1 class="lettrage enseigne__marque">{{ $t('loginPage.signage.brand') }}</h1>
      <p class="enseigne__phrase">
        {{ $t('loginPage.signage.tagline') }}
      </p>

      <dl class="enseigne__faits">
        <div>
          <dt class="pochoir">{{ $t('loginPage.signage.facts.offline.label') }}</dt>
          <dd>{{ $t('loginPage.signage.facts.offline.text') }}</dd>
        </div>
        <div>
          <dt class="pochoir">{{ $t('loginPage.signage.facts.opposable.label') }}</dt>
          <dd>{{ $t('loginPage.signage.facts.opposable.text') }}</dd>
        </div>
      </dl>
    </section>

    <!-- La plaque d'accès -->
    <section class="acces__plaque">
      <h2 class="lettrage acces__titre">{{ $t('loginPage.access.title') }}</h2>
      <p class="acces__intro">
        {{ $t('loginPage.access.intro') }}
        <router-link to="/portail-connexion" class="acces__lien-lien">
          {{ $t('loginPage.access.studentPortalLink') }} </router-link
        >.
      </p>

      <q-form class="acces__form" @submit.prevent="connexion">
        <q-input
          v-model="email"
          type="email"
          :label="$t('loginPage.form.emailLabel')"
          outlined
          autofocus
          autocomplete="username"
          :rules="[(v) => !!v || $t('loginPage.form.emailRequired')]"
        >
          <template #prepend><q-icon name="mail" /></template>
        </q-input>

        <q-input
          v-model="motDePasse"
          :type="voirMotDePasse ? 'text' : 'password'"
          :label="$t('loginPage.form.passwordLabel')"
          outlined
          autocomplete="current-password"
          :rules="[(v) => !!v || $t('loginPage.form.passwordRequired')]"
        >
          <template #prepend><q-icon name="lock" /></template>
          <template #append>
            <q-btn
              flat
              dense
              round
              :icon="voirMotDePasse ? 'visibility_off' : 'visibility'"
              :aria-label="voirMotDePasse ? $t('loginPage.form.hidePassword') : $t('loginPage.form.showPassword')"
              @click="voirMotDePasse = !voirMotDePasse"
            />
          </template>
        </q-input>

        <q-banner v-if="erreur" class="acces__erreur" role="alert" aria-live="assertive">
          <template #avatar><q-icon name="error" /></template>
          {{ erreur }}
        </q-banner>

        <q-btn
          type="submit"
          color="primary"
          class="full-width acces__bouton"
          size="lg"
          unelevated
          no-caps
          :label="$t('loginPage.form.submit')"
          :loading="auth.chargement"
        />
      </q-form>

      <q-separator class="acces__separateur" />

      <!-- Services ouverts sans compte : un visiteur ne doit pas rester bloqué ici. -->
      <nav class="acces__services" :aria-label="$t('loginPage.services.ariaLabel')">
        <p class="pochoir acces__services-titre">{{ $t('loginPage.services.title') }}</p>
        <ul class="acces__liens">
          <li>
            <router-link to="/portail-connexion" class="acces__lien-lien">
              {{ $t('loginPage.services.links.portailSms') }}
            </router-link>
          </li>
          <li>
            <router-link to="/s-inscrire" class="acces__lien-lien">
              {{ $t('loginPage.services.links.preinscription') }}
            </router-link>
          </li>
          <li v-if="services.autorise('/formations')">
            <router-link to="/formations" class="acces__lien-lien">
              {{ $t('loginPage.services.links.formationContinue') }}
            </router-link>
          </li>
          <li v-if="services.autorise('/bibliotheque')">
            <router-link to="/bibliotheque" class="acces__lien-lien">
              {{ $t('loginPage.services.links.bibliotheque') }}
            </router-link>
          </li>
          <li>
            <router-link to="/verification" class="acces__lien-lien">
              {{ $t('loginPage.services.links.verifierAttestation') }}
            </router-link>
          </li>
          <li v-if="services.autorise('/verification-carte')">
            <router-link to="/verification-carte" class="acces__lien-lien">
              {{ $t('loginPage.services.links.verifierCarte') }}
            </router-link>
          </li>
        </ul>
      </nav>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useServicesActifsStore } from '@/stores/servicesActifs';
const services = useServicesActifsStore();
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { accueilParRole } from '@/shared/utils/accueil';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

const email = ref('');
const motDePasse = ref('');
const voirMotDePasse = ref(false);
const erreur = ref('');

/** Le back renvoie parfois un tableau de messages de validation. */
function messageErreur(e: any): string {
  const message = e?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' · ');
  return message ?? t('loginPage.errors.default');
}

async function connexion() {
  erreur.value = '';
  try {
    const utilisateur = await auth.connexion(email.value, motDePasse.value);
    const suite = route.query.suite as string | undefined;
    if (suite) return router.push(suite);
    // Chaque rôle atterrit sur sa page d'entrée : tournée, séances, portail.
    return router.push(accueilParRole(utilisateur.role));
  } catch (e: any) {
    erreur.value = messageErreur(e);
  }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.acces {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  min-height: 100vh;
  background: var(--up-chaux);
}

// -------------------------------------------------------------- enseigne
.enseigne {
  @include enseignePlaque;
}

.enseigne__bandes {
  display: flex;
  height: 14px;
  max-width: 320px;
}

.enseigne__sur-titre {
  color: var(--up-encre-tertiaire);
  margin: 0;
}

.enseigne__marque {
  font-size: clamp(2.8rem, 1.8rem + 5vw, 5.2rem);
  margin: 0;
}

.enseigne__phrase {
  font-size: 1.05rem;
  line-height: 1.55;
  max-width: 46ch;
  color: var(--up-encre-douce);
  margin: 0;
}

.enseigne__faits {
  display: grid;
  gap: var(--up-3);
  margin: 0;
  border-top: var(--up-filet);
  padding-top: var(--up-3);

  dt {
    color: var(--up-encre-tertiaire);
  }
  dd {
    margin: 3px 0 0;
    font-size: 0.92rem;
  }
}

// ---------------------------------------------------------------- accès
.acces__plaque {
  padding: var(--up-6) var(--up-5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 480px;
  width: 100%;
  margin-inline: auto;
}

.acces__titre {
  font-size: 2rem;
  letter-spacing: -0.022em;
  margin: 0 0 var(--up-2);
  padding-bottom: 0;
  border-bottom: 0;
}

.acces__intro {
  margin: 0 0 var(--up-4);
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--up-encre-douce);
}

.acces__form {
  display: grid;
  gap: var(--up-3);
}

.acces__bouton {
  min-height: 56px;
}

// L'erreur se teinte. Un aplat rouge pleine largeur au moment d'une faute de
// frappe est une punition, pas une information.
.acces__erreur {
  background: $rouge-fond;
  color: #{$rouge};
  border: 0;
  border-radius: var(--up-rayon);
}

.acces__separateur {
  margin: var(--up-4) 0 var(--up-3);
}

.acces__services-titre {
  margin: 0 0 var(--up-2);
  color: var(--up-encre-douce);
}

.acces__liens {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-1);
  font-size: 0.9rem;
}

.acces__lien-lien {
  color: var(--up-encre-douce);
  text-decoration: underline;

  &:hover,
  &:focus-visible {
    color: var(--up-encre);
    text-decoration: underline;
  }
}

@media (max-width: 1023px) {
  .acces {
    grid-template-columns: 1fr;
  }

  .enseigne {
    padding: var(--up-5) var(--up-4);
    gap: var(--up-3);
  }

  .enseigne__faits {
    display: none;
  }

  .acces__plaque {
    padding: var(--up-5) var(--up-4) var(--up-6);
  }
}
</style>
