<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('correctionsPointages.title')" :subtitle="$t('correctionsPointages.subtitle')" />

    <barre-filtres v-model="filtres" :recherche="false" :chips="chips" @reinitialiser="liste.reinitialiser([])">
      <template #principaux>
        <q-input
          v-model="filtres.dateDebut"
          outlined
          dense
          type="date"
          :label="$t('correctionsPointages.filters.from')"
        />
        <q-input v-model="filtres.dateFin" outlined dense type="date" :label="$t('correctionsPointages.filters.to')" />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatut"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('correctionsPointages.filters.status')"
        />
        <q-select
          v-model="filtres.methode"
          :options="optionsMethode"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('correctionsPointages.filters.method')"
        />
      </template>
    </barre-filtres>

    <div class="text-caption text-grey-7 q-mb-sm">
      {{ $t('correctionsPointages.summary', { count: liste.lignes.length, total: liste.total }) }}
    </div>

    <q-table
      flat
      bordered
      class="carte"
      :rows="liste.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="liste.chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="liste.chargement || liste.lignes.length > 0"
    >
      <template #no-data>
        <etat-vide icone="edit_note" :titre="$t('correctionsPointages.emptyState.title')">
          <template v-if="filtresActifs" #action>
            <q-btn
              outline
              no-caps
              icon="refresh"
              :label="$t('common.actions.reset_filters')"
              @click="liste.reinitialiser([])"
            />
          </template>
        </etat-vide>
      </template>

      <template #body-cell-seance="p">
        <q-td :props="p">
          <div>{{ p.row.seance?.date ? dateLisible(p.row.seance.date) : '—' }}</div>
          <div class="text-caption text-grey-7">{{ p.row.seance?.heureDebut }}–{{ p.row.seance?.heureFin }}</div>
        </q-td>
      </template>

      <template #body-cell-enseignant="p">
        <q-td :props="p">
          <div>{{ nomEnseignant(p.row) }}</div>
          <div v-if="p.row.seance?.affectation?.promotion?.nom" class="text-caption text-grey-7">
            {{ p.row.seance.affectation.promotion.nom }}
          </div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-badge
            :color="couleurStatut(p.row.statut)"
            :icon="ICONE_STATUT_PRESENCE[p.row.statut]"
            :label="LIBELLE_STATUT_PRESENCE[p.row.statut]"
          />
        </q-td>
      </template>

      <template #body-cell-heures="p">
        <q-td :props="p">
          {{ p.row.heureArrivee ?? '—' }}
          <span class="text-grey-7">→</span>
          {{ p.row.heureFinReelle ?? '—' }}
        </q-td>
      </template>

      <template #body-cell-methode="p">
        <q-td :props="p" class="text-caption">{{ $t(`correctionsPointages.methods.${p.row.methode}`) }}</q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="modifiable(p.row)"
            flat
            dense
            round
            icon="edit"
            color="primary"
            :aria-label="$t('correctionsPointages.actions.edit')"
            @click="ouvrirModification(p.row)"
          >
            <q-tooltip>{{ $t('correctionsPointages.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutSupprimer"
            flat
            dense
            round
            icon="delete"
            color="negative"
            :aria-label="$t('correctionsPointages.actions.delete')"
            @click="supprimer(p.row)"
          >
            <q-tooltip>{{ $t('correctionsPointages.actions.delete') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <barre-pagination
      v-model:page="liste.page"
      v-model:page-size="liste.pageSize"
      :total="liste.total"
      @tous="liste.toutAfficher()"
    />

    <dialogue-correction-pointage
      v-model="dialogOuvert"
      :controle="controleEnEdition"
      @enregistre="liste.recharger()"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import { useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { ICONE_STATUT_PRESENCE, LIBELLE_STATUT_PRESENCE, dateLisible, optionsDepuis } from '@/shared/utils/libelles';
import DialogueCorrectionPointage from '../components/DialogueCorrectionPointage.vue';
import { peutCorriger, pointagesService, type ParametresPointages } from '../services/pointages';
import type { Controle, ChipFiltre } from '@/types';

const auth = useAuthStore();
const { t } = useI18n();
const { confirmer } = useConfirmation();
const $q = useQuasar();

const filtres = ref<{
  dateDebut: string | null;
  dateFin: string | null;
  statut: string | null;
  methode: string | null;
}>({ dateDebut: null, dateFin: null, statut: null, methode: null });

const dialogOuvert = ref(false);
const controleEnEdition = ref<Controle | null>(null);

const liste = reactive(
  useListePaginee<Controle>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      pointagesService
        .liste({
          ...(f.dateDebut ? { dateDebut: f.dateDebut } : {}),
          ...(f.dateFin ? { dateFin: f.dateFin } : {}),
          ...(f.statut ? { statut: f.statut as ParametresPointages['statut'] } : {}),
          ...(f.methode ? { methode: f.methode } : {}),
          ...(p.tout ? { all: '1' } : { page: p.page, pageSize: p.pageSize }),
        })
        .then((page) => ({ data: page.data ?? [], total: page.total })),
  }),
);

const optionsStatut = computed(() => optionsDepuis(LIBELLE_STATUT_PRESENCE).filter((o) => o.value !== 'NON_CONTROLE'));

const optionsMethode = computed(() => [
  { value: 'MANUEL', label: t('correctionsPointages.methods.MANUEL') },
  { value: 'QR_SALLE', label: t('correctionsPointages.methods.QR_SALLE') },
  { value: 'GEOLOCALISATION', label: t('correctionsPointages.methods.GEOLOCALISATION') },
  { value: 'SIGNATURE', label: t('correctionsPointages.methods.SIGNATURE') },
]);

/** L'API réserve la suppression à l'administration et à la direction. */
const peutSupprimer = computed(() => auth.peut('pointages.supprimer'));

const filtresActifs = computed(
  () => !!filtres.value.dateDebut || !!filtres.value.dateFin || !!filtres.value.statut || !!filtres.value.methode,
);

const chips = computed<ChipFiltre[]>(() => {
  const liste: ChipFiltre[] = [];
  if (filtres.value.dateDebut) {
    liste.push({
      label: t('correctionsPointages.chips.from', { date: filtres.value.dateDebut }),
      value: filtres.value.dateDebut,
      cle: 'dateDebut',
      icone: 'event',
    });
  }
  if (filtres.value.dateFin) {
    liste.push({
      label: t('correctionsPointages.chips.to', { date: filtres.value.dateFin }),
      value: filtres.value.dateFin,
      cle: 'dateFin',
      icone: 'event',
    });
  }
  if (filtres.value.statut) {
    liste.push({
      label: t('correctionsPointages.chips.status', {
        status: LIBELLE_STATUT_PRESENCE[filtres.value.statut as keyof typeof LIBELLE_STATUT_PRESENCE],
      }),
      value: filtres.value.statut,
      cle: 'statut',
      icone: 'how_to_reg',
    });
  }
  if (filtres.value.methode) {
    liste.push({
      label: t('correctionsPointages.chips.method', {
        method: t(`correctionsPointages.methods.${filtres.value.methode}`),
      }),
      value: filtres.value.methode,
      cle: 'methode',
      icone: 'fact_check',
    });
  }
  return liste;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'seance', label: t('common.fields.session'), field: 'seance', align: 'left' },
  { name: 'enseignant', label: t('common.fields.teacher'), field: 'enseignant', align: 'left' },
  { name: 'statut', label: t('correctionsPointages.table.columns.status'), field: 'statut', align: 'left' },
  { name: 'heures', label: t('correctionsPointages.table.columns.hours'), field: 'heureArrivee', align: 'left' },
  { name: 'effectif', label: t('common.fields.headcount'), field: 'effectifPresent', align: 'left' },
  { name: 'methode', label: t('correctionsPointages.table.columns.method'), field: 'methode', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

function nomEnseignant(controle: Controle): string {
  const enseignant = controle.seance?.affectation?.enseignant;
  if (!enseignant) return '—';
  return `${enseignant.prenom ?? ''} ${enseignant.nom ?? ''}`.trim() || '—';
}

/**
 * L'API n'autorise à corriger que l'agent qui a fait le pointage, et
 * l'administration et la direction. On reflète cette règle pour ne pas
 * proposer une action qui serait refusée.
 */
function modifiable(controle: Controle): boolean {
  return peutCorriger(controle, auth.peut('pointages.corriger'), auth.utilisateur?.role, auth.utilisateur?.id);
}

/** Couleur du badge de statut, calée sur les tons de présence. */
function couleurStatut(statut: string): string {
  if (statut === 'PRESENT') return 'positive';
  if (statut === 'RETARD') return 'warning';
  if (statut === 'ABSENT') return 'negative';
  if (statut === 'EXCUSE') return 'info';
  return 'grey-7';
}

function ouvrirModification(controle: Controle) {
  controleEnEdition.value = controle;
  dialogOuvert.value = true;
}

async function supprimer(controle: Controle) {
  const ok = await confirmer({
    titre: t('correctionsPointages.deleteDialog.title'),
    message: t('correctionsPointages.deleteDialog.message', {
      teacher: nomEnseignant(controle),
      date: controle.seance?.date ?? '—',
    }),
    ok: t('common.actions.yes_delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await pointagesService.supprimer(controle.id);
    $q.notify({ type: 'positive', message: t('correctionsPointages.messages.deleted') });
    await liste.recharger();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}
</script>
