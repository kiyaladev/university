<template>
  <q-page class="acces">
    <!-- L'enseigne : le panneau que l'on voit avant d'entrer -->
    <section class="enseigne">
      <div class="enseigne__bandes" aria-hidden="true">
        <span class="bande bande--rouge" />
        <span class="bande bande--jaune" />
        <span class="bande bande--vert" />
      </div>

      <p class="pochoir enseigne__sur-titre">Personnel de l’université</p>
      <h1 class="lettrage enseigne__marque">UniPrésence</h1>
      <p class="enseigne__phrase">
        Le registre du contrôleur, salle par salle : il relève la séance, fait
        signer ou poser le doigt à l’enseignant, et l’heure est consignée.
      </p>

      <dl class="enseigne__faits">
        <div>
          <dt class="pochoir">Sur le terrain</dt>
          <dd>Pointage hors ligne, synchronisé au retour du réseau</dd>
        </div>
        <div>
          <dt class="pochoir">Opposable</dt>
          <dd>Horodatage serveur, moyen d’attestation consigné, corrections tracées</dd>
        </div>
      </dl>
    </section>

    <!-- La plaque d'accès -->
    <section class="acces__plaque">
      <h2 class="lettrage acces__titre">Connexion</h2>
      <p class="acces__intro">
        Réservée au personnel de l’université — contrôleurs, scolarité,
        enseignants, direction. Vous êtes étudiant ?
        <router-link to="/portail-connexion" class="acces__lien-lien">
          Entrez par le portail étudiant
        </router-link>.
      </p>

      <q-form class="acces__form" @submit.prevent="connexion">
        <q-input
          v-model="email"
          type="email"
          label="Adresse e-mail"
          outlined
          autofocus
          autocomplete="username"
          :rules="[(v) => !!v || 'Saisissez votre adresse e-mail']"
        >
          <template #prepend><q-icon name="mail" /></template>
        </q-input>

        <q-input
          v-model="motDePasse"
          :type="voirMotDePasse ? 'text' : 'password'"
          label="Mot de passe"
          outlined
          autocomplete="current-password"
          :rules="[(v) => !!v || 'Saisissez votre mot de passe']"
        >
          <template #prepend><q-icon name="lock" /></template>
          <template #append>
            <q-btn
              flat
              dense
              round
              :icon="voirMotDePasse ? 'visibility_off' : 'visibility'"
              :aria-label="voirMotDePasse ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
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
          label="Se connecter"
          :loading="auth.chargement"
        />
      </q-form>

      <q-expansion-item
        v-if="afficherDemo"
        dense
        icon="badge"
        label="Comptes de démonstration"
        class="acces__demo"
      >
        <q-list separator dense>
          <q-item v-for="c in comptesDemo" :key="c.email" clickable @click="prefill(c.email)">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ c.libelle }}</q-item-label>
              <q-item-label caption>{{ c.email }}</q-item-label>
            </q-item-section>
            <q-item-section side><q-icon name="east" /></q-item-section>
          </q-item>
        </q-list>
        <p class="pochoir acces__mot-demo">Mot de passe commun : Passer@2026</p>
      </q-expansion-item>

      <q-separator class="acces__separateur" />

      <!-- Services ouverts sans compte : un visiteur ne doit pas rester bloqué ici. -->
      <nav class="acces__services" aria-label="Services accessibles sans compte">
        <p class="pochoir acces__services-titre">Sans compte</p>
        <ul class="acces__liens">
          <li>
            <router-link to="/portail-connexion" class="acces__lien-lien">
              Portail étudiant (connexion par SMS) →
            </router-link>
          </li>
          <li>
            <router-link to="/s-inscrire" class="acces__lien-lien">
              Se préinscrire en ligne →
            </router-link>
          </li>
          <li>
            <router-link to="/formations" class="acces__lien-lien">
              Formation continue →
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
          <li>
            <router-link to="/verification-carte" class="acces__lien-lien">
              Vérifier une carte étudiante →
            </router-link>
          </li>
        </ul>
      </nav>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import type { Role } from '../types';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const motDePasse = ref('');
const voirMotDePasse = ref(false);
const erreur = ref('');

/** Les comptes de démonstration n'apparaissent qu'en mode dev. */
const afficherDemo = import.meta.env.DEV;

const comptesDemo = [
  { libelle: 'Contrôleur pédagogique', email: 'controleur1@unipresence.gn' },
  { libelle: 'Direction des études', email: 'direction@unipresence.gn' },
  { libelle: 'Scolarité', email: 'scolarite@unipresence.gn' },
  { libelle: 'Chef de département', email: 'chef.info@unipresence.gn' },
  { libelle: 'Enseignant', email: 'enseignant@unipresence.gn' },
  { libelle: 'Administrateur', email: 'admin@unipresence.gn' },
];

function prefill(adresse: string) {
  email.value = adresse;
  motDePasse.value = 'Passer@2026';
}

/** Le back renvoie parfois un tableau de messages de validation. */
function messageErreur(e: any): string {
  const message = e?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' · ');
  return message ?? 'Adresse e-mail ou mot de passe incorrect.';
}

async function connexion() {
  erreur.value = '';
  try {
    const utilisateur = await auth.connexion(email.value, motDePasse.value);
    const suite = route.query.suite as string | undefined;
    if (suite) return router.push(suite);
    // Chaque rôle atterrit sur sa page d'entrée : tournée, séances, portail.
    const routeParRole: Partial<Record<Role, string>> = {
      CONTROLEUR: '/controle',
      ENSEIGNANT: '/mes-seances',
      ETUDIANT: '/portail',
    };
    return router.push(routeParRole[utilisateur.role] ?? '/');
  } catch (e: any) {
    erreur.value = messageErreur(e);
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
  margin: 0 0 var(--up-4);
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

.acces__demo {
  margin-top: var(--up-4);
  border-top: var(--up-filet-fin);
}

.acces__mot-demo {
  color: var(--up-encre-douce);
  padding: 0 var(--up-3) var(--up-3);
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
