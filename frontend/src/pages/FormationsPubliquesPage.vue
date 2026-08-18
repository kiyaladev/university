<template>
  <q-page class="vitrine">
    <!-- L'en-tête public (AuthLayout) porte les liens du site ; ici on n'ajoute
         que l'entrée vers l'espace de travail, utile au personnel. -->
    <q-btn
      flat
      dense
      no-caps
      icon="login"
      label="Se connecter"
      to="/connexion"
      class="vitrine__connexion"
    />
    <!-- L'enseigne du hub : ce que voit l'acheteur avant la vitrine -->
    <section class="vitrine__enseigne">
      <div class="vitrine__bandes" aria-hidden="true">
        <span class="bande bande--rouge" />
        <span class="bande bande--jaune" />
        <span class="bande bande--vert" />
      </div>

      <p class="pochoir vitrine__sur-titre">Formation continue & certifications</p>
      <h1 class="lettrage vitrine__marque">Compétences pour demain</h1>
      <p class="vitrine__phrase">
        L'université ouvre ses cours du soir et ses certifications aux
        professionnels et au grand public. Choisissez votre formation, déposez
        votre demande sans compte, réglez par Mobile Money — et recevez votre
        attestation de formation.
      </p>

      <dl class="vitrine__faits">
        <div>
          <dt class="pochoir">Sans compte</dt>
          <dd>Nom, téléphone, e-mail — le dossier se dépose en deux minutes</dd>
        </div>
        <div>
          <dt class="pochoir">Paiement Mobile Money</dt>
          <dd>Orange Money, MTN MoMo, Telecel — confirmation au guichet</dd>
        </div>
        <div>
          <dt class="pochoir">Attestation de formation</dt>
          <dd>Document A4 signé, remis à la fin du parcours</dd>
        </div>
      </dl>
    </section>

    <!-- La vitrine -->
    <section class="vitrine__catalogue">
      <div class="vitrine__catalogue-tete">
        <h2 class="lettrage vitrine__titre">Formations ouvertes</h2>
        <p class="pochoir vitrine__compte">{{ formations.length }} formation(s) en vente</p>
      </div>

      <q-banner v-if="chargement" class="note--info">
        <template #avatar><q-spinner size="20px" /></template>
        Chargement de la vitrine…
      </q-banner>

      <q-banner v-if="!chargement && !formations.length" class="note--info">
        <template #avatar><q-icon name="storefront" /></template>
        Aucune formation n'est en vente pour le moment — repassez bientôt.
      </q-banner>

      <div class="vitrine__grille">
        <article v-for="f in formations" :key="f.id" class="plaque carte-formation">
          <div class="carte-formation__tete">
            <span v-if="f.categorie" class="pochoir carte-formation__categorie">{{ f.categorie }}</span>
            <span v-else class="pochoir carte-formation__categorie">Formation</span>
            <!-- `placesRestantes` vaut null/undefined quand la capacité est libre. -->
            <span
              v-if="f.placesRestantes != null"
              class="pochoir carte-formation__places"
              :class="{ 'carte-formation__places--dernieres': f.placesRestantes <= 5 }"
            >
              {{ f.placesRestantes === 0 ? 'Complet' : `${f.placesRestantes} places restantes` }}
            </span>
          </div>

          <h3 class="lettrage carte-formation__titre">{{ f.titre }}</h3>
          <p v-if="f.description" class="carte-formation__description">{{ f.description }}</p>

          <dl class="carte-formation__details">
            <div v-if="f.dureeHeures">
              <dt class="pochoir">Durée</dt>
              <dd class="chiffres">{{ f.dureeHeures }} h</dd>
            </div>
            <div v-if="f.dateDebut || f.dateFin">
              <dt class="pochoir">Dates</dt>
              <dd class="chiffres">{{ periodeLisible(f) }}</dd>
            </div>
            <div v-if="f.lieu">
              <dt class="pochoir">Lieu</dt>
              <dd>{{ f.lieu }}</dd>
            </div>
          </dl>

          <div class="carte-formation__prix">
            <span class="pochoir carte-formation__prix-libelle">Investissement</span>
            <span class="lettrage chiffres carte-formation__montant">
              {{ montantLisible(f.prix) }}
              <small class="carte-formation__devise">{{ f.devise }}</small>
            </span>
          </div>

          <q-btn
            class="full-width carte-formation__cta"
            color="primary"
            size="lg"
            unelevated
            no-caps
            :label="f.prix > 0 ? 'S\'inscrire — payer par Mobile Money' : 'S\'inscrire gratuitement'"
            :disable="f.placesRestantes === 0"
            @click="ouvrirInscription(f)"
          />
        </article>
      </div>
    </section>

    <!-- Demande d'inscription -->
    <q-dialog v-model="dialogInscription" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <!-- Étape 1 : identité -->
        <q-card-section v-if="etape === 1">
          <div class="text-h6">S'inscrire à la formation</div>
          <div class="text-caption text-grey-7 q-mt-xs">
            <strong>{{ selection?.titre }}</strong> —
            {{ montantLisible(selection?.prix ?? 0) }} {{ selection?.devise ?? 'GNF' }}
          </div>
        </q-card-section>
        <q-card-section v-if="etape === 1">
          <span class="section-titre">Identité</span>
          <q-input
            v-model="form.nomComplet"
            outlined
            dense
            label="Nom et prénom *"
            hint="Tel qu'il figurera sur votre attestation"
            autofocus
          />
          <q-input
            v-model="form.telephone"
            outlined
            dense
            label="Téléphone (Mobile Money) *"
            hint="Le numéro qui paiera les frais de la formation"
          />
          <q-input
            v-model="form.email"
            outlined
            dense
            type="email"
            label="Adresse e-mail (facultatif)"
          />
          <q-input
            v-model="form.matricule"
            outlined
            dense
            label="Numéro étudiant (matricule INE, facultatif)"
            hint="Déjà étudiant ? Indiquez votre matricule pour rattacher la formation à votre dossier"
          />
        </q-card-section>

        <!-- Étape 2 : récapitulatif -->
        <q-card-section v-if="etape === 2">
          <div class="text-h6">Récapitulatif de la demande</div>
          <div class="plaque recapitulatif">
            <div class="recapitulatif__ligne">
              <span class="pochoir">Formation</span>
              <span class="recapitulatif__valeur">{{ selection?.titre }}</span>
            </div>
            <div class="recapitulatif__ligne">
              <span class="pochoir">Participant(e)</span>
              <span class="recapitulatif__valeur">{{ form.nomComplet }}</span>
            </div>
            <div class="recapitulatif__ligne">
              <span class="pochoir">Téléphone</span>
              <span class="recapitulatif__valeur chiffres">{{ form.telephone }}</span>
            </div>
            <div class="recapitulatif__ligne">
              <span class="pochoir">Montant à régler</span>
              <span class="lettrage chiffres recapitulatif__montant">
                {{ montantLisible(selection?.prix ?? 0) }} {{ selection?.devise ?? 'GNF' }}
              </span>
            </div>
          </div>
          <p class="recapitulatif__note">
            En déposant cette demande, vous vous engagez à régler les frais de
            la formation par Mobile Money. La confirmation du paiement se fait
            au guichet de la scolarité.
          </p>
          <q-banner v-if="messageErreur" class="note--erreur">
            <template #avatar><q-icon name="error" /></template>
            {{ messageErreur }}
          </q-banner>
        </q-card-section>

        <!-- Étape 3 : demande déposée -->
        <q-card-section v-if="etape === 3 && resultat">
          <div class="recapitulatif__succes">
            <div class="recapitulatif__tampon" aria-hidden="true">
              <span class="pochoir">Demande</span>
              <span class="lettrage">Déposée</span>
            </div>
            <p class="pochoir recapitulatif__ref">N° de dossier</p>
            <p class="lettrage chiffres recapitulatif__numero">{{ resultat.numero }}</p>
          </div>

          <div class="plaque recapitulatif__paiement">
            <div class="text-caption">À régler par Mobile Money</div>
            <div class="lettrage chiffres recapitulatif__somme">
              {{ montantLisible(resultat.montant) }} {{ resultat.devise }}
            </div>
            <p class="recapitulatif__paiement-texte">
              Rendez-vous au guichet de la scolarité pour régler ce montant
              ({{ resultat.numero }} en motivation). Dès réception du paiement,
              votre inscription passe <strong>confirmée</strong> et votre place
              est réservée.
            </p>
          </div>

          <q-banner class="note--info">
            <template #avatar><q-icon name="hourglass_top" /></template>
            Statut actuel de votre demande : <strong>en attente de paiement</strong>
            — vous recevrez votre attestation de formation en fin de parcours.
          </q-banner>
        </q-card-section>

        <q-card-actions align="right">
          <template v-if="etape === 1">
            <q-btn flat no-caps label="Fermer" v-close-popup />
            <q-btn
              color="primary"
              unelevated
              no-caps
              label="Voir le récapitulatif"
              :disable="!identiteValide"
              @click="etape = 2"
            >
              <q-tooltip v-if="!identiteValide">
                Renseignez d'abord votre nom et votre téléphone
              </q-tooltip>
            </q-btn>
          </template>
          <template v-else-if="etape === 2">
            <q-btn flat no-caps label="Retour" @click="etape = 1" />
            <q-btn
              color="primary"
              unelevated
              no-caps
              label="Déposer ma demande d'inscription"
              :loading="depotEnCours"
              @click="deposer"
            />
          </template>
          <template v-else>
            <q-btn flat no-caps label="Fermer" v-close-popup @click="fermer" />
            <q-btn
              color="primary"
              unelevated
              no-caps
              label="Inscrire un autre participant"
              @click="inscrireUnAutre"
            />
          </template>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
/**
 * Vitrine publique de la formation continue : même objet « formation » que
 * l'écran de gestion `/formations-admin`, mais restreint côté serveur aux
 * formations publiées. Tout passe par `formationsService`.
 */
import { computed, onMounted, ref } from 'vue';
import {
  formationsService,
  type FormationVitrine,
  type ResultatDepotInscription,
} from '../services/formations';
import { dateLisible, montantLisible } from '../utils/libelles';

const formations = ref<FormationVitrine[]>([]);
const chargement = ref(true);

const dialogInscription = ref(false);
const selection = ref<FormationVitrine | null>(null);
const etape = ref(1);
const depotEnCours = ref(false);
const messageErreur = ref('');
const resultat = ref<ResultatDepotInscription | null>(null);

const form = ref({ nomComplet: '', telephone: '', email: '', matricule: '' });

/** Les deux champs obligatoires du dépôt : contrôlés dès l'étape 1. */
const identiteValide = computed(
  () =>
    form.value.nomComplet.trim().length >= 2 &&
    form.value.telephone.trim().length >= 6,
);

async function charger() {
  chargement.value = true;
  try {
    const { data } = await formationsService.publiques();
    formations.value = Array.isArray(data) ? data : [];
  } finally {
    chargement.value = false;
  }
}

function periodeLisible(f: FormationVitrine): string {
  if (!f.dateDebut) return f.dateFin ? dateLisible(f.dateFin) : '';
  if (!f.dateFin) return dateLisible(f.dateDebut);
  return `${dateLisible(f.dateDebut)} → ${dateLisible(f.dateFin)}`;
}

function ouvrirInscription(f: FormationVitrine) {
  selection.value = f;
  reinitialiserFormulaire();
  dialogInscription.value = true;
}

function reinitialiserFormulaire() {
  form.value = { nomComplet: '', telephone: '', email: '', matricule: '' };
  messageErreur.value = '';
  resultat.value = null;
  etape.value = 1;
}

function fermer() {
  dialogInscription.value = false;
}

/** Enchaîner un second participant sur la même formation, sans ressortir. */
function inscrireUnAutre() {
  reinitialiserFormulaire();
}

async function deposer() {
  messageErreur.value = '';
  if (!identiteValide.value) {
    messageErreur.value = 'Le nom complet et le téléphone sont obligatoires';
    return;
  }
  depotEnCours.value = true;
  try {
    const { data } = await formationsService.inscriptionPublique(selection.value!.id, {
      nomComplet: form.value.nomComplet.trim(),
      telephone: form.value.telephone.trim(),
      email: form.value.email.trim() || undefined,
      matricule: form.value.matricule.trim() || undefined,
    });
    resultat.value = data;
    etape.value = 3;
  } catch (e: any) {
    messageErreur.value = e?.response?.data?.message ?? 'Dépôt impossible, réessayez';
  } finally {
    depotEnCours.value = false;
  }
}

onMounted(charger);
</script>

<style scoped lang="scss">
@use '../css/mixins' as *;

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
  color: rgba(250, 250, 247, 0.6);
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
  color: rgba(250, 250, 247, 0.88);
  margin: 0;
}

.vitrine__faits {
  display: grid;
  gap: var(--up-3);
  margin: 0;
  border-top: 2px solid rgba(250, 250, 247, 0.35);
  padding-top: var(--up-3);

  dt { color: rgba(250, 250, 247, 0.66); }
  dd { margin: 3px 0 0; font-size: 0.92rem; }
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
  border-bottom: 3px solid var(--up-encre);
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

// ----------------------------------------------------------------- carte
.carte-formation {
  padding: var(--up-4);
  display: flex;
  flex-direction: column;
  gap: var(--up-3);
}

.carte-formation__tete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-2);
}

.carte-formation__categorie {
  color: var(--up-encre-douce);
  margin: 0;
}

.carte-formation__places {
  border: 2px solid $vert;
  color: $vert;
  padding: 2px 6px;
  white-space: nowrap;
}

.carte-formation__places--dernieres {
  border-color: $jaune-fonce;
  color: $jaune-fonce;
}

.carte-formation__titre {
  font-size: 1.35rem;
  margin: 0;
  line-height: 1.12;
}

.carte-formation__description {
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--up-encre-douce);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.carte-formation__details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--up-2) var(--up-3);
  margin: 0;
  border-top: var(--up-filet-fin);
  padding-top: var(--up-3);

  dt { color: var(--up-encre-douce); }
  dd { margin: 2px 0 0; font-size: 0.95rem; }
}

.carte-formation__prix {
  border-top: var(--up-filet);
  padding-top: var(--up-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.carte-formation__prix-libelle {
  color: var(--up-encre-douce);
}

.carte-formation__montant {
  font-size: clamp(1.6rem, 1.1rem + 1.6vw, 2.3rem);
  color: $vert;
}

.carte-formation__devise {
  font-size: 0.7em;
  letter-spacing: 0.02em;
}

.carte-formation__cta { min-height: 52px; margin-top: auto; }

// ------------------------------------------------------------- récapitulatif
.recapitulatif {
  padding: var(--up-3);
  display: grid;
  gap: var(--up-2);
}

.recapitulatif__ligne {
  display: flex;
  justify-content: space-between;
  gap: var(--up-3);
  align-items: baseline;

  .pochoir { color: var(--up-encre-douce); }
}

.recapitulatif__valeur {
  text-align: right;
  font-weight: 600;
}

.recapitulatif__montant {
  color: $vert;
  font-size: 1.3rem;
}

.recapitulatif__note {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--up-encre-douce);
  margin: var(--up-3) 0 0;
}

.recapitulatif__succes {
  display: grid;
  gap: var(--up-2);
  justify-items: start;
}

.recapitulatif__tampon {
  display: inline-flex;
  align-items: center;
  gap: var(--up-2);
  border: 2px solid $vert;
  color: $vert;
  padding: var(--up-2) var(--up-3);
  transform: rotate(-3deg);
}

.recapitulatif__ref {
  color: var(--up-encre-douce);
  margin: var(--up-2) 0 0;
}

.recapitulatif__numero {
  font-size: clamp(1.7rem, 1.2rem + 2vw, 2.4rem);
  margin: 0;
}

.recapitulatif__paiement {
  padding: var(--up-4);
  display: grid;
  gap: var(--up-2);
  margin-top: var(--up-3);
}

.recapitulatif__somme {
  font-size: clamp(1.5rem, 1rem + 1.8vw, 2.2rem);
  color: $vert;
}

.recapitulatif__paiement-texte {
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
  max-width: 46ch;
}

@media (max-width: 1023px) {
  .vitrine__enseigne { padding: var(--up-5) var(--up-4); gap: var(--up-3); }
  .vitrine__faits { display: none; }
  .vitrine__catalogue { padding: var(--up-5) var(--up-4); }
}
</style>