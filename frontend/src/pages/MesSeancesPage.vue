<template>
  <q-page class="q-pa-md">
    <page-header :title="$t('mesSeances.title')" :subtitle="$t('mesSeances.subtitle')">
      <template #actions>
        <div class="row q-gutter-sm items-center">
          <champ-date v-model="dateDebut" :label="$t('common.actions.from')" style="width: 152px" />
          <champ-date v-model="dateFin" :label="$t('common.actions.to')" style="width: 152px" />
          <q-btn
            flat
            no-caps
            icon="assignment_turned_in"
            :label="$t('mesSeances.actions.myJustificatifs')"
            to="/justificatifs"
          />
          <q-btn
            outline
            color="primary"
            icon="print"
            no-caps
            :label="$t('mesSeances.actions.printAttendance')"
            :disable="!auth.utilisateur?.enseignantId"
            @click="imprimer"
          />
        </div>
      </template>
    </page-header>

    <section class="plaque releve-chiffres">
      <div v-for="k in kpis" :key="k.libelle" class="releve-chiffres__cellule">
        <p class="pochoir">{{ k.libelle }}</p>
        <p class="lettrage avec-unite chiffres releve-chiffres__valeur" :class="`text-${k.couleur}`">
          {{ k.valeur }}
        </p>
      </div>
    </section>

    <!-- Sur téléphone, le relevé se lit en plaques : un registre de huit
         colonnes n'entre pas dans 390 px sans rogner ce qui compte. -->
    <ol v-if="$q.screen.lt.md" class="releve-plaques">
      <li v-for="s in fiche?.seances ?? []" :key="s.id">
        <article class="plaque seance-relevee">
          <div class="seance-relevee__corps">
            <p class="pochoir pochoir--brut chiffres seance-relevee__quand">
              {{ dateLisible(s.date) }} · {{ s.horaire }}
            </p>
            <h2 class="lettrage seance-relevee__matiere">{{ s.matiere }}</h2>
            <p class="pochoir seance-relevee__lieu">
              {{ s.promotion }}
              <span v-if="s.salle && s.salle !== '—'" class="plaque-salle">{{ s.salle }}</span>
            </p>
            <p v-if="s.thematiqueTraitee" class="seance-relevee__theme">{{ s.thematiqueTraitee }}</p>
          </div>
          <div class="seance-relevee__constat">
            <champ-statut :statut="s.statut" />
            <span class="pochoir pochoir--brut seance-relevee__duree">
              {{ dureeLisible(s.dureeMinutes) }}
            </span>
          </div>
        </article>
      </li>
      <li v-if="!chargement && !fiche?.seances?.length" class="seance-relevee__vide pochoir">
        {{ $t('mesSeances.emptyState.seances') }}
      </li>
    </ol>

    <q-table
      v-else
      flat
      bordered
      class="carte"
      :rows="fiche?.seances ?? []"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 25 }"
      :loading-label="$t('mesSeances.table.loadingLabel')"
    >
      <template #no-data>
        <etat-vide icone="event_busy" :titre="$t('mesSeances.emptyState.seances')" />
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <champ-statut :statut="p.row.statut" dense />
        </q-td>
      </template>
    </q-table>

    <q-inner-loading :showing="chargement && $q.screen.lt.md" />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import type { QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { useImpressionFicheEnseignant } from '../composables/useImpressionFicheEnseignant';
import ChampStatut from '../components/ChampStatut.vue';
import ChampDate from '../components/ChampDate.vue';
import PageHeader from '../components/PageHeader.vue';
import EtatVide from '../components/EtatVide.vue';
import {
  aujourdhui,
  dateLisible,
  decalerJours,
  dureeLisible,
  heuresLisibles,
} from '../utils/libelles';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const { ouvrir: ouvrirFicheEnseignant } = useImpressionFicheEnseignant();

const dateDebut = ref(decalerJours(aujourdhui(), -60));
const dateFin = ref(aujourdhui());
const fiche = ref<any>(null);
const chargement = ref(false);

const kpis = computed(() => {
  const s = fiche.value?.synthese;
  return [
    { libelle: t('mesSeances.kpis.planned'), valeur: s?.planifiees ?? 0, couleur: 'primary' },
    { libelle: t('mesSeances.kpis.ensured'), valeur: s?.assurees ?? 0, couleur: 'positive' },
    { libelle: t('common.fields.absences'), valeur: s?.absent ?? 0, couleur: 'negative' },
    {
      libelle: t('mesSeances.kpis.hoursDone'),
      valeur: heuresLisibles(s?.heuresRealisees),
      couleur: 'secondary',
    },
  ];
});

const colonnes = computed<QTableColumn[]>(() => [
  {
    name: 'date',
    label: t('common.fields.date'),
    field: (r: any) => dateLisible(r.date),
    align: 'left',
    sortable: true,
  },
  { name: 'horaire', label: t('common.fields.schedule'), field: 'horaire', align: 'left' },
  { name: 'matiere', label: t('common.fields.subject'), field: 'matiere', align: 'left' },
  { name: 'promotion', label: t('mesSeances.table.columns.promotion'), field: 'promotion', align: 'left' },
  { name: 'salle', label: t('common.fields.room'), field: 'salle', align: 'left' },
  { name: 'statut', label: t('mesSeances.table.columns.statut'), field: 'statut', align: 'left' },
  {
    name: 'duree',
    label: t('common.fields.duration'),
    field: (r: any) => dureeLisible(r.dureeMinutes),
    align: 'left',
  },
  { name: 'theme', label: t('mesSeances.table.columns.theme'), field: 'thematiqueTraitee', align: 'left' },
]);

function imprimer() {
  const enseignantId = auth.utilisateur?.enseignantId;
  if (!enseignantId) {
    $q.notify({
      type: 'warning',
      message: t('mesSeances.messages.noTeacherFile'),
    });
    return;
  }
  ouvrirFicheEnseignant(enseignantId, dateDebut.value, dateFin.value);
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/rapports/ma-fiche', {
      params: { dateDebut: dateDebut.value, dateFin: dateFin.value },
    });
    fiche.value = data;
  } finally {
    chargement.value = false;
  }
}

watch([dateDebut, dateFin], charger);
onMounted(charger);
</script>

<style scoped lang="scss">
.releve-chiffres {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: var(--up-3);
}

.releve-chiffres__cellule {
  padding: var(--up-3);

  & + & { border-left: var(--up-filet); }
}

.releve-chiffres__valeur {
  font-size: clamp(1.5rem, 1.1rem + 2vw, 2.2rem);
  margin: var(--up-1) 0 0;
}

@media (max-width: 767px) {
  .releve-chiffres { grid-template-columns: repeat(2, 1fr); }
  .releve-chiffres__cellule:nth-child(2n + 1) { border-left: 0; }
  .releve-chiffres__cellule:nth-child(n + 3) { border-top: var(--up-filet); }
}

.releve-plaques {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.seance-relevee {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: var(--up-2);
  padding: var(--up-3);
}

.seance-relevee__quand { color: var(--up-encre-douce); margin: 0; }

.seance-relevee__matiere { font-size: 1.05rem; margin: 4px 0 0; }

.seance-relevee__lieu {
  margin: 5px 0 0;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.seance-relevee__theme {
  margin: 6px 0 0;
  font-size: 0.86rem;
  color: var(--up-encre-douce);
}

.seance-relevee__constat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--up-2);
  flex: 0 0 auto;
}

.seance-relevee__duree { color: var(--up-encre-douce); }

.seance-relevee__vide {
  padding: var(--up-5) var(--up-3);
  text-align: center;
  color: var(--up-encre-douce);
}
</style>
