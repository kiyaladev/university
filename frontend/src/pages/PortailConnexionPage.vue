<template>
  <q-page class="acces">
    <!-- L'enseigne : le panneau que l'on voit avant d'entrer -->
    <section class="enseigne">
      <div class="enseigne__bandes" aria-hidden="true">
        <span class="bande bande--rouge" />
        <span class="bande bande--jaune" />
        <span class="bande bande--vert" />
      </div>

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
      <h2 class="lettrage acces__titre">{{ codeDemande ? 'Vérification' : 'Accès au portail' }}</h2>

      <!-- Étape 1 : le numéro -->
      <q-form v-if="!codeDemande" class="acces__form" @submit.prevent="demanderCode">
        <q-input
          v-model="telephone"
          type="tel"
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

        <q-banner v-if="erreur" class="acces__erreur">
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
        <q-input
          v-model="code"
          mask="######"
          label="Code reçu par SMS"
          outlined
          autofocus
          :error="!!erreur"
          :rules="[(v) => !!v || 'Saisissez le code à 6 chiffres reçu par SMS']"
        >
          <template #prepend><q-icon name="dialpad" /></template>
        </q-input>
        <p class="pochoir acces__aide">
          Le code ne se réutilise pas et expire après quelques minutes
        </p>

        <q-banner v-if="erreur" class="acces__erreur">
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
          label="Entrer dans mon espace"
          :loading="auth.chargement"
        />

        <div class="acces__retour">
          <q-btn flat dense no-caps icon="chevron_left" label="Changer de numéro" @click="reinitialiser" />
          <q-btn flat dense no-caps icon="refresh" label="Renvoyer le code" :loading="envoi" @click="demanderCode" />
        </div>
      </q-form>

      <q-separator class="acces__separateur" />

      <p class="pochoir acces__lien">
        <router-link to="/connexion" class="acces__lien-lien">
          Accès personnel (adresse e-mail + mot de passe) →
        </router-link>
      </p>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';

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
  erreur.value = '';
  envoi.value = true;
  try {
    // La réponse est volontairement identique pour un numéro connu ou non :
    // le portail ne révèle jamais quels numéros figurent au registre.
    await api.post('/portail/otp', { telephone: telephone.value }, { silencieux: true } as never);
    erreur.value = '';
    codeDemande.value = true;
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
    erreur.value = messageErreur(e);
  }
}
</script>

<style scoped lang="scss">
.acces {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  min-height: 100vh;
  background: var(--up-chaux);
}

// -------------------------------------------------------------- enseigne
.enseigne {
  background: $encre;
  color: $blanc-craie;
  padding: var(--up-6) var(--up-5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--up-4);
  background-image: repeating-linear-gradient(
    92deg,
    rgba(255, 255, 255, 0.045) 0 2px,
    rgba(255, 255, 255, 0) 2px 5px
  );
}

.enseigne__bandes {
  display: flex;
  height: 14px;
  max-width: 320px;
}

.bande { flex: 1; }
.bande--rouge { background: $rouge; }
.bande--jaune { background: $jaune; }
.bande--vert { background: $vert; }

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
  margin: 0 0 var(--up-4);
  padding-bottom: var(--up-2);
  border-bottom: 3px solid var(--up-encre);
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

.acces__lien { margin: 0; }

.acces__lien-lien {
  color: var(--up-encre-douce);
  text-decoration: none;

  &:hover { color: var(--up-encre); }
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