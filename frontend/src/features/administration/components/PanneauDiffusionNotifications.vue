<template>
  <div class="notifications__diffusion">
    <!-- Diffusion manuelle -->
    <q-form ref="formRef" @submit.prevent="confirmerEnvoi">
      <section class="plaque notif-bloc">
        <h2 class="pochoir section-titre">{{ $t('notifications.broadcast.generalNotice.title') }}</h2>

        <q-select
          v-model="motif"
          :options="motifs"
          outlined
          dense
          emit-value
          map-options
          :label="$t('common.fields.motif')"
        />

        <p class="pochoir notif-bloc__titre">{{ $t('notifications.broadcast.generalNotice.recipientsLabel') }}</p>
        <q-option-group v-model="destination" :options="optionsDestinataires" dense class="q-mb-sm" />

        <q-input
          v-if="destination === 'numeros'"
          v-model="numerosSaisis"
          type="textarea"
          outlined
          dense
          :label="$t('notifications.broadcast.generalNotice.numbersLabel')"
          :rules="[
            (v) =>
              v
                ? v
                    .split(/[\s,;]+/)
                    .filter(Boolean)
                    .every((n: string) => /^\+?[\d\s().-]{6,20}$/.test(n)) ||
                  t('notifications.broadcast.generalNotice.numbersInvalid')
                : true,
          ]"
        />

        <q-input
          v-model="message"
          type="textarea"
          outlined
          :label="$t('notifications.broadcast.generalNotice.messageLabel')"
          maxlength="160"
          counter
          :rules="[(v) => !!v || t('notifications.broadcast.generalNotice.messageRequired')]"
        >
          <template #hint>{{ $t('notifications.broadcast.generalNotice.messageHint') }}</template>
        </q-input>

        <q-banner dense class="note--info">
          <template #avatar><q-icon name="info" /></template>
          <div v-if="destination === 'tous'">
            {{ $t('notifications.broadcast.generalNotice.recipientsEstimated', { n: nbInscrits }) }}
          </div>
          <div v-else-if="destination === 'numeros'">
            {{ $t('notifications.broadcast.generalNotice.numbersEntered', { n: numerosComptes }) }}
          </div>
          <div v-else>
            {{ $t('notifications.broadcast.generalNotice.deliberationBroadcast') }}
          </div>
        </q-banner>

        <div class="row q-gutter-sm">
          <q-btn
            outline
            color="primary"
            no-caps
            icon="science"
            :label="$t('notifications.broadcast.generalNotice.testSend')"
            :loading="testEnvoi"
            @click="testerEnvoi"
          />
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="send"
            :label="$t('notifications.broadcast.generalNotice.send')"
            :loading="envoi"
            :disable="!formulaireValide"
            @click="confirmerEnvoi"
          />
        </div>
      </section>
    </q-form>

    <!-- Résultats de délibération -->
    <section class="plaque notif-bloc">
      <h2 class="section-titre">{{ $t('notifications.broadcast.deliberationResults.title') }}</h2>
      <p class="notif-bloc__aide">
        {{ $t('notifications.broadcast.deliberationResults.help') }}
      </p>
      <q-select
        v-model="deliberationId"
        :options="optionsDeliberations"
        outlined
        dense
        emit-value
        map-options
        :label="$t('notifications.broadcast.deliberationResults.selectLabel')"
        :loading="chargementDeliberations"
      />
      <q-btn
        unelevated
        color="secondary"
        no-caps
        icon="fact_check"
        :label="$t('notifications.broadcast.deliberationResults.submit')"
        :loading="envoiResultats"
        :disable="!deliberationId"
        @click="diffuserResultats"
      />
    </section>
  </div>

  <!-- Résumé du dernier envoi -->
  <div v-if="resume" class="plaque notif-resume" :class="{ 'notif-resume--partiel': resume.echouees }">
    <div class="notif-resume__cellule">
      <p class="pochoir">{{ $t('notifications.broadcast.summary.recipients') }}</p>
      <p class="lettrage chiffres">{{ resume.total }}</p>
    </div>
    <div class="notif-resume__cellule text-positive">
      <p class="pochoir">{{ $t('notifications.broadcast.summary.sent') }}</p>
      <p class="lettrage chiffres">{{ resume.envoyees }}</p>
    </div>
    <div class="notif-resume__cellule" :class="resume.echouees ? 'text-negative' : 'text-positive'">
      <p class="pochoir">{{ $t('notifications.broadcast.summary.failed') }}</p>
      <p class="lettrage chiffres">{{ resume.echouees }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { LIBELLE_SESSION_DELIBERATION } from '@/shared/utils/libelles';
import {
  notificationsService,
  type DeliberationDiffusion,
  type ResumeEnvoi,
} from '@/features/administration/services/notifications';

/**
 * Panneau de diffusion des notifications : l'avis général, la diffusion des
 * résultats d'une délibération, et le résumé du dernier envoi.
 *
 * Le panneau est autonome : il porte la saisie, les confirmations et les
 * envois. Il prévient la page d'un envoi réussi (`envoye`) pour que
 * l'historique et les compteurs se remettent à jour.
 */
const emit = defineEmits<{ envoye: [] }>();

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();

const formRef = ref();

const formulaireValide = computed(() => {
  if (!message.value.trim()) return false;
  if (destination.value === 'numeros') {
    const numeros = decouperNumeros(numerosSaisis.value);
    if (!numeros.length) return false;
    const tousValides = numeros.every((n) => /^\+?[\d\s().-]{6,20}$/.test(n));
    if (!tousValides) return false;
  }
  return true;
});

// ----------------------------------------------------------------- diffusion
const motifs = computed(() => [
  { label: t('notifications.broadcast.motifs.avis'), value: 'AVIS' },
  { label: t('notifications.broadcast.motifs.resultats'), value: 'RESULTATS' },
  { label: t('notifications.broadcast.motifs.inscription'), value: 'INSCRIPTION' },
  { label: t('common.fields.payment'), value: 'PAIEMENT' },
  { label: t('notifications.broadcast.motifs.convocation'), value: 'CONVOCATION' },
  { label: t('notifications.broadcast.motifs.autre'), value: 'AUTRE' },
]);

const optionsDestinataires = computed(() => [
  { label: t('notifications.broadcast.recipientOptions.tous'), value: 'tous' },
  { label: t('notifications.broadcast.recipientOptions.numeros'), value: 'numeros' },
  { label: t('notifications.broadcast.recipientOptions.resultatsDeliberation'), value: 'resultatsDeliberation' },
]);

const motif = ref('AVIS');
const destination = ref<'tous' | 'numeros' | 'resultatsDeliberation'>('tous');
const numerosSaisis = ref('');
const message = ref('');
const envoi = ref(false);
const testEnvoi = ref(false);
const resume = ref<ResumeEnvoi | null>(null);

const nbInscrits = ref(0);

const numerosComptes = computed(
  () =>
    numerosSaisis.value
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean).length,
);

function decouperNumeros(texte: string): string[] {
  return texte
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

async function chargerNbInscrits() {
  try {
    const estimation = await notificationsService.estimerDestinataires('tousInscrits');
    nbInscrits.value = estimation?.total ?? 0;
  } catch {
    nbInscrits.value = 0;
  }
}

async function confirmerEnvoi() {
  const valide = await formRef.value?.validate();
  if (valide === false) return;
  const nbDestinaires =
    destination.value === 'tous' ? nbInscrits.value : destination.value === 'numeros' ? numerosComptes.value : 0;
  const ok = await confirmer({
    titre: t('notifications.messages.confirmSendTitle'),
    message: t('notifications.messages.confirmSendMessage', { n: nbDestinaires }),
    ok: t('notifications.messages.confirmSendOk'),
  });
  if (ok) await envoyer();
}

async function envoyer() {
  envoi.value = true;
  try {
    const numeros = destination.value === 'numeros' ? decouperNumeros(numerosSaisis.value) : [];
    if (destination.value === 'numeros' && !numeros.length) {
      $q.notify({ type: 'warning', message: t('notifications.messages.enterAtLeastOneNumber') });
      return;
    }
    const data = await notificationsService.envoyer({
      message: message.value,
      motif: motif.value,
      tousInscrits: destination.value === 'tous',
      destinatairesTelephones: destination.value === 'numeros' ? numeros : undefined,
      mode: destination.value === 'tous' ? 'tousInscrits' : 'manuel',
    });
    resume.value = { total: data.total, envoyees: data.envoyees, echouees: data.echouees };
    $q.notify({
      type: data.echouees ? 'warning' : 'positive',
      message: t('notifications.messages.sentSummary', {
        envoyees: data.envoyees,
        echoueesSuffix: data.echouees ? t('notifications.messages.sentSummaryFailedSuffix', { n: data.echouees }) : '',
      }),
    });
    emit('envoye');
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    envoi.value = false;
  }
}

async function testerEnvoi() {
  if (!message.value.trim()) {
    $q.notify({ type: 'warning', message: t('notifications.messages.enterMessageBeforeTest') });
    return;
  }
  testEnvoi.value = true;
  try {
    const data = await notificationsService.envoyer({
      message: message.value,
      motif: motif.value,
      mode: 'manuel',
      destinatairesTelephones: ['+224000000001', '+224000000002'],
      simulation: true,
    });
    resume.value = { total: data.total, envoyees: data.envoyees, echouees: data.echouees };
    $q.notify({
      type: 'info',
      message: t('notifications.messages.testSentSummary', { total: data.total, envoyees: data.envoyees }),
    });
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    testEnvoi.value = false;
  }
}

// ------------------------------------------------- délibération (résultats)
const deliberationId = ref<string | null>(null);
const deliberations = ref<DeliberationDiffusion[]>([]);
const chargementDeliberations = ref(false);
const envoiResultats = ref(false);

const optionsDeliberations = computed(() =>
  deliberations.value.map((d) => ({
    label: `${d.annee} · ${d.promotion} · ${LIBELLE_SESSION_DELIBERATION[d.session as 'NORMALE' | 'RATTRAPAGE'] ?? d.session} (${d.lignes} lignes)`,
    value: d.id,
  })),
);

async function chargerDeliberations() {
  chargementDeliberations.value = true;
  try {
    deliberations.value = await notificationsService.deliberations();
  } catch {
    deliberations.value = [];
  } finally {
    chargementDeliberations.value = false;
  }
}

async function diffuserResultats() {
  if (!deliberationId.value) return;
  envoiResultats.value = true;
  try {
    const data = await notificationsService.diffuserResultats(deliberationId.value);
    resume.value = { total: data.total, envoyees: data.envoyees, echouees: data.echouees };
    $q.notify({
      type: data.echouees ? 'warning' : 'positive',
      message: t('notifications.messages.resultsBroadcastSummary', {
        envoyees: data.envoyees,
        echouees: data.echouees,
      }),
    });
    emit('envoye');
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    envoiResultats.value = false;
  }
}

onMounted(() => {
  void chargerNbInscrits();
  if (auth.aRole(['ADMIN', 'DIRECTION', 'SCOLARITE'])) void chargerDeliberations();
});
</script>

<style scoped lang="scss">
.notifications__diffusion {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--up-4);
  align-items: start;
}

.notif-bloc {
  background: var(--up-plaque);
  border: var(--up-filet);
  padding: var(--up-4);
  display: flex;
  flex-direction: column;
  gap: var(--up-3);

  .section-titre {
    margin: 0;
  }
}

.notif-bloc__titre {
  margin: var(--up-2) 0 0;
  color: var(--up-encre-douce);
}

.notif-bloc__aide {
  margin: 0;
  font-size: 0.88rem;
  color: var(--up-encre-douce);
}

.notif-resume {
  margin-top: var(--up-4);
  display: grid;
  grid-template-columns: repeat(3, 1fr);

  & > * + * {
    border-left: var(--up-filet);
  }

  &--partiel {
    border-color: $rouge;
  }
}

.notif-resume__cellule {
  padding: var(--up-3);
  text-align: center;

  p {
    margin: 0;
  }
  .lettrage {
    font-size: 1.8rem;
  }
}
</style>
