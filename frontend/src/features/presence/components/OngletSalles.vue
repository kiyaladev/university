<template>
  <div>
    <releve-chiffres v-if="rapport?.total" :chiffres="chiffres" class="q-mb-md" />

    <ul v-if="vue === 'cartes'" class="cartes q-mt-md">
      <li v-for="l in rapport?.lignes ?? []" :key="l.code">
        <article class="plaque fiche">
          <header class="fiche__tete">
            <span class="plaque-salle">{{ l.code }}</span>
            <span class="fiche__titre">
              <span class="lettrage fiche__nom">{{ l.nom }}</span>
              <span v-if="l.batiment" class="pochoir fiche__sous">{{ l.batiment }}</span>
            </span>
          </header>

          <div class="fiche__chiffres">
            <div class="fiche__chiffre">
              <span class="pochoir">{{ $t('common.fields.sessions') }}</span>
              <span class="lettrage chiffres">{{ l.planifiees }}</span>
            </div>
            <div class="fiche__chiffre">
              <span class="pochoir">{{ $t('statistiques.salles.card.controlled') }}</span>
              <span class="lettrage chiffres">{{ l.controlees }}</span>
            </div>
            <div class="fiche__chiffre">
              <span class="pochoir">{{ $t('common.fields.absences') }}</span>
              <span class="lettrage chiffres" :class="l.absent ? 'text-negative' : ''">
                {{ l.absent }}
              </span>
            </div>
            <div class="fiche__chiffre">
              <span class="pochoir">{{ $t('common.fields.students') }}</span>
              <span class="lettrage chiffres">{{ l.effectifMoyen || '—' }}</span>
            </div>
          </div>

          <div class="fiche__taux">
            <span class="pochoir">{{ $t('statistiques.salles.card.occupation') }}</span>
            <barre-taux :valeur="l.tauxOccupation" />
          </div>
          <div class="fiche__taux">
            <span class="pochoir">{{ $t('common.fields.attendance') }}</span>
            <barre-taux :valeur="l.tauxPresence" />
          </div>

          <footer class="fiche__pied">
            <span class="pochoir">
              <template v-if="l.derniereVisite">
                {{ $t('statistiques.salles.card.visitedOn') }}
                <span class="chiffres">{{ dateLisible(l.derniereVisite) }}</span>
              </template>
              <span v-else class="text-negative">{{ $t('statistiques.salles.card.neverVisited') }}</span>
            </span>
            <q-btn
              v-if="l.salleId"
              flat
              dense
              no-caps
              size="sm"
              icon="event_note"
              :label="$t('statistiques.salles.card.sessionsLink')"
              :to="lienSeances(l.salleId)"
            />
          </footer>
        </article>
      </li>
      <li v-if="!(rapport?.lignes ?? []).length" class="stats__vide pochoir">
        {{ $t('statistiques.salles.empty.cards') }}
      </li>
    </ul>

    <q-table
      v-else
      flat
      bordered
      class="carte q-mt-md"
      :rows="rapport?.lignes ?? []"
      :columns="colonnes"
      row-key="code"
      :loading="chargement"
      :pagination="{ rowsPerPage: 25, sortBy: 'code' }"
      :visible-columns="colonnesVisibles"
      :loading-label="$t('statistiques.salles.table.loading')"
      :no-data-label="$t('statistiques.salles.empty.table')"
    >
      <template #body-cell-salle="p">
        <q-td :props="p">
          <div class="stats__salle">
            <span class="plaque-salle">{{ p.row.code }}</span>
            <span>
              <span class="stats__nom-salle">{{ p.row.nom }}</span>
              <span v-if="p.row.batiment" class="pochoir stats__batiment">
                {{ p.row.batiment }}
              </span>
            </span>
          </div>
        </q-td>
      </template>

      <template #body-cell-occupation="p">
        <q-td :props="p"><barre-taux :valeur="p.row.tauxOccupation" /></q-td>
      </template>

      <template #body-cell-presence="p">
        <q-td :props="p"><barre-taux :valeur="p.row.tauxPresence" /></q-td>
      </template>

      <template #body-cell-visite="p">
        <q-td :props="p">
          <span v-if="p.row.derniereVisite" class="chiffres">
            {{ dateLisible(p.row.derniereVisite) }}
          </span>
          <span v-else class="pochoir text-negative">{{ $t('statistiques.salles.card.neverVisited') }}</span>
        </q-td>
      </template>

      <template #body-cell-registre="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="p.row.salleId"
            flat
            dense
            round
            icon="event_note"
            :aria-label="$t('statistiques.salles.actions.sessionsAria')"
            :to="lienSeances(p.row.salleId)"
          >
            <q-tooltip>{{ $t('statistiques.salles.actions.sessionsTooltip') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import ReleveChiffres from './ReleveChiffres.vue';
import BarreTaux from '@/shared/components/BarreTaux.vue';
import { dateLisible, heuresLisibles } from '@/shared/utils/libelles';
import type { RapportSalles } from '../services/rapports';
import type { ChiffreReleve, VueListe } from '../types';

/** Onglet « par salle » : le terrain du contrôleur sur la période. */
const props = defineProps<{
  rapport: RapportSalles | null;
  chargement: boolean;
  vue: VueListe;
  dateDebut: string;
  dateFin: string;
}>();

const $q = useQuasar();
const { t } = useI18n();

const sallesVisitees = computed(() => (props.rapport?.lignes ?? []).filter((l) => l.controlees > 0).length);

const chiffres = computed<ChiffreReleve[]>(() => {
  const total = props.rapport?.total;
  if (!total) return [];
  return [
    {
      label: t('statistiques.salles.summary.visited'),
      valeur: `${sallesVisitees.value}/${props.rapport?.lignes.length ?? 0}`,
    },
    {
      label: t('statistiques.salles.summary.controlled'),
      valeur: `${total.controlees ?? 0}/${total.planifiees ?? 0}`,
    },
    { label: t('statistiques.salles.summary.absences'), valeur: total.absent ?? 0 },
    { label: t('statistiques.salles.summary.hours'), valeur: heuresLisibles(total.heuresRealisees) },
  ];
});

/** Un relevé se termine toujours par « et concrètement, quelles séances ? ». */
const lienSeances = (salleId: string) => ({
  name: 'seances',
  query: { salleId, dateDebut: props.dateDebut, dateFin: props.dateFin },
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'salle', label: t('common.fields.room'), field: 'code', align: 'left', sortable: true },
  { name: 'planifiees', label: t('common.fields.sessions'), field: 'planifiees', align: 'right', sortable: true },
  {
    name: 'controlees',
    label: t('statistiques.salles.table.columns.controlees'),
    field: 'controlees',
    align: 'right',
    sortable: true,
  },
  { name: 'absent', label: t('common.fields.absences'), field: 'absent', align: 'right', sortable: true },
  {
    name: 'effectif',
    label: t('statistiques.salles.table.columns.effectif'),
    field: 'effectifMoyen',
    align: 'right',
    sortable: true,
  },
  {
    name: 'occupation',
    label: t('statistiques.salles.table.columns.occupation'),
    field: 'tauxOccupation',
    align: 'left',
    sortable: true,
  },
  { name: 'presence', label: t('common.fields.attendance'), field: 'tauxPresence', align: 'left', sortable: true },
  {
    name: 'visite',
    label: t('statistiques.salles.table.columns.visite'),
    field: 'derniereVisite',
    align: 'left',
    sortable: true,
  },
  { name: 'registre', label: '', field: 'salleId', align: 'right' },
]);

// Sur téléphone, on garde ce que le contrôleur cherche : où il est passé, ce
// qu'il y a constaté.
const colonnesVisibles = computed(() =>
  $q.screen.lt.md ? ['salle', 'controlees', 'absent', 'presence'] : colonnes.value.map((c) => String(c.name)),
);
</script>

<style scoped lang="scss">
.stats__salle {
  display: flex;
  align-items: center;
  gap: var(--up-2);
}

.stats__nom-salle {
  display: block;
}

.stats__batiment {
  color: var(--up-encre-douce);
}

// --------------------------------------------------------------- vue cartes

.cartes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
  gap: var(--up-3);
}

.fiche {
  display: flex;
  flex-direction: column;
  gap: var(--up-2);
  padding: var(--up-3);
  height: 100%;
}

.fiche__tete {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--up-2);
  padding-bottom: var(--up-2);
  border-bottom: var(--up-filet);
}

.fiche__titre {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.fiche__nom {
  font-size: 1.02rem;
  overflow-wrap: anywhere;
}

.fiche__sous {
  color: var(--up-encre-douce);
  // Le matricule et le département tiennent sur une ligne : deux lignes ici
  // décalent les chiffres d'une carte à l'autre et cassent la comparaison.
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Quatre chiffres alignés : c'est la comparaison que le tableau donnait,
// tenue dans la largeur d'une carte.
.fiche__chiffres {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--up-2);
}

.fiche__chiffre {
  display: flex;
  flex-direction: column;
  gap: 1px;

  // Quatre étiquettes côte à côte : sans desserrer le pochoir, « SÉANCES »
  // et « ASSURÉES » se touchent et le mot devient illisible.
  .pochoir {
    color: var(--up-encre-douce);
    font-size: 10px;
    letter-spacing: -0.01em;
  }

  .lettrage {
    font-size: 1.25rem;
  }
}

.fiche__taux {
  display: flex;
  align-items: center;
  gap: var(--up-2);

  .pochoir {
    color: var(--up-encre-douce);
    min-width: 76px;
  }
  > :last-child {
    flex: 1;
  }
}

.fiche__pied {
  color: var(--up-encre-douce);
  border-top: var(--up-filet-fin);
  padding-top: var(--up-2);
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--up-2);
  flex-wrap: wrap;
}

.stats__vide {
  grid-column: 1 / -1;
  padding: var(--up-5);
  text-align: center;
  color: var(--up-encre-douce);
}

@media (max-width: 599px) {
  .cartes {
    grid-template-columns: 1fr;
  }
}
</style>
