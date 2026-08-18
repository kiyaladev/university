<template>
  <q-page class="acces">
    <!-- L'enseigne : ce que voit le candidat avant de déposer son dossier -->
    <section class="enseigne">
      <div class="enseigne__bandes" aria-hidden="true">
        <span class="bande bande--rouge" />
        <span class="bande bande--jaune" />
        <span class="bande bande--vert" />
      </div>

      <p class="pochoir enseigne__sur-titre">Inscriptions en ligne</p>
      <h1 class="lettrage enseigne__marque">Rejoignez l'université</h1>
      <p class="enseigne__phrase">
        Déposez votre dossier sans compte : choisissez votre filière, payez vos
        frais par Mobile Money (Orange Money, MTN MoMo ou Telecel), et la
        scolarité valide votre inscription.
      </p>

      <dl class="enseigne__faits">
        <div>
          <dt class="pochoir">Sans cash</dt>
          <dd>Paiement Mobile Money au numéro court de l'université</dd>
        </div>
        <div>
          <dt class="pochoir">Suivi du dossier</dt>
          <dd>Un numéro de dossier vous est remis dès le dépôt</dd>
        </div>
      </dl>
    </section>

    <!-- La plaque du dossier -->
    <section class="acces__plaque">
      <h2 class="lettrage acces__titre">Déposer mon dossier</h2>

      <!-- Indicateur d'étape -->
      <ol class="acces__etapes" aria-label="Étapes de la préinscription">
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
        <span class="section-titre">Identité du candidat</span>
        <p class="pochoir acces__aide">
          Les champs marqués d'une étoile sont obligatoires. Le reste peut être
          complété plus tard à la scolarité.
        </p>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.nom"
              outlined
              dense
              autocomplete="family-name"
              label="Nom *"
              :rules="[(v) => !!v?.trim() || 'Le nom est obligatoire']"
              lazy-rules
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.prenom"
              outlined
              dense
              autocomplete="given-name"
              label="Prénom *"
              :rules="[(v) => !!v?.trim() || 'Le prénom est obligatoire']"
              lazy-rules
            />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <q-select
              v-model="form.sexe"
              :options="OPTIONS_SEXE"
              emit-value
              map-options
              outlined
              dense
              clearable
              label="Sexe"
            />
          </div>
          <div class="col-12 col-sm-8">
            <champ-date v-model="form.dateNaissance" label="Date de naissance" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.lieuNaissance" outlined dense label="Lieu de naissance" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.telephone"
              outlined
              dense
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              label="Téléphone *"
              placeholder="622 00 00 00"
              hint="C'est ce numéro qui recevra le code d'accès à votre espace"
              :rules="[
                (v) => !!v?.trim() || 'Le téléphone est obligatoire',
                (v) => !v || v.replace(/\D/g, '').length >= 8 || 'Le numéro doit comporter au moins 8 chiffres',
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
              label="Adresse e-mail"
              :rules="[
                (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Adresse e-mail invalide',
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
              label="Adresse"
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
          label="Continuer — choisir ma filière"
        />
      </q-form>

      <!-- Étape 2 : promotion -->
      <q-form v-else-if="etape === 2" class="acces__form" @submit.prevent="deposer">
        <span class="section-titre">Choix de la promotion</span>
        <q-banner v-if="chargementAnnees" class="note--info">
          <template #avatar><q-spinner size="20px" /></template>
          Chargement des filières ouvertes…
        </q-banner>

        <template v-else>
          <autocomplete-async
            v-model="form.anneeId"
            endpoint="/inscription-publique/annees"
            :label-fn="(a) => a.libelle"
            label="Année académique *"
            :disable="annees.length <= 1"
            @update:model-value="onAnneeChange"
          />
          <autocomplete-async
            v-model="form.promotionId"
            :endpoint="endpointPromotions"
            :label-fn="labelPromotion"
            :disable="!form.anneeId"
            :preload="false"
            label="Promotion *"
            placeholder="Choisissez votre filière et niveau"
            @update:model-value="onPromotionChange"
          />

          <div v-if="tarifCourant" class="plaque acces__tarif">
            <div class="text-caption acces__tarif-libelle">Frais d'inscription</div>
            <div class="lettrage chiffres acces__tarif-montant">
              {{ montantLisible(tarifCourant.montant) }} {{ tarifCourant.devise }}
            </div>
          </div>
          <div v-else-if="form.promotionId && chargementTarif" class="text-caption text-grey-7">
            <q-spinner size="16px" class="q-mr-xs" />
            Consultation du tarif officiel…
          </div>
        </template>

        <q-banner v-if="messageDepotErreur" class="note--erreur" role="alert" aria-live="assertive">
          <template #avatar><q-icon name="error" /></template>
          {{ messageDepotErreur }}
        </q-banner>

        <p v-if="!chargementAnnees && !form.promotionId" class="pochoir acces__aide">
          Choisissez votre promotion pour pouvoir déposer votre dossier.
        </p>

        <div class="row q-col-gutter-sm">
          <div class="col-6">
            <q-btn
              outline
              class="full-width acces__bouton"
              size="lg"
              no-caps
              icon="chevron_left"
              label="Retour"
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
              label="Déposer mon dossier"
              :loading="depotEnCours"
              :disable="!form.promotionId"
            />
          </div>
        </div>
      </q-form>

      <!-- Étape 3 : dossier déposé -->
      <div v-else class="acces__resultat">
        <div class="acces__resultat-tampon" aria-hidden="true">
          <span class="pochoir">Dossier</span>
          <span class="lettrage">Remis</span>
        </div>

        <p class="pochoir acces__resultat-ref">N° de dossier</p>
        <p class="lettrage chiffres acces__resultat-numero">{{ resultat?.numero }}</p>
        <p class="pochoir acces__aide">
          Notez ce numéro : il vous sera demandé à la scolarité et pour tout suivi.
        </p>

        <div class="plaque acces__resultat-montant">
          <div class="text-caption acces__resultat-libelle">Frais d'inscription à régler</div>
          <div class="lettrage chiffres acces__resultat-somme">
            {{ montantLisible(resultat?.montantFrais) }} {{ resultat?.devise }}
          </div>
        </div>

        <p class="acces__resultat-message">
          Envoyez
          <strong class="chiffres">{{ montantLisible(resultat?.montantFrais) }} {{ resultat?.devise }}</strong>
          au <strong class="chiffres">{{ NUMERO_COURT_MM }}</strong> par Mobile Money, en
          mentionnant la référence <strong>{{ resultat?.numero }}</strong> en motif. Dès
          réception du paiement, la scolarité validera votre inscription. Vous
          accéderez ensuite à votre espace avec un code envoyé par SMS au
          numéro que vous avez indiqué.
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
            label="Imprimer ce récépissé"
            @click="imprimerRecepisse"
          />
          <q-btn
            outline
            class="acces__bouton"
            size="lg"
            no-caps
            icon="person_add"
            label="Préinscrire un autre candidat"
            @click="recommencer"
          />
        </div>

        <p class="pochoir acces__resultat-lien">
          Une fois votre inscription validée :
          <router-link to="/portail-connexion" class="acces__lien-lien">
            entrez dans votre espace étudiant →
          </router-link>
        </p>
      </div>

      <q-separator class="acces__separateur" />

      <nav class="acces__services" aria-label="Autres services publics">
        <p class="pochoir acces__services-titre">Autres services</p>
        <ul class="acces__liens">
          <li>
            <router-link to="/portail-connexion" class="acces__lien-lien">
              Portail étudiant (connexion par SMS) →
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
            <router-link to="/connexion" class="acces__lien-lien">
              Connexion du personnel →
            </router-link>
          </li>
        </ul>
      </nav>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
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

const libellesEtapes = ['Identité', 'Filière', 'Confirmation'];

const OPTIONS_SEXE = [
  { value: 'M', label: 'Masculin' },
  { value: 'F', label: 'Féminin' },
];

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
    p.frais ? ` (Frais : ${montantLisible(p.frais.montant)} ${p.frais.devise})` : ''
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
    });
    resultat.value = data as ResultatDepot;
    etape.value = 3;
    oublierBrouillon();
  } catch (e: any) {
    messageDepotErreur.value =
      e?.response?.data?.message ?? 'Dépôt impossible, votre brouillon est conservé — réessayez.';
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
  font-size: 1.7rem;
  margin: 0 0 var(--up-4);
  padding-bottom: var(--up-2);
  border-bottom: 3px solid var(--up-encre);
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
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
}

.acces__etape-num {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  background: var(--up-encre);
  color: $blanc-craie;
}

.acces__etape--actif {
  border: 2px solid var(--up-encre);
  color: var(--up-encre);
}

.acces__etape--actif .acces__etape-num {
  background: var(--up-vert, $vert);
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
  text-transform: uppercase;
  color: var(--up-encre-douce);
  letter-spacing: 0.06em;
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
  border: 2px solid $vert;
  color: $vert;
  padding: var(--up-2) var(--up-3);
  transform: rotate(-3deg);
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
  text-transform: uppercase;
  color: var(--up-encre-douce);
  letter-spacing: 0.06em;
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
