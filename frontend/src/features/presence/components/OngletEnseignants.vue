<template>
  <div>
    <releve-chiffres v-if="rapport?.total" :chiffres="chiffres" class="q-mb-md" />

    <ul v-if="vue === 'cartes'" class="cartes">
      <li v-for="l in rapport?.lignes ?? []" :key="l.enseignantId">
        <article class="plaque fiche">
          <header class="fiche__tete">
            <span class="fiche__titre">
              <span class="lettrage fiche__nom">{{ l.nom }}</span>
              <span class="pochoir fiche__sous">
                {{ l.matricule }}<template v-if="l.departement"> · {{ l.departement }}</template>
              </span>
            </span>
            <span class="fiche__actions">
              <q-btn
                flat
                dense
                round
                icon="event_note"
                :aria-label="$t('statistiques.enseignants.actions.sessionsAria')"
                :to="lienSeances(l.enseignantId)"
              >
                <q-tooltip>{{ $t('statistiques.enseignants.actions.sessionsTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                icon="print"
                :aria-label="$t('statistiques.enseignants.actions.printAria')"
                @click="emit('imprimerFiche', l.enseignantId)"
              >
                <q-tooltip>{{ $t('statistiques.enseignants.actions.printTooltip') }}</q-tooltip>
              </q-btn>
            </span>
          </header>

          <div class="fiche__chiffres">
            <div class="fiche__chiffre">
              <span class="pochoir">{{ $t('common.fields.sessions') }}</span>
              <span class="lettrage chiffres">{{ l.planifiees }}</span>
            </div>
            <div class="fiche__chiffre">
              <span class="pochoir">{{ $t('statistiques.enseignants.card.done') }}</span>
              <span class="lettrage chiffres">{{ l.assurees }}</span>
            </div>
            <div class="fiche__chiffre">
              <span class="pochoir">{{ $t('statistiques.enseignants.card.late') }}</span>
              <span class="lettrage chiffres">{{ l.retard }}</span>
            </div>
            <div class="fiche__chiffre">
              <span class="pochoir">{{ $t('common.fields.absences') }}</span>
              <span class="lettrage chiffres" :class="l.absent ? 'text-negative' : ''">
                {{ l.absent }}
              </span>
            </div>
          </div>

          <div class="fiche__taux">
            <span class="pochoir">{{ $t('common.fields.attendance') }}</span>
            <barre-taux :valeur="l.tauxPresence" />
          </div>

          <footer class="pochoir pochoir--brut fiche__pied">
            {{ $t('statistiques.enseignants.card.hoursDone', { hours: heuresLisibles(l.heuresRealisees) }) }}
          </footer>
        </article>
      </li>
      <li v-if="!(rapport?.lignes ?? []).length" class="stats__vide pochoir">
        {{ $t('statistiques.enseignants.empty.cards') }}
      </li>
    </ul>

    <q-table
      v-else
      flat
      bordered
      class="carte"
      :rows="rapport?.lignes ?? []"
      :columns="colonnes"
      row-key="enseignantId"
      :loading="chargement"
      :pagination="{ rowsPerPage: 25 }"
      :visible-columns="colonnesVisibles"
      :loading-label="$t('statistiques.enseignants.table.loading')"
      :no-data-label="$t('statistiques.enseignants.empty.table')"
    >
      <template #body-cell-presence="p">
        <q-td :props="p"><barre-taux :valeur="p.row.tauxPresence" /></q-td>
      </template>

      <template #body-cell-fiche="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="event_note"
            :aria-label="$t('statistiques.enseignants.actions.sessionsAria')"
            :to="lienSeances(p.row.enseignantId)"
          >
            <q-tooltip>{{ $t('statistiques.enseignants.actions.sessionsTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            :aria-label="$t('statistiques.enseignants.actions.printAria')"
            @click="emit('imprimerFiche', p.row.enseignantId)"
          >
            <q-tooltip>{{ $t('statistiques.enseignants.actions.printTooltip') }}</q-tooltip>
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
import { heuresLisibles, pourcentLisible } from '@/shared/utils/libelles';
import type { RapportAssiduite } from '../services/rapports';
import type { ChiffreReleve, VueListe } from '../types';

/** Onglet « par enseignant » : l'assiduité de chacun sur la période. */
const props = defineProps<{
  rapport: RapportAssiduite | null;
  chargement: boolean;
  vue: VueListe;
  dateDebut: string;
  dateFin: string;
}>();
const emit = defineEmits<{ imprimerFiche: [string] }>();

const $q = useQuasar();
const { t } = useI18n();

const chiffres = computed<ChiffreReleve[]>(() => {
  const total = props.rapport?.total;
  if (!total) return [];
  return [
    { label: t('common.fields.sessions'), valeur: total.planifiees ?? 0 },
    { label: t('common.fields.attendance'), valeur: pourcentLisible(total.tauxPresence) },
    { label: t('common.fields.absences'), valeur: total.absent ?? 0 },
    { label: t('statistiques.enseignants.summary.hours'), valeur: heuresLisibles(total.heuresRealisees) },
  ];
});

/** Un relevé se termine toujours par « et concrètement, quelles séances ? ». */
const lienSeances = (enseignantId: string) => ({
  name: 'seances',
  query: { enseignantId, dateDebut: props.dateDebut, dateFin: props.dateFin },
});

const colonnes = computed<QTableColumn[]>(() => [
  {
    name: 'matricule',
    label: t('statistiques.enseignants.table.columns.matricule'),
    field: 'matricule',
    align: 'left',
  },
  { name: 'nom', label: t('common.fields.teacher'), field: 'nom', align: 'left', sortable: true },
  { name: 'departement', label: t('common.fields.department'), field: 'departement', align: 'left' },
  { name: 'planifiees', label: t('common.fields.sessions'), field: 'planifiees', align: 'right', sortable: true },
  { name: 'assurees', label: t('statistiques.enseignants.table.columns.assurees'), field: 'assurees', align: 'right' },
  {
    name: 'retard',
    label: t('statistiques.enseignants.table.columns.retard'),
    field: 'retard',
    align: 'right',
    sortable: true,
  },
  { name: 'absent', label: t('common.fields.absences'), field: 'absent', align: 'right', sortable: true },
  {
    name: 'heures',
    label: t('common.fields.hours'),
    field: (r: { heuresRealisees?: number }) => heuresLisibles(r.heuresRealisees),
    align: 'right',
  },
  { name: 'presence', label: t('common.fields.attendance'), field: 'tauxPresence', align: 'left', sortable: true },
  { name: 'fiche', label: '', field: 'enseignantId', align: 'right' },
]);

const colonnesVisibles = computed(() =>
  $q.screen.lt.md ? ['nom', 'absent', 'presence'] : colonnes.value.map((c) => String(c.name)),
);
</script>

<style scoped lang="scss">
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

.fiche__actions {
  display: flex;
  align-items: center;
  gap: var(--up-1);
  flex: 0 0 auto;
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
