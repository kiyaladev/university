<template>
  <div>
    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('cites.residences.filters.placeholder')"
      @reinitialiser="emit('reinitialiser')"
    >
      <template #avances>
        <q-input
          v-model.number="filtres.capaciteMin"
          type="number"
          min="0"
          dense
          outlined
          :label="$t('cites.residences.filters.capaciteMin')"
          clearable
        />
        <q-select
          v-model="filtres.actif"
          :options="[
            { label: $t('cites.residences.filters.etatToutes'), value: null },
            { label: $t('cites.residences.filters.etatActives'), value: 'true' },
            { label: $t('cites.residences.filters.etatInactives'), value: 'false' },
          ]"
          emit-value
          map-options
          dense
          outlined
          :label="$t('cites.residences.filters.etat')"
        />
        <q-input v-model="filtres.ville" dense outlined :label="$t('cites.residences.filters.ville')" clearable />
      </template>
    </barre-filtres>

    <!-- Vue tableau -->
    <q-table
      v-if="presentation === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="residencesFiltrees"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || residencesFiltrees.length > 0"
    >
      <template #body-cell-statut="p">
        <q-td :props="p">
          <q-badge :color="p.row.actif ? 'positive' : 'grey-7'">
            {{ p.row.actif ? $t('cites.common.status.active') : $t('cites.common.status.inactive') }}
          </q-badge>
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="meeting_room"
            :aria-label="$t('cites.residences.table.aria.voirChambres')"
            @click="emit('voirChambres', p.row)"
          >
            <q-tooltip>{{ $t('cites.residences.table.tooltip.voirChambres') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('cites.residences.table.aria.modifier')"
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
            :aria-label="$t('cites.residences.table.aria.supprimer')"
            @click="emit('supprimer', p.row)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <etat-vide
          icone="apartment"
          :titre="$t('cites.residences.emptyState.title')"
          :aide="$t('cites.residences.emptyState.hint')"
        >
          <template v-if="peutGerer" #action>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="add"
              :label="$t('cites.actions.newResidence')"
              @click="emit('creer')"
            />
          </template>
        </etat-vide>
      </template>
    </q-table>

    <!-- Vue cartes -->
    <div v-else class="row q-col-gutter-md">
      <div v-if="chargement" class="col-12 q-pa-md text-center">
        <q-spinner color="primary" />
      </div>
      <div v-for="r in residencesFiltrees" :key="r.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center q-pb-none">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ r.code }}</div>
              <div class="text-subtitle1 text-weight-medium">{{ r.nom }}</div>
            </div>
            <q-badge :color="r.actif ? 'positive' : 'grey-7'">
              {{ r.actif ? $t('cites.common.status.active') : $t('cites.common.status.inactive') }}
            </q-badge>
          </q-card-section>
          <q-card-section class="q-pt-none q-gutter-y-xs">
            <div class="row items-center">
              <q-icon name="place" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ r.ville ?? '—' }}</span>
            </div>
            <div class="row items-center">
              <q-icon name="bed" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{
                $t('cites.residences.card.capacite', { n: nombreLisible(r.capacite) })
              }}</span>
            </div>
            <div class="row items-center q-gutter-xs">
              <q-icon name="meeting_room" size="16px" class="q-mr-sm text-grey-6" />
              <q-chip dense size="sm" color="positive" text-color="white">
                {{ $t('cites.residences.card.libres', { n: compteLibres(r) }) }}
              </q-chip>
              <q-chip dense size="sm" color="amber-8" text-color="white">
                {{ $t('cites.residences.card.reservees', { n: compteReservees(r) }) }}
              </q-chip>
              <q-chip dense size="sm" color="blue-grey-5" text-color="white">
                {{ $t('cites.residences.card.occupees', { n: compteOccupees(r) }) }}
              </q-chip>
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions class="text-caption text-grey-7 q-px-md">
            <q-icon name="person_outline" size="16px" class="q-mr-xs" />
            {{ r.responsable ?? $t('cites.residences.card.noResponsable') }}
            <q-space />
            <q-btn
              v-if="peutGerer"
              flat
              dense
              round
              size="sm"
              icon="edit"
              :aria-label="$t('cites.residences.table.aria.modifier')"
              @click="emit('modifier', r)"
            >
              <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="estAdmin"
              flat
              dense
              round
              size="sm"
              color="negative"
              icon="delete"
              :aria-label="$t('cites.residences.table.aria.supprimer')"
              @click="emit('supprimer', r)"
            >
              <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!chargement && !residencesFiltrees.length"
        class="col-12"
        icone="apartment"
        :titre="$t('cites.residences.emptyState.title')"
      >
        <template v-if="peutGerer" #action>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="add"
            :label="$t('cites.actions.newResidence')"
            @click="emit('creer')"
          />
        </template>
      </etat-vide>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet « Résidences » de la cité : le parc, ses filtres et ses actions.
 *
 * L'écran garde la liste et les filtres ; ce composant ne fait que les
 * présenter et rend les actions, que la page traite.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { nombreLisible } from '@/shared/utils/format';
import type { ChipFiltre, Residence, FiltresPage } from '@/types';

const props = defineProps<{
  /** Le parc complet : les filtres « actif », « ville » et « capacité » s'appliquent ici. */
  residences: Residence[];
  chargement: boolean;
  peutGerer: boolean;
  estAdmin: boolean;
}>();

/** Filtres du panneau : la page les garde (et les inscrit dans l'URL). */
const filtres = defineModel<FiltresPage>('filtres', { required: true });

const emit = defineEmits<{
  creer: [];
  modifier: [residence: Residence];
  supprimer: [residence: Residence];
  voirChambres: [residence: Residence];
  reinitialiser: [];
}>();

const { t } = useI18n();
const presentation = usePresentationListe();

const texte = (v: unknown) => (v ?? '').toString().trim().toLowerCase();

/** Le parc est chargé en entier : le filtrage se fait ici, sans requête. */
const residencesFiltrees = computed(() => {
  const f = filtres.value;
  const q = texte(f.recherche);
  const capMin = f.capaciteMin;
  const ville = texte(f.ville);
  return props.residences.filter((r) => {
    if (capMin !== null && capMin !== undefined && capMin !== '' && r.capacite < Number(capMin)) return false;
    if (f.actif === 'true' && !r.actif) return false;
    if (f.actif === 'false' && r.actif) return false;
    if (ville && !(r.ville ?? '').toLowerCase().includes(ville)) return false;
    if (q && !`${r.code} ${r.nom} ${r.ville ?? ''} ${r.responsable ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
});

// BarreFiltres masque « Réinitialiser » tant qu'aucun chip personnalisé n'existe :
// chaque onglet décrit donc ses filtres actifs.
const chips = computed<ChipFiltre[]>(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = f.recherche
    ? [{ label: t('cites.chips.recherche', { q: f.recherche }), value: f.recherche, icone: 'search', defaut: true }]
    : [];
  if (f.capaciteMin)
    cs.push({
      label: t('cites.residences.chips.capaciteMin', { n: f.capaciteMin }),
      value: f.capaciteMin,
      icone: 'bed',
    });
  if (f.actif) {
    cs.push({
      label:
        f.actif === 'true' ? t('cites.residences.filters.etatActives') : t('cites.residences.filters.etatInactives'),
      value: f.actif,
      icone: 'toggle_on',
      cle: 'actif',
    });
  }
  if (f.ville)
    cs.push({ label: t('cites.residences.chips.ville', { ville: f.ville }), value: f.ville, icone: 'place' });
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('common.fields.code'), field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: t('common.fields.name'), field: 'nom', align: 'left', sortable: true },
  { name: 'ville', label: t('cites.residences.table.columns.ville'), field: 'ville', align: 'left' },
  { name: 'capacite', label: t('common.fields.capacity'), field: 'capacite', align: 'right', sortable: true },
  { name: 'responsable', label: t('cites.residences.table.columns.responsable'), field: 'responsable', align: 'left' },
  { name: 'statut', label: t('cites.residences.table.columns.statut'), field: 'actif', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const compteStatut = (r: Residence, statut: string) => (r.chambres ?? []).filter((c) => c.statut === statut).length;
const compteLibres = (r: Residence) => compteStatut(r, 'LIBRE');
const compteReservees = (r: Residence) => compteStatut(r, 'RESERVE');
const compteOccupees = (r: Residence) => compteStatut(r, 'OCCUPE');
</script>
