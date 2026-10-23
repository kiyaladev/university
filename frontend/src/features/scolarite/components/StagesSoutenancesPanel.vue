<template>
  <div class="row q-col-gutter-md q-mb-md">
    <div class="col-12 col-md-4">
      <q-card flat bordered class="carte">
        <q-card-section class="text-center">
          <div class="stat-chiffre chiffres">{{ props.soutenances.length }}</div>
          <div class="pochoir text-grey-7">{{ $t('stages.stats.upcoming7Days') }}</div>
        </q-card-section>
      </q-card>
    </div>
    <div class="col-12 col-md-4">
      <q-card flat bordered class="carte">
        <q-card-section class="text-center">
          <div class="stat-chiffre chiffres">{{ travauxFiltresSoutenance.length }}</div>
          <div class="pochoir text-grey-7">{{ $t('stages.stats.inDefensePhase') }}</div>
        </q-card-section>
      </q-card>
    </div>
    <div class="col-12 col-md-4">
      <q-card flat bordered class="carte">
        <q-card-section class="text-center">
          <div class="stat-chiffre chiffres">{{ travauxSoutenus.length }}</div>
          <div class="pochoir text-grey-7">{{ $t('stages.stats.defended') }}</div>
        </q-card-section>
      </q-card>
    </div>
  </div>

  <barre-filtres
    v-model="filtres"
    :chips="chips"
    :placeholder="$t('stages.filters.searchPlaceholderDefenses')"
    @reinitialiser="emit('reinitialiser')"
  >
    <template #avances>
      <q-select
        v-model="filtres.statut"
        :options="optionsStatutsTravail"
        emit-value
        map-options
        dense
        outlined
        clearable
        :label="$t('stages.filters.workStatus')"
      />
    </template>
  </barre-filtres>

  <grille-calendrier :evenements="evenementsSoutenances" :compact="false" />

  <!-- Le serveur ne renvoie que la fenêtre des 7 jours : on le dit. -->
  <q-list separator bordered class="q-mt-md carte">
    <q-item-label header class="text-subtitle1">
      {{ $t('stages.stats.upcoming7Days') }}
    </q-item-label>
    <q-item v-for="s in soutenancesFiltrees" :key="s.id" clickable @click="emit('detail', travailDe(s))">
      <q-item-section>
        <q-item-label>
          {{ dateHeureLisible(s.date) }}
          <span class="text-grey-7"
            >· {{ s.salle ? `${s.salle.nom} (${s.salle.code})` : $t('stages.list.roomToBeSet') }}</span
          >
        </q-item-label>
        <q-item-label caption>
          {{ travailDe(s)?.intitule }} {{ $t('common.format.emptyValue') }}
          {{ travailDe(s)?.etudiant?.nom }}
          {{ travailDe(s)?.etudiant?.prenom }}
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-chip v-if="s.president" size="sm" color="secondary" text-color="white" square>
          {{ s.president.nom }} {{ s.president.prenom }}
        </q-chip>
      </q-item-section>
    </q-item>
    <q-item v-if="!soutenancesFiltrees.length">
      <q-item-section class="text-grey-7 text-center q-py-md">
        <div>{{ $t('stages.list.emptyTitle') }}</div>
        <div class="text-caption q-mt-xs">
          {{ $t('stages.list.emptyDescription') }}
        </div>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup lang="ts">
/**
 * Onglet « Soutenances » : compteurs, filtres, calendrier et liste des
 * soutenances à venir.
 *
 * Le calendrier est filtré côté client : les filtres de l'onglet ne
 * déclenchent aucune requête.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import GrilleCalendrier from '@/shared/components/GrilleCalendrier.vue';
import { LIBELLE_STATUT_ENCADREMENT } from '@/shared/utils/libelles';
import { dateHeureLisible } from '@/shared/utils/format';
import type { ChipFiltre, StatutEncadrement, TravailEncadre } from '@/types';
import type { SoutenanceCalendrier } from '../types';

/** Filtres de l'onglet : la page les détient, le panneau les affiche. */
const filtres = defineModel<Record<string, any>>('filtres', { required: true });

const props = defineProps<{
  soutenances: SoutenanceCalendrier[];
  travaux: TravailEncadre[];
  chips: ChipFiltre[];
}>();

const emit = defineEmits<{
  reinitialiser: [];
  detail: [travail: TravailEncadre | null];
}>();

const { t } = useI18n();

/**
 * Le calendrier renvoie le travail encadré complet ; le type partagé le
 * décrit en entier, on ne fait que le rendre nullable.
 */
function travailDe(s: SoutenanceCalendrier): TravailEncadre | null {
  return s.travailEncadre ?? null;
}

const optionsStatutsTravail = (Object.keys(LIBELLE_STATUT_ENCADREMENT) as StatutEncadrement[]).map((v) => ({
  label: LIBELLE_STATUT_ENCADREMENT[v],
  value: v,
}));

const travauxFiltresSoutenance = computed(() =>
  props.travaux.filter((x) => x.statut === 'EN_COURS' || x.statut === 'SOUTENU' || x.soutenance),
);

/** Dossiers arrivés au bout du parcours — calculés sur la liste complète. */
const travauxSoutenus = computed(() => props.travaux.filter((x) => x.statut === 'SOUTENU'));

const soutenancesFiltrees = computed(() => {
  const f = filtres.value;
  const q = (f.recherche ?? '').toString().trim().toLowerCase();
  return props.soutenances
    .filter((s) => {
      if (f.statut && travailDe(s)?.statut !== f.statut) return false;
      if (q) {
        const travail = travailDe(s);
        const blob =
          `${travail?.intitule ?? ''} ${travail?.etudiant?.nom ?? ''} ${travail?.etudiant?.prenom ?? ''} ${s.salle?.nom ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
});

const evenementsSoutenances = computed(() =>
  soutenancesFiltrees.value.map((s) => ({
    id: s.id,
    date: s.date,
    titre: `${travailDe(s)?.intitule ?? t('stages.list.defenseFallback')} — ${travailDe(s)?.etudiant?.nom ?? ''}`,
    sousTitre: s.salle ? `${s.salle.nom} (${s.salle.code})` : t('stages.list.roomToBeSet'),
    couleur: '#007A4D',
    icone: 'groups',
    onClick: () => {
      const travail = travailDe(s);
      if (travail) emit('detail', travail);
    },
  })),
);
</script>

<style scoped lang="scss">
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}
</style>
