<template>
  <q-card flat bordered class="carte">
    <q-card-section class="q-pb-none row items-center entete-attestation">
      <div class="col">
        <div class="text-subtitle2">{{ t('pointage.attestation.title') }}</div>
        <div class="text-caption text-grey-7">
          {{ t('pointage.attestation.help') }}
        </div>
      </div>
      <span class="champ etat-attestation" :class="valide ? 'champ--present' : 'champ--attente-vide'">
        <q-icon :name="valide ? 'verified' : 'pending'" size="15px" />
        <span class="pochoir">{{ valide ? LIBELLE_ATTESTATION[modeRetenu] : t('pointage.attestation.pending') }}</span>
      </span>
    </q-card-section>

    <q-tabs v-model="onglet" dense align="justify" narrow-indicator class="moyens">
      <q-tab name="signature" icon="draw" :label="t('pointage.attestation.sign')" no-caps />
      <q-tab
        name="pin"
        icon="dialpad"
        :label="t('pointage.attestation.pin')"
        no-caps
        :disable="!moyens?.codePin || !pointages.enLigne"
      />
      <q-tab
        name="empreinte"
        icon="fingerprint"
        :label="t('pointage.attestation.finger')"
        no-caps
        :disable="!moyens?.empreinte"
      />
    </q-tabs>
    <q-separator />

    <q-tab-panels v-model="onglet" animated class="moyens-panneaux">
      <!-- ------------------------------------------------------ signature -->
      <q-tab-panel name="signature">
        <zone-signature
          :model-value="modele.signatureBase64 ?? null"
          :label="t('pointage.attestation.signatureHelp')"
          @update:model-value="(v) => maj({ signatureBase64: v ?? undefined })"
        />
      </q-tab-panel>

      <!-- ----------------------------------------------------- code personnel -->
      <q-tab-panel name="pin">
        <q-banner v-if="!pointages.enLigne" class="note--alerte q-mb-sm">
          <template #avatar><q-icon name="cloud_off" /></template>
          {{ t('pointage.attestation.offlinePin') }}
        </q-banner>
        <div class="text-caption text-grey-7 q-mb-sm">
          {{ t('pointage.attestation.pinHelp') }}
        </div>
        <q-input
          :model-value="modele.codePinEnseignant ?? ''"
          type="password"
          inputmode="numeric"
          maxlength="6"
          outlined
          :label="t('pointage.attestation.pinLabel')"
          input-class="saisie-code chiffres"
          @update:model-value="(v) => maj({ codePinEnseignant: String(v ?? '') || undefined })"
        >
          <template #prepend><q-icon name="dialpad" /></template>
        </q-input>
        <div class="text-caption text-grey-6 q-mt-xs">
          {{ t('pointage.attestation.pinServer') }}
        </div>
      </q-tab-panel>

      <!-- -------------------------------------------------------- empreinte -->
      <q-tab-panel name="empreinte">
        <div v-if="passerelle.etat === 'absente'" class="text-center q-pa-md">
          <q-icon name="usb_off" size="40px" color="grey-7" />
          <div class="text-body2 q-mt-sm">{{ t('pointage.attestation.noReader') }}</div>
          <div class="text-caption text-grey-7">
            {{ t('pointage.attestation.readerHelp') }}
          </div>
          <q-input
            v-model="adressePasserelle"
            dense
            outlined
            class="q-mt-md"
            :label="t('pointage.attestation.gateway')"
            @blur="enregistrerAdresse"
          />
          <q-btn
            flat
            no-caps
            icon="refresh"
            :label="t('pointage.attestation.findReader')"
            class="q-mt-sm"
            @click="sonderPasserelle"
          />
        </div>

        <div v-else class="text-center q-pa-sm">
          <q-banner v-if="lecteurSimule" class="note--alerte q-mb-sm text-left">
            <template #avatar><q-icon name="science" /></template>
            {{ t('pointage.attestation.simulated') }}
          </q-banner>

          <q-icon
            name="fingerprint"
            size="72px"
            :color="modele.empreinte ? 'positive' : 'primary'"
            :class="{ 'lecture-en-cours': lectureEnCours }"
          />
          <div class="text-body2 q-mt-sm">
            <template v-if="modele.empreinte">
              {{ t('pointage.attestation.recognised', { score: modele.empreinte.score }) }}
            </template>
            <template v-else>
              {{ t('pointage.attestation.placeFinger', { finger: doigt }) }}
            </template>
          </div>
          <q-btn
            class="q-mt-md"
            :color="modele.empreinte ? 'grey-7' : 'primary'"
            :outline="!!modele.empreinte"
            unelevated
            no-caps
            :icon="modele.empreinte ? 'refresh' : 'fingerprint'"
            :label="t(modele.empreinte ? 'pointage.attestation.reread' : 'pointage.attestation.read')"
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
import { useI18n } from 'vue-i18n';
import { attestationService } from '../services/attestation';
import { usePointagesStore } from '@/stores/pointages';
import ZoneSignature from './ZoneSignature.vue';
import { CLE_PASSERELLE, LIBELLE_ATTESTATION, urlPasserelle } from '@/shared/utils/libelles';
import { etatLecteur, verifierEmpreinte } from '@/shared/services/empreinte';

/** En dessous, inutile d'envoyer : le serveur refuserait de toute façon. */
const SEUIL_INDICATIF = 40;
import type { MoyensAttestation, Pointage, Seance } from '@/types';
import { messageErreurApi } from '@/shared/utils/erreur-http';

const pointages = usePointagesStore();
const { t, te } = useI18n();
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

/** Moyen effectivement retenu, du plus fort au plus faible (même ordre que l'API). */
const modeRetenu = computed(() => {
  if (modele.value.empreinte) return 'EMPREINTE';
  if (modele.value.codePinEnseignant) return 'CODE_PIN';
  if (modele.value.signatureBase64) return 'SIGNATURE';
  return 'AUCUNE';
});

const valide = computed(() => modeRetenu.value !== 'AUCUNE');
const doigt = computed(() => {
  const valeur = moyens.value?.empreinteDoigt;
  if (!valeur) return t('pointage.attestation.genericFinger');
  const cle = `pointage.attestation.fingerNames.${valeur.toLowerCase()}`;
  return te(cle) ? t(cle) : valeur;
});

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
    const gabarit = await attestationService.gabarit(enseignantId.value, props.seance?.id);

    const lecture = await verifierEmpreinte(enseignantId.value, gabarit.template);

    // Le seuil d'acceptation appartient au serveur : ici on ne fait que
    // prévenir tôt quand le doigt n'a manifestement pas été reconnu.
    if (lecture.score < SEUIL_INDICATIF) {
      erreurEmpreinte.value = t('pointage.attestation.notRecognised', { score: lecture.score });
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
  } catch (e: unknown) {
    erreurEmpreinte.value =
      messageErreurApi(e) ?? (e instanceof Error ? e.message : undefined) ?? t('pointage.attestation.unavailable');
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

    moyens.value = await attestationService.moyens(enseignantId.value, id);

    // On propose d'emblée le moyen le plus fort dont dispose l'enseignant.
    if (moyens.value.empreinte) onglet.value = 'empreinte';
    else if (moyens.value.codePin) onglet.value = 'pin';
    else onglet.value = 'signature';

    if (moyens.value.empreinte) void sonderPasserelle();
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
  border: var(--up-filet);
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
  font-weight: 590;
  letter-spacing: -0.01em;
}

:deep(.saisie-code) {
  font-size: 1.5rem;
  letter-spacing: 0.28em;
  font-weight: 590;
}

.lecture-en-cours {
  animation: pulsation 1.1s ease-in-out infinite;
}
@keyframes pulsation {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
