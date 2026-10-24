<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="t('demandeDocuments.createDialog.title')"
    :envoi="enregistrement"
    :libelle-valider="$t('common.actions.submit')"
    icone-valider="send"
    :desactive="!form.type"
    @valider="envoyer"
  >
    <span class="section-titre">{{ t('demandeDocuments.createDialog.documentType') }}</span>
    <q-select
      v-model="form.type"
      :options="optionsType"
      outlined
      dense
      emit-value
      map-options
      :label="$t('common.fields.type')"
    >
      <template #option="scope">
        <q-item v-bind="scope.itemProps">
          <q-item-section>
            <q-item-label>{{ scope.opt.label }}</q-item-label>
            <q-item-label v-if="scope.opt.montant != null" caption>
              {{ montantLisible(scope.opt.montant) }} {{ scope.opt.devise ?? DEVISE }}
              <span v-if="scope.opt.delaiHeures">
                · {{ t('demandeDocuments.createDialog.delay', { hours: scope.opt.delaiHeures }) }}</span
              >
            </q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>

    <template v-if="tarifSelectionne">
      <q-banner class="note--info q-mt-sm">
        {{ t('demandeDocuments.createDialog.fees') }}
        <strong>{{ montantLisible(tarifSelectionne.montant) }} {{ tarifSelectionne.devise }}</strong>
        <span v-if="tarifSelectionne.delaiHeures">
          — {{ t('demandeDocuments.createDialog.usualDelay', { hours: tarifSelectionne.delaiHeures }) }}</span
        >.
      </q-banner>
    </template>
    <q-banner v-else-if="form.type" class="note--alerte q-mt-sm">
      {{ t('demandeDocuments.createDialog.noFeeConfigured') }}
    </q-banner>

    <span class="section-titre">{{ $t('common.fields.motif') }}</span>
    <q-input
      v-model="form.motif"
      outlined
      dense
      type="textarea"
      rows="2"
      counter
      :max-length="500"
      :label="t('demandeDocuments.createDialog.reasonLabel')"
      :placeholder="t('demandeDocuments.createDialog.reasonPlaceholder')"
    />

    <span class="section-titre">{{ t('demandeDocuments.createDialog.enrollmentSection') }}</span>
    <champ-recherche
      v-if="inscriptions.length"
      v-model="form.inscriptionId"
      endpoint="/inscriptions"
      :label-fn="(i) => `${i.numero} — ${i.promotion?.nom ?? ''}`"
      :label="$t('demandeDocuments.detail.enrollment')"
      :preload="true"
    />
    <q-banner v-else class="note--info q-mt-sm">
      {{ t('demandeDocuments.createDialog.noEnrollment') }}
    </q-banner>

    <q-banner v-if="erreur" dense class="note--erreur q-mt-md">
      <template #avatar><q-icon name="warning" /></template>
      {{ erreur }}
    </q-banner>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { DEVISE, LIBELLE_TYPE_DEMANDE, montantLisible } from '@/shared/utils/libelles';
import { demandesDocumentsService } from '../services/documents-demande';
import { inscriptionsService } from '../services/inscriptions';
import type { Inscription } from '@/types';
import type { DemandeDocument, TarifDemande, TypeDemandeDocument } from '../types';
import { messageErreurApi } from '@/shared/utils/erreur-http';

const ouvert = defineModel<boolean>({ required: true });
const emit = defineEmits<{ enregistre: [DemandeDocument] }>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);
const erreur = ref('');

const tarifs = ref<TarifDemande[]>([]);
const inscriptions = ref<Inscription[]>([]);
const form = ref<{
  type: TypeDemandeDocument | null;
  motif: string;
  inscriptionId: string | null;
}>({
  type: null,
  motif: '',
  inscriptionId: null,
});

const optionsType = computed(() =>
  (Object.keys(LIBELLE_TYPE_DEMANDE) as TypeDemandeDocument[]).map((value) => {
    const tarif = tarifs.value.find((t) => t.type === value);
    return {
      label: LIBELLE_TYPE_DEMANDE[value],
      value,
      montant: tarif?.montant,
      devise: tarif?.devise,
      delaiHeures: tarif?.delaiHeures,
    };
  }),
);

const tarifSelectionne = computed(() => tarifs.value.find((t) => t.type === form.value.type) ?? null);

watch(ouvert, async (o) => {
  if (!o) return;
  erreur.value = '';
  form.value = { type: null, motif: '', inscriptionId: null };
  try {
    const [tarifsCharges, inscriptionsChargees] = await Promise.all([
      demandesDocumentsService.tarifs(),
      inscriptionsService.tous({ all: '1' }),
    ]);
    tarifs.value = tarifsCharges;
    inscriptions.value = inscriptionsChargees;
  } catch {
    tarifs.value = [];
    inscriptions.value = [];
  }
});

async function envoyer() {
  if (!form.value.type) return;
  enregistrement.value = true;
  erreur.value = '';
  try {
    const body: Record<string, unknown> = { type: form.value.type };
    if (form.value.motif.trim()) body.motif = form.value.motif.trim();
    if (form.value.inscriptionId) body.inscriptionId = form.value.inscriptionId;
    const demande = await demandesDocumentsService.creer(body, { silencieux: true });
    $q.notify({ type: 'positive', message: t('demandeDocuments.createDialog.created', { number: demande.numero }) });
    emit('enregistre', demande);
    ouvert.value = false;
  } catch (e: unknown) {
    erreur.value = messageErreurApi(e) ?? t('demandeDocuments.createDialog.createFailed');
  } finally {
    enregistrement.value = false;
  }
}
</script>
