<template>
  <q-dialog :model-value="ouvert" @update:model-value="emit('update:ouvert', $event)">
    <q-card style="width: 520px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ $t('enseignants.moyensDialog.title') }}</div>
        <div class="text-caption text-grey-7">
          {{
            $t('enseignants.moyensDialog.subtitle', { nom: enseignant?.nom, prenom: enseignant?.prenom })
          }}
        </div>
      </q-card-section>

      <q-linear-progress v-if="chargementMoyens" indeterminate color="primary" />

      <q-list v-if="!chargementMoyens" separator>
        <q-item>
          <q-item-section avatar><q-icon name="dialpad" color="secondary" /></q-item-section>
          <q-item-section>
            <q-item-label>{{ $t('enseignants.moyensDialog.codePersonnel.label') }}</q-item-label>
            <q-item-label caption>
              {{
                moyens?.codePin
                  ? $t('enseignants.moyensDialog.codePersonnel.defined')
                  : $t('enseignants.moyensDialog.codePersonnel.undefined')
              }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              dense
              no-caps
              :label="
                moyens?.codePin
                  ? $t('enseignants.moyensDialog.codePersonnel.reset')
                  : $t('enseignants.moyensDialog.codePersonnel.generate')
              "
              @click="reinitialiserPin"
            />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section avatar><q-icon name="fingerprint" color="accent" /></q-item-section>
          <q-item-section>
            <q-item-label>{{ $t('enseignants.moyensDialog.empreinte.label') }}</q-item-label>
            <q-item-label caption>
              {{
                moyens?.empreinte
                  ? t('enseignants.moyensDialog.empreinte.enrolled', { doigt: moyens.empreinteDoigt })
                  : passerellePrete
                    ? $t('enseignants.moyensDialog.empreinte.notEnrolledReady')
                    : $t('enseignants.moyensDialog.empreinte.notEnrolledNoReader')
              }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              dense
              no-caps
              :label="
                moyens?.empreinte
                  ? $t('enseignants.moyensDialog.empreinte.reenroll')
                  : $t('enseignants.moyensDialog.empreinte.enroll')
              "
              :disable="!passerellePrete"
              :loading="enrolementEnCours"
              @click="enrolerEmpreinte"
            >
              <q-tooltip v-if="!passerellePrete">
                {{ $t('enseignants.moyensDialog.empreinte.pluginTooltip') }}
              </q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>

      <q-banner v-if="codeGenere" class="note--valide q-ma-md">
        <template #avatar><q-icon name="key" /></template>
        {{ $t('enseignants.moyensDialog.newCodeLabel') }} <strong class="text-h6">{{ codeGenere }}</strong
        ><br />
        <span class="text-caption">{{ $t('enseignants.moyensDialog.newCodeHint') }}</span>
      </q-banner>

      <q-card-actions align="right">
        <q-btn flat no-caps :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { isAxiosError } from 'axios';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { passerelleConfiguree, urlPasserelle } from '@/shared/utils/libelles';
import type { Enseignant, MoyensAttestation } from '@/types';
import { enseignantsService } from '@/features/administration/services/enseignants';

/**
 * Moyens d'attestation d'un enseignant : code personnel et empreinte.
 *
 * Le lecteur d'empreintes est branché sur le poste, pas sur le serveur : la
 * passerelle locale est interrogée directement, et l'empreinte lue est ensuite
 * confiée à l'API.
 */
const props = defineProps<{
  /** Vrai quand le dialogue est ouvert. */
  ouvert: boolean;
  /** Enseignant dont les moyens sont consultés. */
  enseignant?: Enseignant | null;
}>();

const emit = defineEmits<{ 'update:ouvert': [ouvert: boolean] }>();

const $q = useQuasar();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const moyens = ref<MoyensAttestation | null>(null);
const passerellePrete = ref(false);
const enrolementEnCours = ref(false);
const codeGenere = ref('');
const chargementMoyens = ref(false);

async function charger() {
  const e = props.enseignant;
  if (!e) return;
  codeGenere.value = '';
  moyens.value = null;
  chargementMoyens.value = true;
  try {
    moyens.value = await enseignantsService.moyens(e.id);
  } catch {
    emit('update:ouvert', false);
    return;
  } finally {
    chargementMoyens.value = false;
  }

  // Le lecteur d'empreintes est branché sur le poste, pas sur le serveur.
  if (!passerelleConfiguree()) {
    passerellePrete.value = false;
    return;
  }
  try {
    const r = await fetch(`${urlPasserelle()}/etat`, { signal: AbortSignal.timeout(2500) });
    passerellePrete.value = (await r.json()).pret === true;
  } catch {
    passerellePrete.value = false;
  }
}

watch(
  () => [props.ouvert, props.enseignant?.id] as const,
  ([ouvert]) => {
    if (ouvert) void charger();
  },
);

async function reinitialiserPin() {
  const e = props.enseignant;
  if (!e) return;
  const ok = await confirmer({
    titre: t('enseignants.messages.resetPinTitle'),
    message: t('enseignants.messages.resetPinMessage'),
    ok: t('enseignants.messages.generate'),
  });
  if (!ok) return;
  try {
    const data = await enseignantsService.reinitialiserCodePin(e.id);
    codeGenere.value = data.code;
    moyens.value = { ...moyens.value!, codePin: true };
  } catch {
    /* notifié par l'intercepteur */
  }
}

/**
 * Le consentement se recueille devant l'enseignant, avant la lecture. Le refus
 * est un droit sans conséquence : le code personnel et la signature restent des
 * moyens de plein exercice.
 */
function recueillirConsentement(): Promise<boolean> {
  return confirmer({
    titre: t('enseignants.messages.consentTitle'),
    message: t('enseignants.messages.consentMessage'),
    ok: t('enseignants.messages.consentAccept'),
    libelleAnnuler: t('enseignants.messages.consentRefuse'),
    persistent: true,
  });
}

async function enrolerEmpreinte() {
  const e = props.enseignant;
  if (!e) return;
  if (!(await recueillirConsentement())) {
    $q.notify({
      type: 'info',
      message: t('enseignants.messages.enrolementAborted'),
      icon: 'pin',
    });
    return;
  }

  enrolementEnCours.value = true;
  try {
    const id = e.id;
    const reponse = await fetch(`${urlPasserelle()}/enroler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enseignantId: id }),
      signal: AbortSignal.timeout(30000),
    });
    const capture = await reponse.json();
    if (!reponse.ok) throw new Error(capture.erreur ?? t('enseignants.messages.enrolementReadFailed'));

    await enseignantsService.enregistrerEmpreinte(id, {
      template: capture.template,
      doigt: 'index droit',
      horodatage: capture.horodatage,
      signature: capture.signature,
      qualite: capture.qualite,
    });

    $q.notify({ type: 'positive', message: t('enseignants.messages.enrolementSuccess', { qualite: capture.qualite }) });
    moyens.value = { ...moyens.value!, empreinte: true, empreinteDoigt: 'index droit' };
  } catch (e: any) {
    // L'erreur de l'API est notifiée par l'intercepteur ; reste la passerelle
    // locale du lecteur (fetch, JSON illisible, capture refusée).
    if (!isAxiosError(e)) {
      $q.notify({ type: 'negative', message: e?.message ?? t('enseignants.messages.enrolementFailed') });
    }
  } finally {
    enrolementEnCours.value = false;
  }
}
</script>
