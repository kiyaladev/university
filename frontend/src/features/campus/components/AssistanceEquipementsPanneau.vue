<template>
  <div>
    <div class="row items-center q-mb-md">
      <div class="col">
        <div class="page-sous-titre">
          {{ $t('helpdesk.equipmentTab.subtitle') }}
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('helpdesk.actions.newEquipment')"
          @click="emit('creer')"
        />
      </div>
    </div>

    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('helpdesk.filters.searchEquipment')"
      @reinitialiser="emit('reinitialiser')"
    >
      <template #avances>
        <q-select
          v-model="filtres.actif"
          :options="[
            { label: $t('helpdesk.filters.stateAll'), value: null },
            { label: $t('helpdesk.filters.stateActive'), value: 'true' },
            { label: $t('helpdesk.filters.stateInactive'), value: 'false' },
          ]"
          dense
          outlined
          emit-value
          map-options
          :label="$t('common.fields.state')"
        />
      </template>
    </barre-filtres>

    <q-table
      v-if="presentation === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="lignes"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 20 }"
    >
      <template #body-cell-actif="p">
        <q-td :props="p">
          <q-badge :color="p.row.actif ? 'positive' : 'grey-7'">
            {{ p.row.actif ? $t('helpdesk.equipmentTab.active') : $t('helpdesk.equipmentTab.inactive') }}
          </q-badge>
        </q-td>
      </template>
      <template #body-cell-codeQr="p">
        <q-td :props="p">
          <span class="text-caption ellipsis" style="max-width: 200px; display: inline-block; vertical-align: middle">
            {{ p.row.codeQr }}
          </span>
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="content_copy"
            :aria-label="$t('helpdesk.equipmentTab.copyCode')"
            @click="copier(p.row.codeQr)"
          >
            <q-tooltip>{{ $t('helpdesk.equipmentTab.copyCodeTooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="print"
            :aria-label="$t('helpdesk.equipmentTab.printLabel')"
            @click="imprimerQr(p.row)"
          >
            <q-tooltip>{{ $t('helpdesk.equipmentTab.printLabel') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('helpdesk.equipmentTab.editEquipment')"
            @click="emit('modifier', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="estAdmin"
            flat
            dense
            round
            color="negative"
            icon="delete"
            :aria-label="$t('helpdesk.equipmentTab.deleteEquipment')"
            @click="emit('supprimer', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <etat-vide
          icone="qr_code_2"
          :titre="$t('helpdesk.equipmentTab.emptyTitle')"
          :aide="$t('helpdesk.equipmentTab.emptyHint')"
        >
          <template #action>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="add"
              :label="$t('helpdesk.actions.newEquipment')"
              @click="emit('creer')"
            />
          </template>
        </etat-vide>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="e in lignes" :key="e.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center q-pb-none">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ e.codeQr }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ e.libelle }}</div>
              <div v-if="e.emplacement" class="text-caption text-grey-7">{{ e.emplacement }}</div>
            </div>
            <q-badge :color="e.actif ? 'positive' : 'grey-7'">
              {{
                e.actif
                  ? $t('helpdesk.equipmentTab.activeCapitalized')
                  : $t('helpdesk.equipmentTab.inactiveCapitalized')
              }}
            </q-badge>
          </q-card-section>
          <q-card-section class="text-center">
            <!-- Le rendu QR se fait via le fallback querySelectorAll() dans dessinerTousLesQr() -->
            <canvas
              :data-equipement="e.id"
              class="qr-canvas"
              style="width: 160px; height: 160px"
              :aria-label="$t('helpdesk.equipmentTab.qrAriaLabel', { libelle: e.libelle })"
              role="img"
            />
            <div class="text-caption text-grey-7 q-mt-xs">
              {{ $t('helpdesk.gestionTable.ticketsCount', { count: e._count?.tickets ?? 0 }) }}
            </div>
          </q-card-section>
          <q-card-actions class="q-px-md">
            <q-btn flat dense no-caps icon="print" :label="$t('common.actions.print')" @click="imprimerQr(e)" />
            <q-space />
            <q-btn flat dense no-caps icon="edit" :label="$t('common.actions.edit')" @click="emit('modifier', e)" />
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!chargement && !lignes.length"
        class="col-12"
        icone="qr_code_2"
        :titre="$t('helpdesk.equipmentTab.emptyTitle')"
      >
        <template #action>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="add"
            :label="$t('helpdesk.actions.newEquipment')"
            @click="emit('creer')"
          />
        </template>
      </etat-vide>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet « Équipements » de l'assistance : le parc à codes QR. Les vignettes
 * QR des cartes se dessinent dès que la liste change.
 */
import { computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRouter } from 'vue-router';
import QRCode from 'qrcode';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { ouvrirImpression } from '@/shared/services/impression';
import type { ChipFiltre, EquipementCampus, FiltresPage } from '@/types';

const props = defineProps<{
  lignes: EquipementCampus[];
  chargement: boolean;
  estAdmin: boolean;
}>();

/** Filtres du panneau : la page les garde (et les inscrit dans l'URL). */
const filtres = defineModel<FiltresPage>('filtres', { required: true });

const emit = defineEmits<{
  creer: [];
  modifier: [equipement: EquipementCampus];
  supprimer: [equipement: EquipementCampus];
  reinitialiser: [];
}>();

const $q = useQuasar();
const router = useRouter();
const { t } = useI18n();
const presentation = usePresentationListe();

const chips = computed<ChipFiltre[]>(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = f.recherche
    ? [{ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true }]
    : [];
  if (f.actif) {
    cs.push({
      label: f.actif === 'true' ? t('helpdesk.filters.stateActive') : t('helpdesk.filters.stateInactive'),
      value: f.actif,
      icone: 'toggle_on',
      cle: 'actif',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'libelle', label: t('common.fields.label'), field: 'libelle', align: 'left', sortable: true },
  { name: 'emplacement', label: t('helpdesk.table.columns.location'), field: 'emplacement', align: 'left' },
  { name: 'codeQr', label: t('helpdesk.table.columns.qrCode'), field: 'codeQr', align: 'left' },
  { name: 'actif', label: t('common.fields.state'), field: 'actif', align: 'left' },
  {
    name: 'tickets',
    label: t('helpdesk.table.columns.tickets'),
    field: (r: EquipementCampus) => r._count?.tickets ?? 0,
    align: 'left',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function copier(texte: string) {
  void navigator.clipboard?.writeText(texte);
  $q.notify({ type: 'info', message: t('helpdesk.messages.codeCopied') });
}

function imprimerQr(e: EquipementCampus) {
  void ouvrirImpression(`/equipements/${e.id}/imprimer-qr`);
}

/**
 * URL encodée dans l'étiquette : construite par le routeur, pour rester juste
 * quel que soit le mode (hash ou history). Une URL bricolée à la main donnait
 * « origin//helpdesk », que l'application ne sait pas router.
 */
function urlEtiquette(codeQr: string): string {
  const href = router.resolve({ name: 'helpdesk', query: { equipement: codeQr } }).href;
  return new URL(href, window.location.origin).toString();
}

/** Les vignettes QR des cartes se dessinent dès que la liste change. */
watch(
  () => [props.lignes, presentation.value],
  async () => {
    await nextTick();
    const canvases = document.querySelectorAll<HTMLCanvasElement>('canvas.qr-canvas');
    for (const canvas of canvases) {
      const eq = props.lignes.find((e) => e.id === canvas.dataset.equipement);
      if (eq) await QRCode.toCanvas(canvas, urlEtiquette(eq.codeQr), { width: 160, margin: 1 });
    }
  },
);
</script>

<style scoped lang="scss">
.qr-canvas {
  margin: 0 auto;
  display: block;
}
</style>
