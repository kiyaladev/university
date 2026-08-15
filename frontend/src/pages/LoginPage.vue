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
      <h2 class="lettrage acces__titre">Accès au registre</h2>

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
          label="Ouvrir ma tournée"
          :loading="auth.chargement"
        />
      </q-form>

      <q-expansion-item dense icon="badge" label="Comptes de démonstration" class="acces__demo">
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
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const motDePasse = ref('');
const voirMotDePasse = ref(false);
const erreur = ref('');

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

async function connexion() {
  erreur.value = '';
  try {
    const utilisateur = await auth.connexion(email.value, motDePasse.value);
    const suite = route.query.suite as string | undefined;
    if (suite) return router.push(suite);
    // Le contrôleur arrive directement sur sa tournée du jour.
    return router.push(utilisateur.role === 'CONTROLEUR' ? '/controle' : '/');
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? 'Identifiants incorrects';
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

.acces__demo {
  margin-top: var(--up-4);
  border-top: var(--up-filet-fin);
}

.acces__mot-demo {
  color: var(--up-encre-douce);
  padding: 0 var(--up-3) var(--up-3);
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
