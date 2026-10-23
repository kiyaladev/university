<template>
  <q-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section class="row items-center">
        <div class="col">
          <div class="text-h6">{{ equipement?.libelle }}</div>
          <div class="text-caption text-grey-7">{{ equipement?.numeroInventaire }}</div>
        </div>
        <q-btn flat dense round icon="close" :aria-label="$t('common.actions.close')" v-close-popup />
      </q-card-section>
      <q-card-section v-if="equipement">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4 text-center">
            <canvas :ref="(el) => enregistrerCanvasDetail(el)" />
            <div class="text-caption text-grey-7 q-mt-xs">
              {{ equipement.qrCode }}
            </div>
          </div>
          <div class="col-12 col-sm-8">
            <q-list dense>
              <q-item
                ><q-item-section avatar><q-icon name="category" /></q-item-section
                ><q-item-section>{{ equipement.categorie?.libelle }}</q-item-section></q-item
              >
              <q-item
                ><q-item-section avatar><q-icon name="tag" /></q-item-section
                ><q-item-section>{{ equipement.numeroSerie }}</q-item-section></q-item
              >
              <q-item
                ><q-item-section avatar><q-icon name="apartment" /></q-item-section
                ><q-item-section>{{ equipement.departement?.nom ?? '—' }}</q-item-section></q-item
              >
              <q-item
                ><q-item-section avatar><q-icon name="meeting_room" /></q-item-section
                ><q-item-section>{{
                  equipement.salle ? `${equipement.salle.code} — ${equipement.salle.nom}` : '—'
                }}</q-item-section></q-item
              >
              <q-item
                ><q-item-section avatar><q-icon name="shopping_cart" /></q-item-section
                ><q-item-section>{{
                  equipement.dateAcquisition ? dateLisible(equipement.dateAcquisition) : '—'
                }}</q-item-section></q-item
              >
              <q-item
                ><q-item-section avatar><q-icon name="payments" /></q-item-section
                ><q-item-section>{{
                  equipement.valeurAcquisition != null ? montantLisible(equipement.valeurAcquisition, DEVISE) : '—'
                }}</q-item-section></q-item
              >
            </q-list>
          </div>
        </div>
      </q-card-section>
      <q-card-section v-if="reparations.length">
        <div class="text-subtitle2 q-mb-sm">{{ $t('patrimoine.detailsDialog.repairsTitle') }}</div>
        <q-list separator>
          <q-item v-for="r in reparations" :key="r.id">
            <q-item-section>
              <q-item-label>{{ r.description }}</q-item-label>
              <q-item-label caption>
                {{ dateLisible(r.dateDeclaration) }}
                <template v-if="r.prestataire"> · {{ r.prestataire }}</template>
                <template v-if="r.cout"> · {{ montantLisible(r.cout) }} {{ $t('common.units.gnf') }}</template>
              </q-item-label>
              <q-item-label caption v-if="r.notes">
                <em>{{ r.notes }}</em>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip
                dense
                :color="r.statut === 'TERMINE' ? 'positive' : r.statut === 'ANNULE' ? 'grey-7' : 'warning'"
                text-color="white"
              >
                {{ libelleStatutReparation(r.statut) }}
              </q-chip>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Fiche d'un équipement : son QR, son identité et ses réparations. Le
 * dialogue charge lui-même l'historique des réparations de la pièce.
 */
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import { dateLisible, DEVISE, montantLisible } from '@/shared/utils/format';
import { patrimoineService } from '../services/patrimoine';
import type { EquipementPatrimoine, ReparationMateriel, StatutReparation } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  equipement: EquipementPatrimoine | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [ouvert: boolean] }>();

const { t } = useI18n();

const reparations = ref<ReparationMateriel[]>([]);

watch(
  () => [props.modelValue, props.equipement?.id] as const,
  async ([ouvert, id]) => {
    if (!ouvert || !id) return;
    reparations.value = [];
    try {
      reparations.value = await patrimoineService.reparationsEquipement(id);
    } catch {
      /* l'intercepteur axios affiche le motif ; la fiche reste lisible */
    }
  },
  { immediate: true },
);

function enregistrerCanvasDetail(el: any) {
  if (!el || !props.equipement) return;
  QRCode.toCanvas(el, props.equipement.qrCode, { width: 180, margin: 1 }).catch(() => {});
}

function libelleStatutReparation(s: StatutReparation): string {
  const cles: Record<string, string> = { DECLARE: 'declared', EN_COURS: 'inProgress', TERMINE: 'done' };
  return t(`patrimoine.repairs.status.${cles[s] ?? 'cancelled'}`);
}
</script>
