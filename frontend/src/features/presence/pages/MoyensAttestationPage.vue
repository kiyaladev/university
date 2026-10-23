<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('moyensAttestation.title')" :subtitle="$t('moyensAttestation.subtitle')" />

    <!-- Appareils de contrôle : administration et direction. -->
    <q-card v-if="peutVoirAppareils" flat bordered class="carte q-mb-lg">
      <q-card-section class="row items-center justify-between q-gutter-sm">
        <div>
          <div class="text-subtitle1 text-weight-medium">{{ $t('moyensAttestation.devices.title') }}</div>
          <div class="text-caption text-grey-7">{{ $t('moyensAttestation.devices.subtitle') }}</div>
        </div>
        <q-btn
          flat
          dense
          round
          icon="refresh"
          color="primary"
          :aria-label="$t('common.actions.refresh')"
          @click="chargerAppareils"
        >
          <q-tooltip>{{ $t('common.actions.refresh') }}</q-tooltip>
        </q-btn>
      </q-card-section>
      <q-separator />
      <q-table
        flat
        :rows="appareils"
        :columns="colonnesAppareils"
        row-key="id"
        :loading="chargementAppareils"
        :pagination="{ rowsPerPage: 0 }"
        :hide-bottom="true"
      >
        <template #no-data>
          <q-item>
            <q-item-section class="text-grey-7">
              {{ $t('moyensAttestation.devices.emptyState') }}
            </q-item-section>
          </q-item>
        </template>

        <template #body-cell-etat="p">
          <q-td :props="p">
            <q-badge
              :color="appareilActif(p.row) ? 'positive' : 'grey-6'"
              :label="appareilActif(p.row) ? $t('moyensAttestation.devices.active') : $t('moyensAttestation.devices.revoked')"
            />
          </q-td>
        </template>

        <template #body-cell-dernierUsage="p">
          <q-td :props="p">{{ p.row.dernierUsage ? dateHeureLisible(p.row.dernierUsage) : '—' }}</q-td>
        </template>

        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              v-if="appareilActif(p.row)"
              flat
              dense
              round
              icon="block"
              color="negative"
              :aria-label="$t('moyensAttestation.actions.revoke')"
              @click="revoquer(p.row)"
            >
              <q-tooltip>{{ $t('moyensAttestation.actions.revoke') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- Moyens d'un enseignant. -->
    <q-card v-if="peutGererMoyens" flat bordered class="carte">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium">{{ $t('moyensAttestation.teacher.title') }}</div>
        <div class="text-caption text-grey-7 q-mb-md">{{ $t('moyensAttestation.teacher.subtitle') }}</div>

        <champ-recherche
          v-model="enseignantId"
          endpoint="/enseignants"
          :label="$t('moyensAttestation.teacher.teacher')"
          :label-fn="libelleEnseignant"
        />

        <div v-if="enseignantId" class="q-mt-md">
          <div v-if="chargementMoyens" class="text-caption text-grey-7">
            {{ $t('common.messages.loading') }}
          </div>

          <template v-else-if="moyens">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-6">
                <q-item dense class="bg-grey-1 rounded-borders">
                  <q-item-section avatar>
                    <q-icon :name="moyens.codePin ? 'check_circle' : 'cancel'" :color="moyens.codePin ? 'positive' : 'grey-6'" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t('moyensAttestation.teacher.codePin') }}</q-item-label>
                    <q-item-label caption>
                      {{ moyens.codePin ? $t('moyensAttestation.teacher.codePinSet') : $t('moyensAttestation.teacher.codePinUnset') }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </div>
              <div class="col-12 col-sm-6">
                <q-item dense class="bg-grey-1 rounded-borders">
                  <q-item-section avatar>
                    <q-icon :name="moyens.empreinte ? 'check_circle' : 'cancel'" :color="moyens.empreinte ? 'positive' : 'grey-6'" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t('moyensAttestation.teacher.empreinte') }}</q-item-label>
                    <q-item-label caption>
                      {{ moyens.empreinte
                        ? moyens.empreinteDoigt || $t('moyensAttestation.teacher.empreinteSet')
                        : $t('moyensAttestation.teacher.empreinteUnset') }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </div>
            </div>

            <div class="row q-gutter-sm q-mt-md">
              <q-btn
                outline
                dense
                no-caps
                icon="pin"
                color="primary"
                :label="$t('moyensAttestation.actions.defineCode')"
                @click="ouvrirCodePin"
              />
              <q-btn
                outline
                dense
                no-caps
                icon="autorenew"
                color="primary"
                :label="$t('moyensAttestation.actions.resetCode')"
                @click="reinitialiserCode"
              />
              <q-btn
                v-if="moyens.codePin"
                outline
                dense
                no-caps
                icon="delete"
                color="negative"
                :label="$t('moyensAttestation.actions.removeCode')"
                @click="supprimerCode"
              />
              <q-btn
                v-if="moyens.empreinte"
                outline
                dense
                no-caps
                icon="fingerprint"
                color="negative"
                :label="$t('moyensAttestation.actions.removeEmpreinte')"
                @click="supprimerEmpreinte"
              />
            </div>
          </template>
        </div>
      </q-card-section>
    </q-card>

    <!-- Définition du code personnel. -->
    <q-dialog v-model="dialogCodeOuvert">
      <q-card style="min-width: 320px">
        <q-card-section class="text-h6">{{ $t('moyensAttestation.codeDialog.title') }}</q-card-section>
        <q-card-section class="q-pt-none">
          <p class="text-body2 text-grey-8 q-mb-md">{{ $t('moyensAttestation.codeDialog.subtitle') }}</p>
          <q-input
            v-model="codePin"
            type="password"
            outlined
            dense
            maxlength="6"
            :label="$t('moyensAttestation.codeDialog.code')"
            :hint="$t('moyensAttestation.codeDialog.hint')"
            @keyup.enter="definirCodePin"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('common.actions.cancel')" @click="dialogCodeOuvert = false" />
          <q-btn
            unelevated
            color="primary"
            no-caps
            :label="$t('common.actions.save')"
            :loading="envoiCode"
            @click="definirCodePin"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Code généré : affiché une seule fois. -->
    <q-dialog v-model="dialogCodeGenereOuvert">
      <q-card style="min-width: 320px">
        <q-card-section class="text-h6">{{ $t('moyensAttestation.codeDialog.generatedTitle') }}</q-card-section>
        <q-card-section class="q-pt-none">
          <p class="text-body2 text-grey-8">{{ $t('moyensAttestation.codeDialog.generatedSubtitle') }}</p>
          <div class="text-h4 text-center q-my-md chiffres">{{ codeGenere }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('common.actions.close')" @click="dialogCodeGenereOuvert = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { dateHeureLisible } from '@/shared/utils/libelles';
import {
  ROLES_GESTION_APPAREILS,
  ROLES_GESTION_MOYENS,
  appareilActif,
  attestationService,
  type AppareilAttestation,
  type MoyensAttestation,
} from '../services/attestation';

const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();
const $q = useQuasar();

const appareils = ref<AppareilAttestation[]>([]);
const chargementAppareils = ref(false);

const enseignantId = ref<string | null>(null);
const moyens = ref<MoyensAttestation | null>(null);
const chargementMoyens = ref(false);

const dialogCodeOuvert = ref(false);
const dialogCodeGenereOuvert = ref(false);
const codePin = ref('');
const codeGenere = ref('');
const envoiCode = ref(false);

/** L'API réserve les appareils à l'administration et à la direction. */
const peutVoirAppareils = computed(() => auth.aRole([...ROLES_GESTION_APPAREILS]));
/** Les moyens d'un enseignant : administration, scolarité, chef de département, direction. */
const peutGererMoyens = computed(() => auth.aRole([...ROLES_GESTION_MOYENS]));

const colonnesAppareils = computed<QTableColumn[]>(() => [
  { name: 'libelle', label: t('moyensAttestation.devices.columns.device'), field: 'libelle', align: 'left' },
  { name: 'dernierUsage', label: t('moyensAttestation.devices.columns.lastUsed'), field: 'dernierUsage', align: 'left' },
  { name: 'etat', label: t('moyensAttestation.devices.columns.status'), field: 'actif', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function libelleEnseignant(enseignant: { nom?: string; prenom?: string; matricule?: string }): string {
  const nom = `${enseignant?.prenom ?? ''} ${enseignant?.nom ?? ''}`.trim();
  return nom ? `${nom}${enseignant?.matricule ? ` (${enseignant.matricule})` : ''}` : (enseignant?.matricule ?? '');
}

async function chargerAppareils() {
  if (!peutVoirAppareils.value) return;
  chargementAppareils.value = true;
  try {
    appareils.value = await attestationService.appareils();
  } catch {
    appareils.value = [];
  } finally {
    chargementAppareils.value = false;
  }
}

async function chargerMoyens() {
  if (!enseignantId.value) {
    moyens.value = null;
    return;
  }
  chargementMoyens.value = true;
  try {
    moyens.value = await attestationService.moyens(enseignantId.value);
  } catch {
    moyens.value = null;
  } finally {
    chargementMoyens.value = false;
  }
}

async function revoquer(appareil: AppareilAttestation) {
  const ok = await confirmer({
    titre: t('moyensAttestation.revokeDialog.title'),
    message: t('moyensAttestation.revokeDialog.message', { device: appareil.libelle }),
    ok: t('common.actions.yes_delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await attestationService.revoquerAppareil(appareil.id);
    $q.notify({ type: 'positive', message: t('moyensAttestation.messages.deviceRevoked') });
    await chargerAppareils();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

function ouvrirCodePin() {
  codePin.value = '';
  dialogCodeOuvert.value = true;
}

async function definirCodePin() {
  const code = codePin.value.trim();
  if (!/^\d{4,6}$/.test(code)) {
    $q.notify({ type: 'warning', message: t('moyensAttestation.codeDialog.invalid') });
    return;
  }
  envoiCode.value = true;
  try {
    await attestationService.definirCodePin(enseignantId.value!, code);
    $q.notify({ type: 'positive', message: t('moyensAttestation.messages.codeSaved') });
    dialogCodeOuvert.value = false;
    await chargerMoyens();
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    envoiCode.value = false;
  }
}

async function reinitialiserCode() {
  const ok = await confirmer({
    titre: t('moyensAttestation.resetDialog.title'),
    message: t('moyensAttestation.resetDialog.message'),
    ok: t('moyensAttestation.actions.resetCode'),
  });
  if (!ok) return;
  try {
    const reponse = await attestationService.reinitialiserCodePin(enseignantId.value!);
    codeGenere.value = reponse.code;
    dialogCodeGenereOuvert.value = true;
    await chargerMoyens();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

async function supprimerCode() {
  const ok = await confirmer({
    titre: t('moyensAttestation.removeCodeDialog.title'),
    message: t('moyensAttestation.removeCodeDialog.message'),
    ok: t('common.actions.yes_delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await attestationService.supprimerCodePin(enseignantId.value!);
    $q.notify({ type: 'positive', message: t('moyensAttestation.messages.codeRemoved') });
    await chargerMoyens();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

async function supprimerEmpreinte() {
  const ok = await confirmer({
    titre: t('moyensAttestation.removeEmpreinteDialog.title'),
    message: t('moyensAttestation.removeEmpreinteDialog.message'),
    ok: t('common.actions.yes_delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await attestationService.supprimerEmpreinte(enseignantId.value!);
    $q.notify({ type: 'positive', message: t('moyensAttestation.messages.empreinteRemoved') });
    await chargerMoyens();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

watch(enseignantId, chargerMoyens);

onMounted(chargerAppareils);
</script>
