<template>
  <q-page class="q-pa-md page-imports">
    <en-tete-page :title="t('imports.title')" :subtitle="t('imports.subtitle')" />

    <q-card flat bordered class="carte q-mb-md">
      <q-card-section class="row q-col-gutter-md items-start">
        <div class="col-12 col-md-4">
          <q-select
            v-model="type"
            :options="optionsType"
            emit-value
            map-options
            outlined
            :label="t('imports.type')"
            :disable="!!chargement"
          />
        </div>
        <div class="col-12 col-md-5">
          <q-file
            v-model="fichier"
            accept=".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            outlined
            clearable
            :label="t('imports.file')"
            :disable="!!chargement"
            @update:model-value="effacerResultats"
          >
            <template #prepend><q-icon name="attach_file" /></template>
          </q-file>
        </div>
        <div class="col-12 col-md-3 flex items-center q-gutter-sm">
          <q-btn
            outline
            no-caps
            icon="download"
            :label="t('imports.template')"
            :disable="!type || !!chargement"
            @click="telechargerModele"
          />
        </div>
        <div class="col-12 text-caption text-grey-7">{{ t('imports.separatorHelp') }}</div>
        <div class="col-12 flex justify-end q-gutter-sm">
          <q-btn
            color="primary"
            no-caps
            icon="fact_check"
            :label="t('common.actions.preview')"
            :loading="chargement === 'preview'"
            :disable="!type || !fichier || !!chargement"
            @click="previsualiser"
          />
          <q-btn
            v-if="apercu && !rapport"
            color="positive"
            no-caps
            icon="upload"
            :label="t('imports.apply')"
            :loading="chargement === 'apply'"
            :disable="apercu.valides === 0 || !!chargement"
            @click="confirmerImport"
          />
        </div>
      </q-card-section>
    </q-card>

    <q-banner v-if="!apercu && !rapport" rounded class="bg-blue-1 text-blue-10 q-mb-md">
      <template #avatar><q-icon name="info" /></template>
      {{ t('imports.previewRequired') }}
    </q-banner>

    <q-card v-if="apercu" flat bordered class="carte q-mb-md">
      <q-card-section>
        <div class="text-h6">{{ t('imports.previewTitle') }}</div>
        <q-banner v-if="apercu.colonnesIgnorees?.length" rounded class="bg-orange-1 text-orange-10 q-mt-sm">
          {{ t('imports.ignoredColumns', { columns: apercu.colonnesIgnorees.join(', ') }) }}
        </q-banner>
        <div class="row q-col-gutter-sm q-mt-sm">
          <div class="col-4">
            <q-badge color="grey-7">{{ t('imports.lines') }} : {{ apercu.lignesLues }}</q-badge>
          </div>
          <div class="col-4">
            <q-badge color="positive">{{ t('imports.valid') }} : {{ apercu.valides }}</q-badge>
          </div>
          <div class="col-4">
            <q-badge color="negative">{{ t('imports.rejected') }} : {{ apercu.rejetees }}</q-badge>
          </div>
        </div>
      </q-card-section>
      <q-card-section v-if="apercu.valides && !apercu.rejetees" class="q-pt-none">
        <q-banner rounded class="bg-green-1 text-green-10">
          <template #avatar><q-icon name="check_circle" /></template>
          {{ t('imports.noErrors') }}
        </q-banner>
      </q-card-section>
      <q-card-section v-if="apercu.apercu.length" class="q-pt-none">
        <q-table
          flat
          bordered
          :rows="apercu.apercu"
          :columns="colonnes"
          row-key="numero"
          :pagination="{ rowsPerPage: 10 }"
          :rows-per-page-options="[10]"
        >
          <template #body-cell-donnees="p">
            <q-td :props="p"
              ><code>{{ JSON.stringify(p.row.donnees) }}</code></q-td
            >
          </template>
          <template #body-cell-erreurs="p">
            <q-td :props="p">
              <span v-if="!p.row.erreurs.length" class="text-positive">—</span>
              <div v-else v-for="erreur in p.row.erreurs" :key="erreur" class="text-negative">{{ erreur }}</div>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
      <q-card-section v-if="apercu.erreurs.length" class="q-pt-none">
        <div class="text-subtitle2 q-mb-xs">{{ t('imports.errors') }}</div>
        <q-list dense bordered separator>
          <q-item v-for="item in apercu.erreurs" :key="item.numero">
            <q-item-section side>{{ t('imports.line') }} {{ item.numero }}</q-item-section>
            <q-item-section>{{ item.erreurs.join(' · ') }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <q-banner v-if="rapport" rounded class="bg-green-1 text-green-10">
      <template #avatar><q-icon name="task_alt" /></template>
      {{ t('imports.done', { count: rapport.importees }) }}
      <span v-if="rapport.rejetees"> · {{ t('imports.rejected') }} : {{ rapport.rejetees }}</span>
      <template #action
        ><q-btn flat round icon="close" :aria-label="t('common.actions.close')" @click="rapport = null"
      /></template>
      <div v-if="rapport.erreurs.length" class="q-mt-sm">
        <div v-for="item in rapport.erreurs" :key="item.numero">
          {{ t('imports.line') }} {{ item.numero }} : {{ item.erreurs.join(' · ') }}
        </div>
      </div>
    </q-banner>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Dialog } from 'quasar';
import { isAxiosError } from 'axios';
import { useI18n } from 'vue-i18n';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import {
  CONTENU_MAX,
  estFichierCsv,
  estFichierXlsx,
  importsService,
  tailleFichierAutorisee,
  type Apercu,
  type Rapport,
  type TypeImport,
} from '../services/imports';

const { t } = useI18n();
const { confirmer } = useConfirmation();
const type = ref<TypeImport | null>(null);
const fichier = ref<File | null>(null);
const apercu = ref<Apercu | null>(null);
const rapport = ref<Rapport | null>(null);
const chargement = ref<'' | 'preview' | 'apply'>('');

const optionsType = computed(() =>
  (['enseignants', 'matieres', 'salles', 'creneaux'] as const).map((value) => ({
    value,
    label: t(`imports.types.${value}`),
  })),
);
const colonnes = computed(() => [
  { name: 'numero', label: t('imports.line'), field: 'numero', align: 'left' as const },
  { name: 'donnees', label: t('imports.data'), field: 'donnees', align: 'left' as const },
  { name: 'erreurs', label: t('imports.errors'), field: 'erreurs', align: 'left' as const },
]);

function effacerResultats() {
  apercu.value = null;
  rapport.value = null;
}

function telechargerModele() {
  if (!type.value) return;
  const entete = t(`imports.templates.${type.value}`);
  const url = URL.createObjectURL(new Blob([`\uFEFF${entete}\r\n`], { type: 'text/csv;charset=utf-8' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `modele-${type.value}.csv`;
  lien.click();
  URL.revokeObjectURL(url);
}

async function contenuCsv(): Promise<string> {
  if (!type.value) throw new Error(t('imports.typeRequired'));
  if (!fichier.value) throw new Error(t('imports.fileRequired'));
  const xlsx = estFichierXlsx(fichier.value.name);
  if (!tailleFichierAutorisee(fichier.value.size, xlsx)) {
    throw new Error(t('imports.contentTooLarge'));
  }
  let contenu: string;
  if (xlsx) {
    const { convertirXlsxEnCsv } = await import('@/shared/utils/xlsx');
    contenu = await convertirXlsxEnCsv(fichier.value);
  } else {
    if (!estFichierCsv(fichier.value.name)) {
      throw new Error(t('imports.unsupportedFile'));
    }
    const { decoderCsv } = await import('@/shared/utils/csv');
    contenu = decoderCsv(await fichier.value.arrayBuffer());
  }
  if (contenu.length > CONTENU_MAX) throw new Error(t('imports.contentTooLarge'));
  return contenu;
}

async function previsualiser() {
  chargement.value = 'preview';
  rapport.value = null;
  try {
    const contenu = await contenuCsv();
    apercu.value = await importsService.previsualiser({
      type: type.value as TypeImport,
      contenu,
    });
  } catch (error: unknown) {
    apercu.value = null;
    signalerErreurLecture(error);
  } finally {
    chargement.value = '';
  }
}

/**
 * Seules les erreurs de lecture du fichier (CSV/XLSX illisible) s'affichent
 * ici : celles du serveur sont déjà notifiées par l'intercepteur axios.
 */
function signalerErreurLecture(error: unknown) {
  if (isAxiosError(error)) return;
  const message = error instanceof Error && error.message ? error.message : t('imports.readFailed');
  Dialog.create({ title: t('imports.errors'), message });
}

async function confirmerImport() {
  if (!apercu.value || !type.value || apercu.value.valides === 0) return;
  const ok = await confirmer({
    titre: t('imports.apply'),
    message: t('imports.confirm', { count: apercu.value.valides }),
  });
  if (ok) await appliquer();
}

async function appliquer() {
  chargement.value = 'apply';
  try {
    const contenu = await contenuCsv();
    rapport.value = await importsService.appliquer({
      type: type.value as TypeImport,
      contenu,
    });
    apercu.value = null;
  } catch (error: unknown) {
    signalerErreurLecture(error);
  } finally {
    chargement.value = '';
  }
}
</script>

<style scoped>
.page-imports code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
