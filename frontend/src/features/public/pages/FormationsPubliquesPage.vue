<template>
  <q-page class="vitrine">
    <!-- L'en-tête public (AuthLayout) porte les liens du site ; ici on n'ajoute
         que l'entrée vers l'espace de travail, utile au personnel. -->
    <q-btn
      flat
      dense
      no-caps
      icon="login"
      :label="$t('common.actions.login')"
      to="/connexion"
      class="vitrine__connexion"
    />
    <!-- L'enseigne du hub : ce que voit l'acheteur avant la vitrine -->
    <section class="vitrine__enseigne">
      <p class="pochoir vitrine__sur-titre">{{ $t('formationsPubliques.hero.overline') }}</p>
      <h1 class="lettrage vitrine__marque">{{ $t('formationsPubliques.hero.title') }}</h1>
      <p class="vitrine__phrase">
        {{ $t('formationsPubliques.hero.text') }}
      </p>

      <dl class="vitrine__faits">
        <div>
          <dt class="pochoir">{{ $t('formationsPubliques.hero.facts.noAccount.title') }}</dt>
          <dd>{{ $t('formationsPubliques.hero.facts.noAccount.text') }}</dd>
        </div>
        <div>
          <dt class="pochoir">{{ $t('formationsPubliques.hero.facts.mobileMoney.title') }}</dt>
          <dd>{{ $t('formationsPubliques.hero.facts.mobileMoney.text') }}</dd>
        </div>
        <div>
          <dt class="pochoir">{{ $t('formationsPubliques.hero.facts.attestation.title') }}</dt>
          <dd>{{ $t('formationsPubliques.hero.facts.attestation.text') }}</dd>
        </div>
      </dl>
    </section>

    <!-- La vitrine -->
    <section class="vitrine__catalogue">
      <div class="vitrine__catalogue-tete">
        <h2 class="lettrage vitrine__titre">{{ $t('formationsPubliques.catalogue.title') }}</h2>
        <p class="pochoir vitrine__compte">
          {{ $t('formationsPubliques.catalogue.count', { count: formations.length }) }}
        </p>
      </div>

      <q-banner v-if="chargement" class="note--info">
        <template #avatar><q-spinner size="20px" /></template>
        {{ $t('formationsPubliques.catalogue.loading') }}
      </q-banner>

      <etat-vide
        v-if="!chargement && !formations.length"
        icone="storefront"
        :titre="$t('formationsPubliques.catalogue.empty')"
      />

      <div class="vitrine__grille">
        <carte-formation-publique
          v-for="f in formations"
          :key="f.id"
          :formation="f"
          @inscrire="ouvrirInscription(f)"
        />
      </div>
    </section>

    <!-- Demande d'inscription -->
    <dialogue-inscription-formation v-model="dialogInscription" :formation="selection" />
  </q-page>
</template>

<script setup lang="ts">
/**
 * Vitrine publique de la formation continue : même objet « formation » que
 * l'écran de gestion `/formations-admin`, mais restreint côté serveur aux
 * formations publiées. Tout passe par `formationsService`.
 */
import { onMounted, ref } from 'vue';
import { formationsService, type FormationVitrine } from '@/shared/services/formations';
import EtatVide from '@/shared/components/EtatVide.vue';
import CarteFormationPublique from '@/features/public/components/CarteFormationPublique.vue';
import DialogueInscriptionFormation from '@/features/public/components/DialogueInscriptionFormation.vue';

const formations = ref<FormationVitrine[]>([]);
const chargement = ref(true);

const dialogInscription = ref(false);
const selection = ref<FormationVitrine | null>(null);

async function charger() {
  chargement.value = true;
  try {
    const { data } = await formationsService.publiques();
    formations.value = Array.isArray(data) ? data : [];
  } catch {
    // L'intercepteur axios affiche le motif ; le catalogue reste vide.
    formations.value = [];
  } finally {
    chargement.value = false;
  }
}

function ouvrirInscription(f: FormationVitrine) {
  selection.value = f;
  dialogInscription.value = true;
}

onMounted(charger);
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.vitrine {
  min-height: 100vh;
  background: var(--up-chaux);
  position: relative;
}

.vitrine__connexion {
  position: absolute;
  top: var(--up-3);
  right: var(--up-3);
  z-index: 2;
}

// ---------------------------------------------------------------- enseigne
.vitrine__enseigne {
  @include enseignePlaque(false);
}

.vitrine__bandes {
  display: flex;
  height: 14px;
  max-width: 320px;
}

.vitrine__sur-titre {
  color: var(--up-encre-tertiaire);
  margin: 0;
}

.vitrine__marque {
  font-size: clamp(2.6rem, 1.6rem + 4.5vw, 4.8rem);
  margin: 0;
}

.vitrine__phrase {
  font-size: 1.05rem;
  line-height: 1.55;
  max-width: 52ch;
  color: var(--up-encre-douce);
  margin: 0;
}

.vitrine__faits {
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

// -------------------------------------------------------------- catalogue
.vitrine__catalogue {
  padding: var(--up-6) var(--up-5);
  max-width: 1180px;
  margin-inline: auto;
  display: grid;
  gap: var(--up-5);
}

.vitrine__catalogue-tete {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-3);
  border-bottom: var(--up-filet);
  padding-bottom: var(--up-3);
}

.vitrine__titre {
  font-size: clamp(1.5rem, 1rem + 1.8vw, 2.2rem);
  margin: 0;
}

.vitrine__compte {
  color: var(--up-encre-douce);
  margin: 0;
}

.vitrine__grille {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--up-4);
}

@media (max-width: 1023px) {
  .vitrine__enseigne {
    padding: var(--up-5) var(--up-4);
    gap: var(--up-3);
  }
  .vitrine__faits {
    display: none;
  }
  .vitrine__catalogue {
    padding: var(--up-5) var(--up-4);
  }
}
</style>
