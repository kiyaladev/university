<template>
  <q-page class="acces">
    <!-- L'enseigne : le panneau que l'on voit avant d'entrer -->
    <section class="enseigne">
      <p class="pochoir enseigne__sur-titre">{{ $t('portailConnexion.banner.overTitle') }}</p>
      <h1 class="lettrage enseigne__marque">{{ $t('common.app.name') }}</h1>
      <p class="enseigne__phrase">
        {{ $t('portailConnexion.banner.tagline') }}
      </p>

      <dl class="enseigne__faits">
        <div>
          <dt class="pochoir">{{ $t('portailConnexion.banner.facts.noPassword.title') }}</dt>
          <dd>{{ $t('portailConnexion.banner.facts.noPassword.text') }}</dd>
        </div>
        <div>
          <dt class="pochoir">{{ $t('portailConnexion.banner.facts.confidential.title') }}</dt>
          <dd>{{ $t('portailConnexion.banner.facts.confidential.text') }}</dd>
        </div>
        <div>
          <dt class="pochoir">{{ $t('portailConnexion.banner.facts.verifiable.title') }}</dt>
          <dd>{{ $t('portailConnexion.banner.facts.verifiable.text') }}</dd>
        </div>
      </dl>
    </section>

    <!-- La plaque d'accès -->
    <section class="acces__plaque">
      <h2 class="lettrage acces__titre">
        {{ codeDemande ? $t('portailConnexion.panel.titleCode') : $t('portailConnexion.panel.titlePortal') }}
      </h2>

      <!-- Étape 1 : le numéro -->
      <q-form v-if="!codeDemande" class="acces__form" @submit.prevent="demanderCode">
        <p class="acces__intro">
          {{ $t('portailConnexion.step1.intro') }}
          <router-link to="/connexion" class="acces__lien-lien">
            {{ $t('portailConnexion.step1.introLink') }}
          </router-link>.
        </p>

        <q-input
          v-model="telephone"
          type="tel"
          inputmode="tel"
          :label="$t('portailConnexion.step1.phoneLabel')"
          outlined
          autofocus
          autocomplete="tel"
          :rules="[(v) => !!v || $t('portailConnexion.step1.phoneRule')]"
        >
          <template #prepend><q-icon name="phone_android" /></template>
        </q-input>
        <p class="pochoir acces__aide">
          {{ $t('portailConnexion.step1.phoneHint') }}
        </p>

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
          :label="$t('portailConnexion.step1.submit')"
          :loading="envoi"
        />
      </q-form>

      <!-- Étape 2 : le code reçu -->
      <q-form v-else class="acces__form" @submit.prevent="entrer">
        <q-banner class="note--info" role="status" aria-live="polite">
          <template #avatar><q-icon name="sms" /></template>
          <i18n-t keypath="portailConnexion.step2.smsSent" tag="span">
            <template #telephone><strong class="chiffres">{{ telephone }}</strong></template>
          </i18n-t>
        </q-banner>

        <q-input
          v-model="code"
          mask="######"
          inputmode="numeric"
          autocomplete="one-time-code"
          :label="$t('portailConnexion.step2.codeLabel')"
          outlined
          autofocus
          :error="!!erreur"
          :error-message="erreur"
          :rules="[(v) => !!v || $t('portailConnexion.step2.codeRule')]"
        >
          <template #prepend><q-icon name="dialpad" /></template>
        </q-input>
        <p class="pochoir acces__aide">
          {{ $t('portailConnexion.step2.codeHint') }}
        </p>

        <q-btn
          type="submit"
          color="primary"
          class="full-width acces__bouton"
          size="lg"
          unelevated
          no-caps
          :label="$t('portailConnexion.step2.submit')"
          :loading="auth.chargement"
        />

        <div class="acces__retour">
          <q-btn flat dense no-caps icon="chevron_left" :label="$t('portailConnexion.step2.changeNumber')" @click="reinitialiser" />
          <q-btn flat dense no-caps icon="refresh" :label="$t('portailConnexion.step2.resendCode')" :loading="envoi" @click="demanderCode" />
        </div>
      </q-form>

      <q-separator class="acces__separateur" />

      <!-- Services ouverts sans compte : personne ne doit rester bloqué ici. -->
      <nav class="acces__services" :aria-label="$t('portailConnexion.otherAccess.ariaLabel')">
        <p class="pochoir acces__services-titre">{{ $t('portailConnexion.otherAccess.title') }}</p>
        <ul class="acces__liens">
          <li>
            <router-link to="/connexion" class="acces__lien-lien">
              {{ $t('portailConnexion.otherAccess.staffLogin') }}
            </router-link>
          </li>
          <li>
            <router-link to="/s-inscrire" class="acces__lien-lien">
              {{ $t('portailConnexion.otherAccess.preregister') }}
            </router-link>
          </li>
          <li>
            <router-link to="/bibliotheque" class="acces__lien-lien">
              {{ $t('portailConnexion.otherAccess.library') }}
            </router-link>
          </li>
          <li>
            <router-link to="/verification" class="acces__lien-lien">
              {{ $t('portailConnexion.otherAccess.verifyAttestation') }}
            </router-link>
          </li>
        </ul>
      </nav>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';

const $q = useQuasar();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const telephone = ref('');
const code = ref('');
const erreur = ref('');
const envoi = ref(false);
const codeDemande = ref(false);

function messageErreur(e: any): string {
  const donnees = e?.response?.data?.message;
  return Array.isArray(donnees) ? donnees.join(' · ') : donnees ?? t('portailConnexion.messages.genericError');
}

function reinitialiser() {
  codeDemande.value = false;
  code.value = '';
  erreur.value = '';
}

async function demanderCode() {
  if (!telephone.value.trim()) {
    erreur.value = t('portailConnexion.step1.phoneRule');
    return;
  }
  const renvoi = codeDemande.value;
  erreur.value = '';
  envoi.value = true;
  try {
    // La réponse est volontairement identique pour un numéro connu ou non :
    // le portail ne révèle jamais quels numéros figurent au registre.
    await api.post('/portail/otp', { telephone: telephone.value }, { silencieux: true });
    erreur.value = '';
    code.value = '';
    codeDemande.value = true;
    if (renvoi) {
      $q.notify({ type: 'positive', message: t('portailConnexion.messages.codeResent') });
    }
  } catch (e: any) {
    erreur.value = messageErreur(e);
  } finally {
    envoi.value = false;
  }
}

async function entrer() {
  erreur.value = '';
  try {
    const utilisateur = await auth.connexionOtp(telephone.value, code.value);
    if (!utilisateur) return;
    // La garde de routes renseigne `suite` avec la page demandée : un lien
    // profond vers une rubrique précis perdait ici sa destination.
    const suite = route.query.suite as string | undefined;
    await router.push(suite ?? '/portail');
  } catch (e: any) {
    code.value = '';
    erreur.value = messageErreur(e) || t('portailConnexion.messages.invalidCode');
  }
}
</script>

<style scoped lang="scss">
@use '../css/mixins' as *;

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

  dt { color: var(--up-encre-tertiaire); }
  dd { margin: 3px 0 0; font-size: 0.92rem; }
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
  font-size: 1.7rem;
  margin: 0 0 var(--up-3);
  padding-bottom: var(--up-2);
  border-bottom: var(--up-filet);
}

.acces__intro {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--up-encre-douce);
}

.acces__form {
  display: grid;
  gap: var(--up-3);
}

.acces__bouton { min-height: 56px; }

.acces__erreur {
  background: $rouge-fond;
  color: #{$rouge};
  border: 0;
  border-radius: var(--up-rayon);
}

.acces__aide {
  color: var(--up-encre-douce);
  margin: -4px 0 0;
}

.acces__retour {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--up-2);
}

.acces__separateur { margin: var(--up-4) 0 var(--up-3); }

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
  text-decoration: none;

  &:hover,
  &:focus-visible { color: var(--up-encre); text-decoration: underline; }
}

@media (max-width: 1023px) {
  .acces {
    grid-template-columns: 1fr;
  }

  .enseigne {
    padding: var(--up-5) var(--up-4);
    gap: var(--up-3);
  }

  .enseigne__faits { display: none; }

  .acces__plaque { padding: var(--up-5) var(--up-4) var(--up-6); }
}
</style>
