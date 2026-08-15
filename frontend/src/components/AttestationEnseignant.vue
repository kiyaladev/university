<template>
  <q-card flat bordered class="carte">
    <q-card-section class="q-pb-none row items-center entete-attestation">
      <div class="col">
        <div class="text-subtitle2">Attestation de l’enseignant</div>
        <div class="text-caption text-grey-7">
          Faites signer, composer le code ou poser le doigt — un seul moyen suffit
        </div>
      </div>
      <span class="champ etat-attestation" :class="valide ? 'champ--present' : 'champ--attente-vide'">
        <q-icon :name="valide ? 'verified' : 'pending'" size="15px" />
        <span class="pochoir">{{ valide ? LIBELLE_ATTESTATION[modeRetenu] : 'en attente' }}</span>
      </span>
    </q-card-section>

    <q-tabs v-model="onglet" dense align="justify" narrow-indicator class="moyens">
      <q-tab name="signature" icon="draw" label="Signer" no-caps />
      <q-tab
        name="pin"
        icon="dialpad"
        label="Code"
        no-caps
        :disable="!moyens?.codePin || !pointages.enLigne"
      />
      <q-tab
        name="empreinte"
        icon="fingerprint"
        label="Doigt"
        no-caps
        :disable="!moyens?.empreinte"
      />
    </q-tabs>
    <q-separator />

    <q-tab-panels v-model="onglet" animated class="moyens-panneaux">
      <!-- ------------------------------------------------------ signature -->
      <q-tab-panel name="signature">
        <signature-pad
          :model-value="modele.signatureBase64 ?? null"
          label="L’enseignant signe ci-dessous, comme sur le registre papier"
          @update:model-value="(v) => maj({ signatureBase64: v ?? undefined })"
        />
      </q-tab-panel>

      <!-- ----------------------------------------------------- code personnel -->
      <q-tab-panel name="pin">
        <q-banner v-if="!pointages.enLigne" class="note--alerte q-mb-sm">
          <template #avatar><q-icon name="cloud_off" /></template>
          Hors ligne, le code ne peut pas être vérifié et ne doit pas être
          conservé sur l’appareil. Faites signer l’enseignant.
        </q-banner>
        <div class="text-caption text-grey-7 q-mb-sm">
          Tendez l’appareil à l’enseignant : il saisit lui-même son code personnel.
        </div>
        <q-input
          :model-value="modele.codePinEnseignant ?? ''"
          type="password"
          inputmode="numeric"
          maxlength="6"
          outlined
          label="Code personnel (4 à 6 chiffres)"
          input-class="saisie-code chiffres"
          @update:model-value="(v) => maj({ codePinEnseignant: String(v ?? '') || undefined })"
        >
          <template #prepend><q-icon name="dialpad" /></template>
        </q-input>
        <div class="text-caption text-grey-6 q-mt-xs">
          Le code est vérifié par le serveur au moment de l’enregistrement.
        </div>
      </q-tab-panel>

      <!-- -------------------------------------------------------- empreinte -->
      <q-tab-panel name="empreinte">
        <div v-if="passerelle.etat === 'absente'" class="text-center q-pa-md">
          <q-icon name="usb_off" size="40px" color="grey-7" />
          <div class="text-body2 q-mt-sm">Aucun lecteur d’empreintes détecté</div>
          <div class="text-caption text-grey-7">
            Démarrez la passerelle biométrique sur cet appareil, puis réessayez.
          </div>
          <q-input
            v-model="adressePasserelle"
            dense
            outlined
            class="q-mt-md"
            label="Adresse de la passerelle"
            @blur="enregistrerAdresse"
          />
          <q-btn flat no-caps icon="refresh" label="Rechercher le lecteur" class="q-mt-sm" @click="sonderPasserelle" />
        </div>

        <div v-else class="text-center q-pa-sm">
          <q-banner v-if="lecteurSimule" class="note--alerte q-mb-sm text-left">
            <template #avatar><q-icon name="science" /></template>
            Lecteur simulé : cette lecture sert à essayer l’application, elle
            n’atteste la présence de personne.
          </q-banner>

          <q-icon
            name="fingerprint"
            size="72px"
            :color="modele.empreinte ? 'positive' : 'primary'"
            :class="{ 'lecture-en-cours': lectureEnCours }"
          />
          <div class="text-body2 q-mt-sm">
            <template v-if="modele.empreinte">
              Empreinte reconnue — score {{ modele.empreinte.score }}/100
            </template>
            <template v-else>
              L’enseignant pose son {{ moyens?.empreinteDoigt ?? 'doigt' }} sur le lecteur
            </template>
          </div>
          <q-btn
            class="q-mt-md"
            :color="modele.empreinte ? 'grey-7' : 'primary'"
            :outline="!!modele.empreinte"
            unelevated
            no-caps
            :icon="modele.empreinte ? 'refresh' : 'fingerprint'"
            :label="modele.empreinte ? 'Relire l’empreinte' : 'Lire l’empreinte'"
            :loading="lectureEnCours"
            @click="lireEmpreinte"
          />
          <div v-if="erreurEmpreinte" class="text-caption text-negative q-mt-sm">
            {{ erreurEmpreinte }}
          </div>
        </div>
      </q-tab-panel>

    </q-tab-panels>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '../boot/axios';
import { usePointagesStore } from '../stores/pointages';
import SignaturePad from './SignaturePad.vue';
import { CLE_PASSERELLE, LIBELLE_ATTESTATION, urlPasserelle } from '../utils/libelles';
import { etatLecteur, verifierEmpreinte } from '../services/empreinte';

/** En dessous, inutile d'envoyer : le serveur refuserait de toute façon. */
const SEUIL_INDICATIF = 40;
import type { MoyensAttestation, Pointage, Seance } from '../types';

const pointages = usePointagesStore();
const lecteurSimule = ref(false);

/** Recueille l'attestation de l'enseignant selon le moyen dont il dispose. */
const props = defineProps<{ modelValue: Partial<Pointage>; seance: Seance | null }>();
const emit = defineEmits<{ 'update:modelValue': [Partial<Pointage>] }>();

const modele = computed(() => props.modelValue);
const onglet = ref<'signature' | 'pin' | 'empreinte'>('signature');
const moyens = ref<MoyensAttestation | null>(null);

const passerelle = ref<{ etat: 'inconnue' | 'presente' | 'absente'; pilote?: string }>({
  etat: 'inconnue',
});
const adressePasserelle = ref(urlPasserelle());
const lectureEnCours = ref(false);
const erreurEmpreinte = ref('');


const enseignantId = computed(() => props.seance?.affectation?.enseignant?.id ?? '');
const nomEnseignant = computed(() => {
  const e = props.seance?.affectation?.enseignant;
  return e ? `${e.nom} ${e.prenom}` : 'L’enseignant';
});

/** Moyen effectivement retenu, du plus fort au plus faible (même ordre que l'API). */
const modeRetenu = computed(() => {
  if (modele.value.empreinte) return 'EMPREINTE';
  if (modele.value.codePinEnseignant) return 'CODE_PIN';
  if (modele.value.signatureBase64) return 'SIGNATURE';
  return 'AUCUNE';
});

const valide = computed(() => modeRetenu.value !== 'AUCUNE');

function maj(champs: Partial<Pointage>) {
  emit('update:modelValue', { ...props.modelValue, ...champs });
}

// --------------------------------------------------------------- passerelle

function enregistrerAdresse() {
  localStorage.setItem(CLE_PASSERELLE, adressePasserelle.value.trim());
  void sonderPasserelle();
}

async function sonderPasserelle() {
  // Le lecteur est soit branché sur le téléphone (application Android), soit
  // sur le poste (passerelle locale) : le service s'en charge, l'écran ne sait
  // pas lequel des deux répond.
  const etat = await etatLecteur();
  lecteurSimule.value = etat.simule;
  passerelle.value = { etat: etat.disponible ? 'presente' : 'absente', pilote: etat.lecteur };
}

async function lireEmpreinte() {
  lectureEnCours.value = true;
  erreurEmpreinte.value = '';
  try {
    // Le gabarit enrôlé ne quitte le serveur que pour la comparaison locale.
    const { data: gabarit } = await api.get(
      `/attestation/enseignants/${enseignantId.value}/gabarit`,
    );

    const lecture = await verifierEmpreinte(enseignantId.value, gabarit.template);

    // Le seuil d'acceptation appartient au serveur : ici on ne fait que
    // prévenir tôt quand le doigt n'a manifestement pas été reconnu.
    if (lecture.score < SEUIL_INDICATIF) {
      erreurEmpreinte.value =
        `Doigt non reconnu (score ${lecture.score}) — réessayez ou utilisez un autre moyen`;
      maj({ empreinte: undefined });
      return;
    }

    maj({
      empreinte: {
        score: lecture.score,
        horodatage: lecture.horodatage,
        signature: lecture.signature,
        ...(lecture.appareilId ? { appareilId: lecture.appareilId } : {}),
      },
    });
  } catch (e: any) {
    erreurEmpreinte.value = e?.message ?? 'Lecteur inaccessible';
  } finally {
    lectureEnCours.value = false;
  }
}


// ------------------------------------------------------------- chargement

watch(
  () => props.seance?.id,
  async (id) => {
    moyens.value = null;
    if (!id || !enseignantId.value) return;

    const { data } = await api.get(`/attestation/enseignants/${enseignantId.value}/moyens`);
    moyens.value = data;

    // On propose d'emblée le moyen le plus fort dont dispose l'enseignant.
    if (data.empreinte) onglet.value = 'empreinte';
    else if (data.codePin) onglet.value = 'pin';
    else onglet.value = 'signature';

    if (data.empreinte) void sonderPasserelle();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
// Les panneaux d'onglets n'ont plus de remplissage par défaut ; celui-ci est
// une surface de saisie tenue dans une carte, il lui faut son air.
.moyens-panneaux :deep(.q-tab-panel) {
  padding: var(--up-3);
}

// Sur téléphone, l'état d'attestation prenait la moitié de la ligne et
// écrasait la consigne en colonne de six lignes. Il passe dessous, en pleine
// largeur : la consigne redevient une phrase.
@media (max-width: 599px) {
  .entete-attestation {
    flex-direction: column;
    align-items: stretch;
    gap: var(--up-2);
  }

  .entete-attestation .etat-attestation {
    justify-content: center;
  }
}

// L'état de l'attestation est un champ peint, comme partout ailleurs.
.etat-attestation {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  min-height: 26px;
  border: 2px solid var(--up-encre);
  flex: 0 0 auto;
}

.champ--attente-vide {
  background: transparent;
  color: var(--up-encre-douce);
}

// Quatre moyens sur un écran de 360 px : les onglets restent tous lisibles.
.moyens :deep(.q-tab) {
  padding: 6px 4px;
  min-height: 58px;
}

.moyens :deep(.q-tab__label) {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

:deep(.saisie-code) {
  font-size: 1.5rem;
  letter-spacing: 0.28em;
  font-weight: 700;
}

.lecture-en-cours {
  animation: pulsation 1.1s ease-in-out infinite;
}
@keyframes pulsation {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
</style>
