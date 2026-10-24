<template>
  <q-dialog v-model="ouvert" :maximized="$q.screen.lt.md">
    <q-card style="width: 820px; max-width: 95vw">
      <q-card-section v-if="examen" class="row items-start q-col-gutter-md">
        <div class="col">
          <div class="text-caption text-grey-7">{{ examen.codeExamen }}</div>
          <div class="text-h6">{{ examen.intitule }}</div>
          <div class="text-caption text-grey-7">
            {{ libelleType(examen.type) }} · {{ examen.matiere?.intitule ?? '—' }} ·
            {{ examen.promotion?.nom ?? '—' }}
          </div>
        </div>
        <div class="col-auto">
          <PastilleStatut domaine="examen" :statut="examen.statut" />
        </div>
        <div class="col-auto">
          <q-btn flat round dense icon="close" :aria-label="$t('examens.sheet.closeAria')" v-close-popup />
        </div>
      </q-card-section>

      <q-card-section v-if="examen" class="q-pt-none">
        <div class="row q-col-gutter-md text-caption">
          <div class="col-6 col-sm-3">
            <div class="text-grey-7">{{ $t('common.fields.date') }}</div>
            <div class="text-weight-medium">{{ dateLisible(examen.dateExamen) }}</div>
          </div>
          <div class="col-6 col-sm-3">
            <div class="text-grey-7">{{ $t('common.fields.schedule') }}</div>
            <div class="text-weight-medium">{{ examen.heureDebut }}–{{ examen.heureFin }}</div>
          </div>
          <div class="col-6 col-sm-3">
            <div class="text-grey-7">{{ $t('common.fields.room') }}</div>
            <div class="text-weight-medium">{{ examen.salle?.code ?? '—' }}</div>
          </div>
          <div class="col-6 col-sm-3">
            <div class="text-grey-7">{{ $t('examens.sheet.presentsOverEnrolled') }}</div>
            <div class="text-weight-medium chiffres">{{ examen.nbPresents }} / {{ examen.nbInscrits }}</div>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <!-- Suite de la chaîne : tirage puis scan -->
      <q-card-section class="row q-gutter-sm items-center">
        <span class="section-titre">{{ $t('examens.sheet.chainContinuation') }}</span>
        <q-space />
        <q-btn
          v-if="peutVoirTirage"
          outline
          no-caps
          color="secondary"
          icon="local_printshop"
          :label="$t('examens.actions.draw')"
          @click="emit('tirage', examen)"
        />
        <q-btn
          outline
          no-caps
          color="secondary"
          icon="qr_code_scanner"
          :label="$t('examens.actions.scanCards')"
          @click="emit('scan', examen)"
        />
      </q-card-section>

      <q-separator />

      <q-card-section>
        <span class="section-titre">{{ $t('examens.sheet.scanJournal') }}</span>
        <q-table
          flat
          dense
          :rows="scans"
          :columns="colonnesScans"
          row-key="id"
          :loading="chargementScans"
          :pagination="{ rowsPerPage: 0 }"
        >
          <template #no-data>
            <etat-vide icone="qr_code_scanner" :titre="$t('examens.sheet.noScans')" />
          </template>
          <template #body-cell-valide="p">
            <q-td :props="p">
              <q-badge
                :color="p.row.valide ? 'positive' : 'negative'"
                :label="p.row.valide ? $t('examens.sheet.validated') : $t('examens.sheet.rejected')"
              />
              <div v-if="p.row.motifRejet" class="text-caption text-grey-7">{{ p.row.motifRejet }}</div>
            </q-td>
          </template>
        </q-table>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Fiche de l'examen : les trois maillons de la chaîne au même endroit. Le
 * journal des scans est chargé à l'ouverture de la fiche, comme le faisait
 * la page avant le découpage.
 */
import { computed, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { LIBELLE_TYPE_EXAMEN, dateHeureLisible, dateLisible } from '@/shared/utils/libelles';
import { examensService } from '../services/examens';
import type { Examen, ScanExamen } from '@/types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ examen: Examen | null; peutVoirTirage: boolean }>();
const emit = defineEmits<{ tirage: [Examen | null]; scan: [Examen | null] }>();

const $q = useQuasar();
const { t } = useI18n();

const scans = ref<ScanExamen[]>([]);
const chargementScans = ref(false);

const colonnesScans = computed<QTableColumn[]>(() => [
  {
    name: 'heure',
    label: t('examens.scansTable.columns.time'),
    field: (r: ScanExamen) => dateHeureLisible(r.heureScan),
    align: 'left',
  },
  {
    name: 'porteur',
    label: t('examens.scansTable.columns.holder'),
    field: (r: ScanExamen) => `${r.prenomPorteur ?? ''} ${r.nomPorteur ?? ''}`.trim() || '—',
    align: 'left',
  },
  {
    name: 'matricule',
    label: t('examens.scansTable.columns.registrationNumber'),
    field: (r: ScanExamen) => r.matriculeSaisi ?? '—',
    align: 'left',
  },
  { name: 'valide', label: t('common.fields.result'), field: 'valide', align: 'left' },
  {
    name: 'scanneur',
    label: t('common.fields.operator'),
    field: (r: ScanExamen) => (r.scanneur ? `${r.scanneur.prenom} ${r.scanneur.nom}` : '—'),
    align: 'left',
  },
]);

/** Le journal se charge à l'ouverture de la fiche, pour l'examen affiché. */
watch([ouvert, () => props.examen?.id], async ([estOuvert, idExamen]) => {
  if (!estOuvert || !idExamen) return;
  scans.value = [];
  chargementScans.value = true;
  try {
    scans.value = await examensService.scans(idExamen);
  } catch {
    scans.value = [];
  } finally {
    chargementScans.value = false;
  }
});

function libelleType(s: string) {
  return LIBELLE_TYPE_EXAMEN[s] ?? s;
}
</script>
