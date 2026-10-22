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
      <q-form v-if="etape === 1" class="acces__form" @submit.prevent="continuerEtape1">
        <span class="section-titre">{{ $t('inscriptionPublique.form.step1.sectionTitle') }}</span>
        <p class="pochoir acces__aide">
          {{ $t('inscriptionPublique.form.step1.help') }}
        </p>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.nom"
              outlined
              dense
              autocomplete="family-name"
              :label="$t('inscriptionPublique.form.step1.nom.label')"
              :rules="[(v) => !!v?.trim() || $t('inscriptionPublique.form.step1.nom.required')]"
              lazy-rules
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.prenom"
              outlined
              dense
              autocomplete="given-name"
              :label="$t('inscriptionPublique.form.step1.prenom.label')"
              :rules="[(v) => !!v?.trim() || $t('inscriptionPublique.form.step1.prenom.required')]"
              lazy-rules
            />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <q-select
              v-model="form.sexe"
              :options="optionsSexe"
              emit-value
              map-options
              outlined
              dense
              clearable
              :label="$t('inscriptionPublique.form.step1.sexe.label')"
            />
          </div>
          <div class="col-12 col-sm-8">
            <champ-date v-model="form.dateNaissance" :label="$t('inscriptionPublique.form.step1.dateNaissance.label')" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.lieuNaissance" outlined dense :label="$t('inscriptionPublique.form.step1.lieuNaissance.label')" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.telephone"
              outlined
              dense
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              :label="$t('inscriptionPublique.form.step1.telephone.label')"
              :placeholder="$t('inscriptionPublique.form.step1.telephone.placeholder')"
              :hint="$t('inscriptionPublique.form.step1.telephone.hint')"
              :rules="[
                (v) => !!v?.trim() || $t('inscriptionPublique.form.step1.telephone.required'),
                (v) => !v || v.replace(/\D/g, '').length >= 8 || $t('inscriptionPublique.form.step1.telephone.minLength'),
              ]"
              lazy-rules
            />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.email"
              outlined
              dense
              type="email"
              autocomplete="email"
              :label="$t('inscriptionPublique.form.step1.email.label')"
              :rules="[
                (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || $t('inscriptionPublique.form.step1.email.invalid'),
              ]"
              lazy-rules
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.adresse"
              outlined
              dense
              autocomplete="street-address"
              :label="$t('inscriptionPublique.form.step1.adresse.label')"
            />
          </div>
        </div>

        <q-btn
          type="submit"
          color="primary"
          class="full-width acces__bouton"
          size="lg"
          unelevated
          no-caps
          :label="$t('inscriptionPublique.form.step1.continue')"
        />
      </q-form>

      <!-- Étape 2 : promotion -->
      <q-form v-else-if="etape === 2" class="acces__form" @submit.prevent="deposer">
        <span class="section-titre">{{ $t('inscriptionPublique.form.step2.sectionTitle') }}</span>
        <q-banner v-if="chargementAnnees" class="note--info">
          <template #avatar><q-spinner size="20px" /></template>
          {{ $t('inscriptionPublique.form.step2.loadingFilieres') }}
        </q-banner>

        <template v-else>
          <autocomplete-async
            v-model="form.anneeId"
            endpoint="/inscription-publique/annees"
            :label-fn="(a) => a.libelle"
            :label="$t('inscriptionPublique.form.step2.anneeLabel')"
            :disable="annees.length <= 1"
            @update:model-value="onAnneeChange"
          />
          <autocomplete-async
            v-model="form.promotionId"
            :endpoint="endpointPromotions"
            :label-fn="labelPromotion"
            :disable="!form.anneeId"
            :preload="false"
            :label="$t('inscriptionPublique.form.step2.promotionLabel')"
            :placeholder="$t('inscriptionPublique.form.step2.promotionPlaceholder')"
            @update:model-value="onPromotionChange"
          />

          <div v-if="tarifCourant" class="plaque acces__tarif">
            <div class="text-caption acces__tarif-libelle">{{ $t('inscriptionPublique.form.step2.tarifLabel') }}</div>
            <div class="lettrage chiffres acces__tarif-montant">
              {{ montantLisible(tarifCourant.montant) }} {{ tarifCourant.devise }}
            </div>
          </div>
          <div v-else-if="form.promotionId && chargementTarif" class="text-caption text-grey-7">
            <q-spinner size="16px" class="q-mr-xs" />
            {{ $t('inscriptionPublique.form.step2.checkingTarif') }}
          </div>
        </template>

        <q-banner v-if="messageDepotErreur" class="note--erreur" role="alert" aria-live="assertive">
          <template #avatar><q-icon name="error" /></template>
          {{ messageDepotErreur }}
        </q-banner>

        <p v-if="!chargementAnnees && !form.promotionId" class="pochoir acces__aide">
          {{ $t('inscriptionPublique.form.step2.chooseHelp') }}
        </p>

        <div class="row q-col-gutter-sm">
          <div class="col-6">
            <q-btn
              outline
              class="full-width acces__bouton"
              size="lg"
              no-caps
              icon="chevron_left"
              :label="$t('inscriptionPublique.form.step2.back')"
              @click="etape = 1"
            />
          </div>
          <div class="col-6">
            <q-btn
              type="submit"
              color="primary"
              class="full-width acces__bouton"
              size="lg"
              unelevated
              no-caps
              :label="$t('inscriptionPublique.form.step2.submit')"
              :loading="depotEnCours"
              :disable="!form.promotionId"
            />
          </div>
        </div>
      </q-form>

      <!-- Étape 3 : dossier déposé -->
      <div v-else class="acces__resultat">
        <div class="acces__resultat-tampon" aria-hidden="true">
          <span class="pochoir">{{ $t('inscriptionPublique.form.step3.stampFolder') }}</span>
          <span class="lettrage">{{ $t('inscriptionPublique.form.step3.stampDone') }}</span>
        </div>

        <p class="pochoir acces__resultat-ref">{{ $t('inscriptionPublique.form.step3.numeroLabel') }}</p>
        <p class="lettrage chiffres acces__resultat-numero">{{ resultat?.numero }}</p>
        <p class="pochoir acces__aide">
          {{ $t('inscriptionPublique.form.step3.numeroHelp') }}
        </p>

        <div class="plaque acces__resultat-montant">
          <div class="text-caption acces__resultat-libelle">{{ $t('inscriptionPublique.form.step3.fraisLabel') }}</div>
          <div class="lettrage chiffres acces__resultat-somme">
            {{ montantLisible(resultat?.montantFrais) }} {{ resultat?.devise }}
          </div>
        </div>

        <p class="acces__resultat-message">
          <i18n-t keypath="inscriptionPublique.form.step3.message" tag="span">
            <template #montant><strong class="chiffres">{{ montantLisible(resultat?.montantFrais) }} {{ resultat?.devise }}</strong></template>
            <template #numero><strong class="chiffres">{{ NUMERO_COURT_MM }}</strong></template>
            <template #ref><strong>{{ resultat?.numero }}</strong></template>
          </i18n-t>
        </p>

        <q-banner v-if="resultat?.avertissement" class="note--alerte">
          <template #avatar><q-icon name="warning" /></template>
          {{ resultat.avertissement }}
        </q-banner>

        <div class="acces__resultat-actions">
          <q-btn
            color="primary"
            class="acces__bouton"
            size="lg"
            unelevated
            no-caps
            icon="print"
            :label="$t('inscriptionPublique.form.step3.print')"
            @click="imprimerRecepisse"
          />
          <q-btn
            outline
            class="acces__bouton"
            size="lg"
            no-caps
            icon="person_add"
            :label="$t('inscriptionPublique.form.step3.another')"
            @click="recommencer"
          />
        </div>

        <p class="pochoir acces__resultat-lien">
          {{ $t('inscriptionPublique.form.step3.validatedIntro') }}
          <router-link to="/portail-connexion" class="acces__lien-lien">
            {{ $t('inscriptionPublique.form.step3.enterSpace') }}
          </router-link>
        </p>
      </div>

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
import { api } from '../boot/axios';
import ChampDate from '../components/ChampDate.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import { montantLisible } from '../utils/libelles';
import type { AnneeAcademique } from '../types';

/**
 * Numéro court institutionnel qui encaisse le Mobile Money des frais
 * d'inscription. À confirmer par l'université à la mise en service — en
 * pilote, les paiements sont confirmés au guichet par l'agent comptable.
 */
const NUMERO_COURT_MM = '60 431 431';

const CLE_BROUILLON = 'unipresence_inscription_publique_brouillon';

interface PromotionOuverte {
  id: string;
  nom: string;
  niveau: string;
  filiere: { code: string; nom: string } | null;
  frais: { montant: number; devise: string } | null;
}

interface ResultatDepot {
  etudiantId: string;
  inscriptionId: string;
  numero: string;
  montantFrais: number;
  devise: string;
  message: string;
  avertissement?: string | null;
}

const { t } = useI18n();

const libellesEtapes = computed(() => [
  t('inscriptionPublique.form.steps.identity'),
  t('inscriptionPublique.form.steps.filiere'),
  t('inscriptionPublique.form.steps.confirmation'),
]);

const optionsSexe = computed(() => [
  { value: 'M', label: t('inscriptionPublique.form.step1.sexe.masculin') },
  { value: 'F', label: t('inscriptionPublique.form.step1.sexe.feminin') },
]);

const etape = ref(1);
const depotEnCours = ref(false);
const messageDepotErreur = ref('');
const resultat = ref<ResultatDepot | null>(null);

const annees = ref<AnneeAcademique[]>([]);
const chargementAnnees = ref(true);

const form = ref({
  nom: '',
  prenom: '',
  sexe: null as string | null,
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
const endpointPromotions = computed(() =>
  form.value.anneeId ? `/inscription-publique/annees/${form.value.anneeId}/promotions` : '/inscription-publique/annees',
);

const labelPromotion = (p: PromotionOuverte) =>
  `${p.filiere ? p.filiere.nom + ' — ' : ''}${p.nom}${
    p.frais
      ? ` (${t('inscriptionPublique.form.step2.fraisLabel', { montant: montantLisible(p.frais.montant), devise: p.frais.devise })})`
      : ''
  }`;

function persisterBrouillon() {
  if (etape.value === 3) return;
  try {
    sessionStorage.setItem(
      CLE_BROUILLON,
      JSON.stringify({ etape: etape.value, form: form.value }),
    );
  } catch {
    /* sessionStorage indisponible : on accepte de perdre le brouillon */
  }
}

function chargerBrouillon(): { etape: number; form: typeof form.value } | null {
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
    const { data } = await api.get('/inscription-publique/annees');
    annees.value = Array.isArray(data) ? data : [];
    // Si l'année du brouillon n'existe plus, on retombe sur l'année active.
    if (form.value.anneeId && !annees.value.find((a) => a.id === form.value.anneeId)) {
      form.value.anneeId = '';
    }
    // L'année active d'abord, sinon la première ouverte.
    if (!form.value.anneeId) {
      form.value.anneeId =
        annees.value.find((a) => a.active)?.id ?? annees.value[0]?.id ?? '';
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
    const { data } = await api.get('/frais', {
      params: { anneeId: form.value.anneeId, promotionId: form.value.promotionId },
    });
    const liste = Array.isArray(data) ? data : data.data ?? [];
    if (liste.length) {
      tarifCourant.value = { montant: liste[0].montant, devise: liste[0].devise };
    }
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
    const { data } = await api.post('/inscription-publique', {
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
    }, { silencieux: true });
    resultat.value = data as ResultatDepot;
    etape.value = 3;
    oublierBrouillon();
  } catch (e: any) {
    messageDepotErreur.value =
      e?.response?.data?.message ?? t('inscriptionPublique.form.step2.depotError');
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
@use '../css/mixins' as *;

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

  dt { color: var(--up-encre-tertiaire); }
  dd { margin: 3px 0 0; font-size: 0.92rem; }
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

.acces__form {
  display: grid;
  gap: var(--up-3);
}

.acces__aide {
  color: var(--up-encre-douce);
  margin: -4px 0 0;
}

.acces__bouton { min-height: 56px; }

.acces__tarif {
  padding: var(--up-3) var(--up-4);
  display: grid;
  gap: var(--up-1);
}

.acces__tarif-libelle {
  color: var(--up-encre-douce);
  letter-spacing: -0.01em;
}

.acces__tarif-montant {
  font-size: 1.4rem;
  color: $vert;
}

// -------------------------------------------------------------- résultat
.acces__resultat {
  display: grid;
  gap: var(--up-4);
}

.acces__resultat-tampon {
  display: inline-flex;
  align-items: center;
  gap: var(--up-2);
  align-self: start;
  background: $vert-fond;
  color: #{$vert};
  border-radius: var(--up-pilule);
  padding: var(--up-2) var(--up-3);
}

.acces__resultat-ref {
  color: var(--up-encre-douce);
  margin: 0;
}

.acces__resultat-numero {
  font-size: clamp(1.8rem, 1.2rem + 2.2vw, 2.6rem);
  margin: 0;
}

.acces__resultat-montant {
  padding: var(--up-4);
  display: grid;
  gap: var(--up-2);
}

.acces__resultat-libelle {
  color: var(--up-encre-douce);
  letter-spacing: -0.01em;
}

.acces__resultat-somme {
  font-size: clamp(1.6rem, 1rem + 2vw, 2.4rem);
  color: $vert;
}

.acces__resultat-message {
  font-size: 0.95rem;
  line-height: 1.55;
  margin: 0;
  max-width: 46ch;
}

.acces__resultat-actions {
  display: grid;
  gap: var(--up-2);
}

.acces__resultat-lien { margin: 0; }

// -------------------------------------------------------- autres services
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

// À l'impression du récépissé, seule la plaque du dossier a du sens.
@media print {
  .enseigne,
  .acces__services,
  .acces__separateur,
  .acces__resultat-actions { display: none; }

  .acces { display: block; background: #fff; }
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
