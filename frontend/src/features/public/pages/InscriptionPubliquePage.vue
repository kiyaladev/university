<template>
  <q-page class="acces">
    <!-- L'enseigne : ce que voit le candidat avant de déposer son dossier -->
    <section class="enseigne">
      <p class="pochoir enseigne__sur-titre">{{ $t('inscriptionPublique.hero.overline') }}</p>
      <h1 class="lettrage enseigne__marque">{{ $t('inscriptionPublique.hero.title') }}</h1>
      <p class="enseigne__phrase">
        {{ $t('inscriptionPublique.hero.text') }}
      </p>

      <dl class="enseigne__faits">
        <div>
          <dt class="pochoir">{{ $t('inscriptionPublique.hero.facts.noCash.title') }}</dt>
          <dd>{{ $t('inscriptionPublique.hero.facts.noCash.text') }}</dd>
        </div>
        <div>
          <dt class="pochoir">{{ $t('inscriptionPublique.hero.facts.tracking.title') }}</dt>
          <dd>{{ $t('inscriptionPublique.hero.facts.tracking.text') }}</dd>
        </div>
      </dl>
    </section>

    <!-- La plaque du dossier -->
    <section class="acces__plaque">
      <h2 class="lettrage acces__titre">{{ $t('inscriptionPublique.form.title') }}</h2>

      <!-- Indicateur d'étape -->
      <ol class="acces__etapes" :aria-label="$t('inscriptionPublique.form.steps.ariaLabel')">
        <li
          v-for="(e, i) in libellesEtapes"
          :key="i"
          class="acces__etape"
          :class="{
            'acces__etape--actif': etape === i + 1,
            'acces__etape--fait': etape > i + 1,
          }"
          :aria-current="etape === i + 1 ? 'step' : undefined"
        >
          <span class="acces__etape-num chiffres">{{ i + 1 }}</span>
          <span class="acces__etape-label">{{ e }}</span>
        </li>
      </ol>

      <!-- Étape 1 : identité -->
      <inscription-etape-identite v-if="etape === 1" v-model:form="form" @continue="continuerEtape1" />

      <!-- Étape 2 : promotion -->
      <inscription-etape-promotion
        v-else-if="etape === 2"
        v-model:form="form"
        :annees="annees"
        :chargement-annees="chargementAnnees"
        :tarif-courant="tarifCourant"
        :chargement-tarif="chargementTarif"
        :message-depot-erreur="messageDepotErreur"
        :depot-en-cours="depotEnCours"
        @annee-change="onAnneeChange"
        @promotion-change="onPromotionChange"
        @deposer="deposer"
        @retour="etape = 1"
      />

      <!-- Étape 3 : dossier déposé -->
      <inscription-etape-recapitulatif
        v-else
        :resultat="resultat"
        :numero-court-mm="NUMERO_COURT_MM"
        @imprimer="imprimerRecepisse"
        @recommencer="recommencer"
      />

      <q-separator class="acces__separateur" />

      <nav class="acces__services" :aria-label="$t('inscriptionPublique.services.ariaLabel')">
        <p class="pochoir acces__services-titre">{{ $t('inscriptionPublique.services.title') }}</p>
        <ul class="acces__liens">
          <li>
            <router-link to="/portail-connexion" class="acces__lien-lien">
              {{ $t('inscriptionPublique.services.portal') }}
            </router-link>
          </li>
          <li>
            <router-link to="/formations" class="acces__lien-lien">
              {{ $t('inscriptionPublique.services.formationContinue') }}
            </router-link>
          </li>
          <li>
            <router-link to="/bibliotheque" class="acces__lien-lien">
              {{ $t('inscriptionPublique.services.bibliotheque') }}
            </router-link>
          </li>
          <li>
            <router-link to="/connexion" class="acces__lien-lien">
              {{ $t('inscriptionPublique.services.connexionPersonnel') }}
            </router-link>
          </li>
        </ul>
      </nav>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CLE_BROUILLON_INSCRIPTION } from '@/shared/services/cles-stockage';
import InscriptionEtapeIdentite from '@/features/public/components/InscriptionEtapeIdentite.vue';
import InscriptionEtapePromotion from '@/features/public/components/InscriptionEtapePromotion.vue';
import InscriptionEtapeRecapitulatif from '@/features/public/components/InscriptionEtapeRecapitulatif.vue';
import {
  inscriptionPubliqueService,
  tarifCourant as tarifCourantDe,
  type FormulaireInscription,
  type ResultatDepot,
} from '@/features/public/services/inscription-publique';
import type { AnneeAcademique } from '@/types';

/**
 * Numéro court institutionnel qui encaisse le Mobile Money des frais
 * d'inscription. À confirmer par l'université à la mise en service — en
 * pilote, les paiements sont confirmés au guichet par l'agent comptable.
 */
const NUMERO_COURT_MM = '60 431 431';

const CLE_BROUILLON = CLE_BROUILLON_INSCRIPTION;

const { t } = useI18n();

const libellesEtapes = computed(() => [
  t('common.fields.identity'),
  t('common.fields.filiere'),
  t('inscriptionPublique.form.steps.confirmation'),
]);

const etape = ref(1);
const depotEnCours = ref(false);
const messageDepotErreur = ref('');
const resultat = ref<ResultatDepot | null>(null);

const annees = ref<AnneeAcademique[]>([]);
const chargementAnnees = ref(true);

const form = ref<FormulaireInscription>({
  nom: '',
  prenom: '',
  sexe: null,
  dateNaissance: '',
  lieuNaissance: '',
  telephone: '',
  email: '',
  adresse: '',
  anneeId: '',
  promotionId: '',
});

const tarifCourant = ref<{ montant: number; devise: string } | null>(null);
const chargementTarif = ref(false);

function persisterBrouillon() {
  if (etape.value === 3) return;
  try {
    sessionStorage.setItem(CLE_BROUILLON, JSON.stringify({ etape: etape.value, form: form.value }));
  } catch {
    /* sessionStorage indisponible : on accepte de perdre le brouillon */
  }
}

function chargerBrouillon(): { etape: number; form: FormulaireInscription } | null {
  try {
    const raw = sessionStorage.getItem(CLE_BROUILLON);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function oublierBrouillon() {
  try {
    sessionStorage.removeItem(CLE_BROUILLON);
  } catch {
    /* silencieux */
  }
}

watch(
  () => [etape.value, JSON.stringify(form.value)],
  () => persisterBrouillon(),
);

async function chargerAnnees() {
  chargementAnnees.value = true;
  try {
    annees.value = await inscriptionPubliqueService.annees();
    // Si l'année du brouillon n'existe plus, on retombe sur l'année active.
    if (form.value.anneeId && !annees.value.find((a) => a.id === form.value.anneeId)) {
      form.value.anneeId = '';
    }
    // L'année active d'abord, sinon la première ouverte.
    if (!form.value.anneeId) {
      form.value.anneeId = annees.value.find((a) => a.active)?.id ?? annees.value[0]?.id ?? '';
    }
  } finally {
    chargementAnnees.value = false;
  }
}

/** Changer d'année remet la promotion à zéro : les tarifs en dépendent. */
function onAnneeChange() {
  form.value.promotionId = '';
  tarifCourant.value = null;
}

async function onPromotionChange() {
  tarifCourant.value = null;
  if (!form.value.anneeId || !form.value.promotionId) return;
  chargementTarif.value = true;
  try {
    const frais = await inscriptionPubliqueService.frais(form.value.anneeId, form.value.promotionId);
    tarifCourant.value = tarifCourantDe(frais);
  } catch {
    tarifCourant.value = null;
  } finally {
    chargementTarif.value = false;
  }
}

/**
 * `q-form` a déjà validé chaque champ (les règles portées par les q-input)
 * avant d'émettre `submit` : il ne reste qu'à passer au choix de la filière.
 */
function continuerEtape1() {
  etape.value = 2;
}

async function deposer() {
  messageDepotErreur.value = '';
  depotEnCours.value = true;
  try {
    resultat.value = await inscriptionPubliqueService.deposer({
      nom: form.value.nom.trim(),
      prenom: form.value.prenom.trim(),
      sexe: form.value.sexe ?? undefined,
      dateNaissance: form.value.dateNaissance || undefined,
      lieuNaissance: form.value.lieuNaissance.trim() || undefined,
      telephone: form.value.telephone.trim(),
      email: form.value.email.trim() || undefined,
      adresse: form.value.adresse.trim() || undefined,
      anneeId: form.value.anneeId || undefined,
      promotionId: form.value.promotionId,
    });
    etape.value = 3;
    oublierBrouillon();
  } catch (e: any) {
    messageDepotErreur.value = e?.response?.data?.message ?? t('inscriptionPublique.form.step2.depotError');
  } finally {
    depotEnCours.value = false;
  }
}

/** Le récépissé se conserve : l'impression du navigateur suffit, sans serveur. */
function imprimerRecepisse() {
  window.print();
}

function recommencer() {
  form.value = {
    nom: '',
    prenom: '',
    sexe: null,
    dateNaissance: '',
    lieuNaissance: '',
    telephone: '',
    email: '',
    adresse: '',
    anneeId: annees.value.find((a) => a.active)?.id ?? annees.value[0]?.id ?? '',
    promotionId: '',
  };
  resultat.value = null;
  messageDepotErreur.value = '';
  tarifCourant.value = null;
  oublierBrouillon();
  etape.value = 1;
}

onMounted(() => {
  const brouillon = chargerBrouillon();
  if (brouillon && brouillon.form) {
    form.value = { ...form.value, ...brouillon.form };
    etape.value = Math.min(Math.max(1, brouillon.etape ?? 1), 2);
  }
  void chargerAnnees();
});
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.acces {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  min-height: 100vh;
  background: var(--up-chaux);
  position: relative;
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

// ---------------------------------------------------------------- plaque
.acces__plaque {
  padding: var(--up-6) var(--up-5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 520px;
  width: 100%;
  margin-inline: auto;
}

.acces__titre {
  font-size: 2rem;
  letter-spacing: -0.022em;
  margin: 0 0 var(--up-4);
  padding-bottom: 0;
  border-bottom: 0;
}

.acces__etapes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--up-2);
  margin: 0 0 var(--up-4);
  padding: 0;
  list-style: none;
}

.acces__etape {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: var(--up-filet-fin);
  color: var(--up-encre-douce);
  font-size: 12px;
  letter-spacing: -0.01em;
  font-weight: 590;
}

.acces__etape-num {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  background: var(--up-gris-inerte);
  color: var(--up-encre-douce);
  border-radius: var(--up-pilule);
}

.acces__etape--actif {
  border: var(--up-filet);
  color: var(--up-encre);
}

.acces__etape--actif .acces__etape-num {
  background: #{$vert-action};
  color: #fff;
}

.acces__etape--fait {
  color: var(--up-vert, $vert);
  border-color: var(--up-vert, $vert);
}

// -------------------------------------------------------- autres services
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
  text-decoration: none;

  &:hover,
  &:focus-visible {
    color: var(--up-encre);
    text-decoration: underline;
  }
}

// À l'impression du récépissé, seule la plaque du dossier a du sens.
@media print {
  .enseigne,
  .acces__services,
  .acces__separateur {
    display: none;
  }

  .acces {
    display: block;
    background: #fff;
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
