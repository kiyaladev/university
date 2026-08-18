<template>
  <q-page class="acces">
    <!-- L'enseigne : le panneau que l'on voit avant d'entrer -->
    <section class="enseigne">
      <div class="enseigne__bandes" aria-hidden="true">
        <span class="bande bande--rouge" />
        <span class="bande bande--jaune" />
        <span class="bande bande--vert" />
      </div>

      <p class="pochoir enseigne__sur-titre">Espace étudiant</p>
      <h1 class="lettrage enseigne__marque">UniPrésence</h1>
      <p class="enseigne__phrase">
        Le portail étudiant : votre inscription, vos paiements, vos résultats
        et vos attestations — sans mot de passe, juste votre numéro de
        téléphone enregistré à la scolarité.
      </p>

      <dl class="enseigne__faits">
        <div>
          <dt class="pochoir">Sans mot de passe</dt>
          <dd>Un code reçu par SMS à chaque connexion, valable quelques minutes</dd>
        </div>
        <div>
          <dt class="pochoir">Confidentiel</dt>
          <dd>Vos résultats ne sont jamais montrés à un autre étudiant</dd>
        </div>
        <div>
          <dt class="pochoir">Vérifiable</dt>
          <dd>Vos attestations portent un QR code contrôlable par n'importe qui</dd>
        </div>
      </dl>
    </section>

    <!-- La plaque d'accès -->
    <section class="acces__plaque">
      <h2 class="lettrage acces__titre">
        {{ codeDemande ? 'Code de vérification' : 'Portail étudiant' }}
      </h2>

      <!-- Étape 1 : le numéro -->
      <q-form v-if="!codeDemande" class="acces__form" @submit.prevent="demanderCode">
        <p class="acces__intro">
          Réservé aux étudiants inscrits. Vous êtes membre du personnel ?
          <router-link to="/connexion" class="acces__lien-lien">
            Connectez-vous avec votre e-mail
          </router-link>.
        </p>

        <q-input
          v-model="telephone"
          type="tel"
          inputmode="tel"
          label="Numéro de téléphone"
          outlined
          autofocus
          autocomplete="tel"
          :rules="[(v) => !!v || 'Saisissez votre numéro de téléphone']"
        >
          <template #prepend><q-icon name="phone_android" /></template>
        </q-input>
        <p class="pochoir acces__aide">
          Le numéro porté sur votre fiche d'inscription (ex. 622 000 001)
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
          label="Recevoir un code par SMS"
          :loading="envoi"
        />
      </q-form>

      <!-- Étape 2 : le code reçu -->
      <q-form v-else class="acces__form" @submit.prevent="entrer">
        <q-banner class="note--info" role="status" aria-live="polite">
          <template #avatar><q-icon name="sms" /></template>
          Si ce numéro figure au registre, un code à 6 chiffres vient d'être
          envoyé au <strong class="chiffres">{{ telephone }}</strong>.
        </q-banner>

        <q-input
          v-model="code"
          mask="######"
          inputmode="numeric"
          autocomplete="one-time-code"
          label="Code reçu par SMS"
          outlined
          autofocus
          :error="!!erreur"
          :error-message="erreur"
          :rules="[(v) => !!v || 'Saisissez le code à 6 chiffres reçu par SMS']"
        >
          <template #prepend><q-icon name="dialpad" /></template>
        </q-input>
        <p class="pochoir acces__aide">
          Le code ne se réutilise pas et expire après quelques minutes
        </p>

        <q-btn
          type="submit"
          color="primary"
          class="full-width acces__bouton"
          size="lg"
          unelevated
          no-caps
          label="Entrer dans mon espace"
          :loading="auth.chargement"
        />

        <div class="acces__retour">
          <q-btn flat dense no-caps icon="chevron_left" label="Changer de numéro" @click="reinitialiser" />
          <q-btn flat dense no-caps icon="refresh" label="Renvoyer le code" :loading="envoi" @click="demanderCode" />
        </div>
      </q-form>

      <q-separator class="acces__separateur" />

      <!-- Services ouverts sans compte : personne ne doit rester bloqué ici. -->
      <nav class="acces__services" aria-label="Autres accès">
        <p class="pochoir acces__services-titre">Autres accès</p>
        <ul class="acces__liens">
          <li>
            <router-link to="/connexion" class="acces__lien-lien">
              Connexion du personnel (e-mail + mot de passe) →
            </router-link>
          </li>
          <li>
            <router-link to="/s-inscrire" class="acces__lien-lien">
              Pas encore étudiant ? Se préinscrire en ligne →
            </router-link>
          </li>
          <li>
            <router-link to="/bibliotheque" class="acces__lien-lien">
              Bibliothèque numérique →
            </router-link>
          </li>
          <li>
            <router-link to="/verification" class="acces__lien-lien">
              Vérifier une attestation →
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
import { useRouter } from 'vue-router';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const telephone = ref('');
const code = ref('');
const erreur = ref('');
const envoi = ref(false);
const codeDemande = ref(false);

function messageErreur(e: any): string {
  const donnees = e?.response?.data?.message;
  return Array.isArray(donnees) ? donnees.join(' · ') : donnees ?? 'Impossible de terminer, réessayez.';
}

function reinitialiser() {
  codeDemande.value = false;
  code.value = '';
  erreur.value = '';
}

async function demanderCode() {
  if (!telephone.value.trim()) {
    erreur.value = 'Saisissez votre numéro de téléphone';
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
      $q.notify({ type: 'positive', message: 'Un nouveau code vient d’être envoyé par SMS.' });
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
    if (utilisateur) await router.push('/portail');
  } catch (e: any) {
    code.value = '';
    erreur.value = messageErreur(e) || 'Code incorrect ou expiré — demandez un nouveau code.';
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
  color: rgba(250, 250, 247, 0.6);
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
  color: rgba(250, 250, 247, 0.88);
  margin: 0;
}

.enseigne__faits {
  display: grid;
  gap: var(--up-3);
  margin: 0;
  border-top: 2px solid rgba(250, 250, 247, 0.35);
  padding-top: var(--up-3);

  dt { color: rgba(250, 250, 247, 0.66); }
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
  border-bottom: 3px solid var(--up-encre);
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
  background: $rouge;
  color: #fff;
  border: 2px solid var(--up-encre);
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