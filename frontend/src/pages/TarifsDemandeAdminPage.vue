<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('tarifsDemandeAdmin.title')" :subtitle="$t('tarifsDemandeAdmin.subtitle')">
      <template #actions>
<div v-if="!rolePasBon" class="col-auto q-gutter-sm">
        <q-btn
          outline
          color="primary"
          icon="description"
          :label="$t('tarifsDemandeAdmin.actions.document_requests')"
          no-caps
          :to="{ name: 'demandes-docs' }"
        />
        <q-btn
          unelevated
          color="primary"
          icon="add"
          :label="$t('tarifsDemandeAdmin.actions.new_tariff')"
          no-caps
          :disable="!optionsTypeCreation.length"
          @click="ouvrir(null)"
        >
          <q-tooltip v-if="!optionsTypeCreation.length">
            {{ $t('tarifsDemandeAdmin.actions.all_types_have_tariff') }}
          </q-tooltip>
        </q-btn>
      </div>
      </template>
    </page-header>

    <q-banner v-if="rolePasBon" class="note--erreur q-mb-md">
      {{ $t('tarifsDemandeAdmin.errors.role_forbidden', { role: auth.utilisateur?.role }) }}
    </q-banner>

    <q-table
      v-if="!rolePasBon"
      flat
      bordered
      class="carte"
      :rows="tarifs"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || tarifs.length > 0"
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">
          {{ $t('tarifsDemandeAdmin.table.empty') }}
        </div>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ libelleType(p.row.type) }}</q-td>
      </template>
      <template #body-cell-montant="p">
        <q-td :props="p" class="text-right chiffres">
          {{ montantLisible(p.row.montant) }} {{ p.row.devise }}
        </q-td>
      </template>
      <template #body-cell-delaiHeures="p">
        <q-td :props="p" class="text-right chiffres">
          {{ p.row.delaiHeures }} h
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="edit" :aria-label="$t('tarifsDemandeAdmin.table.edit_aria')" @click="ouvrir(p.row)">
            <q-tooltip>{{ $t('tarifsDemandeAdmin.table.edit_tooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="dialogOuvert">
      <q-card style="width: 480px; max-width: 95vw">
        <q-form ref="formRef" @submit.prevent="enregistrer">
          <q-card-section class="text-h6">
            {{ tarifEdite ? $t('tarifsDemandeAdmin.dialog.edit_title') : $t('tarifsDemandeAdmin.dialog.new_title') }}
          </q-card-section>
          <q-card-section>
            <q-select
              v-if="!tarifEdite"
              v-model="form.type"
              :options="optionsTypeCreation"
              emit-value
              map-options
              outlined
              dense
              :label="$t('tarifsDemandeAdmin.dialog.type_label')"
              :hint="$t('tarifsDemandeAdmin.dialog.type_hint')"
              class="q-mb-md"
              :rules="[(v) => !!v || $t('tarifsDemandeAdmin.dialog.type_required')]"
            />
            <q-input
              v-else
              :model-value="libelleType(form.type)"
              outlined
              dense
              :label="$t('tarifsDemandeAdmin.dialog.type_label')"
              disable
              :hint="$t('tarifsDemandeAdmin.dialog.type_hint')"
              class="q-mb-md"
            />
            <q-input
              v-model.number="form.montant"
              type="number"
              outlined
              dense
              min="0"
              :label="$t('tarifsDemandeAdmin.dialog.amount_label')"
              suffix="GNF"
              class="q-mb-md"
              :rules="[(v) => (v !== null && v !== undefined && v > 0) || $t('tarifsDemandeAdmin.dialog.amount_required')]"
            />
            <q-input
              v-model.number="form.delaiHeures"
              type="number"
              outlined
              dense
              min="1"
              :label="$t('tarifsDemandeAdmin.dialog.delay_label')"
              :rules="[(v) => (v !== null && v !== undefined && v > 0) || $t('tarifsDemandeAdmin.dialog.delay_required')]"
            />
          </q-card-section>
          <q-banner v-if="erreur" dense class="note--erreur q-mx-md q-mb-sm">
            <template #avatar><q-icon name="warning" /></template>
            {{ erreur }}
          </q-banner>
          <q-card-actions align="right">
            <q-btn flat :label="$t('tarifsDemandeAdmin.dialog.cancel')" no-caps v-close-popup />
            <q-btn
              color="primary"
              unelevated
              icon="save"
              :label="$t('tarifsDemandeAdmin.dialog.save')"
              no-caps
              :loading="enregistrement"
              :disable="!formulaireValide"
              type="submit"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import PageHeader from '../components/PageHeader.vue';
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { LIBELLE_TYPE_DEMANDE, montantLisible, optionsDepuis } from '../utils/libelles';
import type { TarifDemande, TypeDemandeDocument } from '../types';

const $q = useQuasar();
const { t } = useI18n();

const auth = useAuthStore();
const rolePasBon = computed(() => auth.utilisateur && auth.utilisateur.role !== 'ADMIN');

const tarifs = ref<TarifDemande[]>([]);
const chargement = ref(false);
const dialogOuvert = ref(false);
const tarifEdite = ref<TarifDemande | null>(null);
const enregistrement = ref(false);
const erreur = ref('');
const formRef = ref<{ validate: () => Promise<boolean>; resetValidation: () => void } | null>(null);

const form = ref({
  type: 'AUTRE' as TypeDemandeDocument,
  montant: 0,
  delaiHeures: 72,
});

/** Mêmes libellés de type que les écrans de demande (scolarité et étudiant). */
const TYPES_DOCUMENT = optionsDepuis(LIBELLE_TYPE_DEMANDE) as {
  value: TypeDemandeDocument;
  label: string;
}[];

function libelleType(t: string) {
  return LIBELLE_TYPE_DEMANDE[t as TypeDemandeDocument] ?? t;
}

const optionsTypeCreation = computed(() =>
  TYPES_DOCUMENT.filter((t) => !tarifs.value.some((x) => x.type === t.value)),
);

const formulaireValide = computed(
  () => !!form.value.type && form.value.montant > 0 && form.value.delaiHeures > 0,
);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'type', label: t('tarifsDemandeAdmin.table.columns.type'), field: 'type', align: 'left' },
  { name: 'montant', label: t('tarifsDemandeAdmin.table.columns.amount'), field: 'montant', align: 'right' },
  { name: 'delaiHeures', label: t('tarifsDemandeAdmin.table.columns.delay'), field: 'delaiHeures', align: 'right' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function ouvrir(t: TarifDemande | null) {
  tarifEdite.value = t;
  if (t) {
    form.value = { type: t.type, montant: t.montant, delaiHeures: t.delaiHeures };
  } else {
    const premierTypeDisponible =
      TYPES_DOCUMENT.find((x) => !tarifs.value.some((y) => y.type === x.value))?.value ?? 'AUTRE';
    form.value = { type: premierTypeDisponible, montant: 0, delaiHeures: 72 };
  }
  formRef.value?.resetValidation();
  dialogOuvert.value = true;
  erreur.value = '';
}

async function enregistrer() {
  const valide = await formRef.value?.validate();
  if (valide === false) return;
  enregistrement.value = true;
  erreur.value = '';
  try {
    if (tarifEdite.value) {
      await api.put(`/documents-demande/tarifs/${tarifEdite.value.id}`, {
        montant: form.value.montant,
        delaiHeures: form.value.delaiHeures,
      });
      $q.notify({ type: 'positive', message: t('tarifsDemandeAdmin.messages.updated') });
    } else {
      await api.post('/documents-demande/tarifs', {
        type: form.value.type,
        montant: form.value.montant,
        delaiHeures: form.value.delaiHeures,
      });
      $q.notify({ type: 'positive', message: t('tarifsDemandeAdmin.messages.created') });
    }
    dialogOuvert.value = false;
    await charger();
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? t('tarifsDemandeAdmin.errors.save_error');
  } finally {
    enregistrement.value = false;
  }
}

async function charger() {
  if (!auth.estAdmin) return;
  chargement.value = true;
  try {
    const { data } = await api.get('/documents-demande/tarifs');
    tarifs.value = Array.isArray(data) ? data : data.data ?? [];
  } catch {
    tarifs.value = [];
  } finally {
    chargement.value = false;
  }
}

onMounted(() => {
  void charger();
});
</script>
