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
      <h1 class="lettrage enseigne__marque">Rejoignez l’université</h1>
      <p class="enseigne__phrase">
        Déposez votre dossier sans compte : choisissez votre filière, payez vos
        frais par Mobile Money (Orange Money, MTN MoMo ou Telecel), et la
        scolarité valide votre inscription.
      </p>

      <dl class="enseigne__faits">
        <div>
          <dt class="pochoir">Sans cash</dt>
          <dd>Paiement Mobile Money au numéro court de l’université</dd>
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

      <!-- Étape 1 : identité -->
      <form v-if="etape === 1" class="acces__form" @submit.prevent="continuerEtape1">
        <span class="section-titre">Identité du candidat</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.nom" outlined dense label="Nom *" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.prenom" outlined dense label="Prénom *" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <q-select
              v-model="form.sexe"
              :options="['M', 'F']"
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
            <q-input v-model="form.telephone" outlined dense label="Téléphone *" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input v-model="form.email" outlined dense type="email" label="Adresse e-mail" />
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.adresse" outlined dense label="Adresse" />
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
      </form>

      <!-- Étape 2 : promotion -->
      <form v-else-if="etape === 2" class="acces__form" @submit.prevent="deposer">
        <span class="section-titre">Choix de la promotion</span>
        <q-banner v-if="chargementAnnees" class="note--info">
          <template #avatar><q-spinner size="20px" /></template>
          Chargement des filières ouvertes…
        </q-banner>

        <template v-else>
          <q-select
            v-model="form.anneeId"
            :options="optionsAnnees"
            outlined
            dense
            emit-value
            map-options
            label="Année académique *"
            :disable="annees.length <= 1"
            @update:model-value="chargerPromotions"
          />
          <q-select
            v-model="form.promotionId"
            :options="optionsPromotions"
            outlined
            dense
            emit-value
            map-options
            label="Promotion *"
            placeholder="Choisissez votre filière et niveau"
          />
        </template>

        <q-banner v-if="messageDepotErreur" class="note--erreur">
          <template #avatar><q-icon name="error" /></template>
          {{ messageDepotErreur }}
        </q-banner>

        <div class="row q-col-gutter-sm">
          <div class="col-6">
            <q-btn
              flat
              outline
              class="full-width"
              size="lg"
              unelevated
              no-caps
              label="Retour"
              @click="etape = 1"
            />
          </div>
          <div class="col-6">
            <q-btn
              type="submit"
              color="primary"
              class="full-width"
              size="lg"
              unelevated
              no-caps
              label="Déposer mon dossier"
              :loading="depotEnCours"
              :disable="!form.promotionId"
            />
          </div>
        </div>
      </form>

      <!-- Étape 3 : dossier déposé -->
      <div v-else class="acces__resultat">
        <div class="acces__resultat-tampon" aria-hidden="true">
          <span class="pochoir">Dossier</span>
          <span class="lettrage">Remis</span>
        </div>

        <p class="pochoir acces__resultat-ref">N° de dossier</p>
        <p class="lettrage chiffres acces__resultat-numero">{{ resultat.numero }}</p>

        <div class="plaque acces__resultat-montant">
          <div class="text-caption acces__resultat-libelle">Frais d’inscription à régler</div>
          <div class="lettrage chiffres acces__resultat-somme">
            {{ montantLisible(resultat?.montantFrais) }} {{ resultat?.devise }}
          </div>
        </div>

        <p class="acces__resultat-message">
          Payez ce montant via Mobile Money au
          <strong>{{ NUMERO_COURT_MM }}</strong> de l’université, en indiquant le
          numéro de dossier en motivation. Dès réception du paiement, la
          scolarité validera votre inscription.
        </p>

        <q-banner v-if="resultat?.avertissement" class="note--alerte">
          <template #avatar><q-icon name="warning" /></template>
          {{ resultat.avertissement }}
        </q-banner>

        <q-btn
          color="primary"
          class="full-width acces__bouton"
          size="lg"
          unelevated
          no-caps
          label="Préinscrire un autre candidat"
          @click="recommencer"
        />
      </div>
    </section>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../boot/axios';
import ChampDate from '../components/ChampDate.vue';
import { montantLisible } from '../utils/libelles';
import type { AnneeAcademique } from '../types';

/**
 * Numéro court institutionnel qui encaisse le Mobile Money des frais
 * d'inscription. À confirmer par l'université à la mise en service — en
 * pilote, les paiements sont confirmés au guichet par l'agent comptable.
 */
const NUMERO_COURT_MM = '60 431 431';

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

const etape = ref(1);
const depotEnCours = ref(false);
const messageDepotErreur = ref('');
const resultat = ref<ResultatDepot | null>(null);

const annees = ref<AnneeAcademique[]>([]);
const promotions = ref<PromotionOuverte[]>([]);
const promotionsFiltrees = ref<PromotionOuverte[]>([]);
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

const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: a.libelle, value: a.id })),
);
const optionsPromotions = computed(() =>
  promotionsFiltrees.value.map((p) => ({
    label: `${p.filiere ? p.filiere.nom + ' — ' : ''}${p.nom}${
      p.frais ? ` (Frais : ${montantLisible(p.frais.montant)} ${p.frais.devise})` : ''
    }`,
    value: p.id,
  })),
);

async function chargerAnnees() {
  chargementAnnees.value = true;
  try {
    const { data } = await api.get('/inscription-publique/annees');
    annees.value = Array.isArray(data) ? data : [];
    // L'année active d'abord, sinon la première ouverte.
    form.value.anneeId =
      annees.value.find((a) => a.active)?.id ?? annees.value[0]?.id ?? '';
    if (form.value.anneeId) await chargerPromotions();
  } finally {
    chargementAnnees.value = false;
  }
}

async function chargerPromotions() {
  promotions.value = [];
  promotionsFiltrees.value = [];
  form.value.promotionId = '';
  if (!form.value.anneeId) return;
  const { data } = await api.get(`/inscription-publique/annees/${form.value.anneeId}/promotions`);
  promotions.value = Array.isArray(data) ? data : [];
  promotionsFiltrees.value = promotions.value;
}

function continuerEtape1() {
  if (!form.value.nom.trim() || !form.value.prenom.trim() || !form.value.telephone.trim()) {
    messageErreur('Le nom, le prénom et le téléphone sont obligatoires');
    return;
  }
  messageErreur('');
  etape.value = 2;
}

function messageErreur(v: string) {
  messageDepotErreur.value = v;
}

async function deposer() {
  messageErreur('');
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
  } catch (e: any) {
    messageErreur(e?.response?.data?.message ?? 'Dépôt impossible, réessayez');
  } finally {
    depotEnCours.value = false;
  }
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
  messageErreur('');
  void chargerPromotions();
  etape.value = 1;
}

onMounted(chargerAnnees);
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

.acces__form {
  display: grid;
  gap: var(--up-3);
}

.acces__bouton { min-height: 56px; }

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