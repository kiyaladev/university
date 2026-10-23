<template>
  <barre-filtres
    v-model="filtres"
    :chips="chips"
    :placeholder="$t('stages.filters.searchPlaceholderWorks')"
    @reinitialiser="emit('reinitialiser')"
  >
    <template #avances>
      <q-select
        v-model="filtres.type"
        :options="optionsTypes"
        emit-value
        map-options
        dense
        outlined
        clearable
        :label="$t('common.fields.type')"
      />
      <champ-recherche
        v-model="filtres.encadrantId"
        endpoint="/enseignants"
        :label-fn="(e) => `${e.nom} ${e.prenom} (${e.matricule})`"
        :label="$t('stages.filters.supervisor')"
      />
    </template>
  </barre-filtres>

  <!-- Compteurs par statut -->
  <div class="row q-col-gutter-sm q-mb-md">
    <div v-for="c in compteurs" :key="c.statut" class="col-6 col-sm-4 col-lg-2">
      <q-card
        flat
        bordered
        class="carte carte-compteur"
        :class="{ 'carte-compteur--actif': filtres.statut === c.statut }"
        @click="basculerStatut(c.statut)"
      >
        <q-card-section class="text-center q-py-sm">
          <div class="text-h5 q-mb-none">{{ c.nb }}</div>
          <div class="text-caption text-grey-7">{{ c.label }}</div>
        </q-card-section>
      </q-card>
    </div>
  </div>

  <!-- Vue tableau -->
  <q-table
    :grid="$q.screen.lt.md"
    flat
    bordered
    class="carte"
    :rows="lignesVisibles"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :pagination="{ rowsPerPage: 20 }"
  >
    <template #item="p">
      <div class="col-12 q-pb-sm">
        <q-card flat bordered class="carte">
          <q-card-section>
            <div v-for="c in p.cols.filter((c) => c.name !== 'actions')" :key="c.name" class="q-mb-sm">
              <div class="text-caption text-grey-7">{{ c.label }}</div>
              <template v-if="c.name === 'intitule'">{{ p.row.intitule }}</template>
              <template v-else-if="c.name === 'etudiant'"
                >{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</template
              >
              <template v-else-if="c.name === 'encadrant'"
                >{{ p.row.encadrant?.nom }} {{ p.row.encadrant?.prenom }}</template
              >
              <template v-else-if="c.name === 'statut'">{{
                LIBELLE_STATUT_ENCADREMENT[p.row.statut] ?? p.row.statut
              }}</template>
              <template v-else-if="c.name === 'periode'"
                >{{ dateLisible(p.row.dateDebut) }} — {{ dateLisible(p.row.dateFin) }}</template
              >
              <template v-else-if="c.name === 'rapport'">
                <q-toggle
                  :model-value="p.row.rapportRendu"
                  :disable="['SOUTENU', 'ABANDONNE'].includes(p.row.statut) || !peutModifierRapport(p.row)"
                  :label="p.row.rapportRendu ? $t('stages.table.report.done') : $t('stages.table.report.pending')"
                  @update:model-value="(v: boolean) => emit('rapport', p.row, v)"
                />
              </template>
              <template v-else-if="c.name === 'soutenance'">{{
                p.row.soutenance ? dateHeureLisible(p.row.soutenance.date) : '—'
              }}</template>
              <span v-else>{{ c.value }}</span>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              dense
              no-caps
              icon="visibility"
              :label="$t('stages.table.actions.viewSheetTooltip')"
              @click="emit('detail', p.row)"
            />
            <q-btn
              v-for="b in boutonsTransition(p.row).slice(0, 1)"
              :key="b.statut"
              flat
              dense
              no-caps
              :color="b.couleur"
              :icon="b.icone"
              :label="b.libelle"
              @click="emit('transition', p.row, b.statut)"
            />
            <actions-secondaires>
              <q-btn
                v-close-popup
                v-if="peutCreer && ['PROPOSE', 'VALIDE', 'EN_COURS'].includes(p.row.statut)"
                flat
                dense
                no-caps
                icon="edit"
                :label="$t('common.actions.edit')"
                @click="emit('edition', p.row)"
              />
              <q-btn
                v-close-popup
                flat
                dense
                no-caps
                icon="print"
                :label="$t('stages.table.actions.print')"
                @click="emit('imprimer', p.row)"
              />
              <q-btn
                v-close-popup
                v-for="b in boutonsTransition(p.row).slice(1)"
                :key="b.statut"
                flat
                dense
                no-caps
                :color="b.couleur"
                :icon="b.icone"
                :label="b.libelle"
                @click="emit('transition', p.row, b.statut)"
              />
              <q-btn
                v-close-popup
                v-if="peutPlanifierSoutenance(p.row)"
                flat
                dense
                no-caps
                color="primary"
                icon="groups"
                :label="$t('stages.table.actions.planDefense')"
                @click="emit('soutenance', p.row)"
              />
              <q-btn
                v-close-popup
                v-if="peutConstatJury(p.row)"
                flat
                dense
                no-caps
                color="deep-purple"
                icon="fact_check"
                :label="$t('stages.table.actions.juryReport')"
                @click="emit('jury', p.row)"
              />
              <q-btn
                v-close-popup
                v-if="auth.estAdmin && ['PROPOSE', 'VALIDE'].includes(p.row.statut)"
                flat
                dense
                no-caps
                color="negative"
                icon="delete"
                :label="$t('common.actions.delete')"
                @click="emit('supprimer', p.row)"
              />
            </actions-secondaires>
          </q-card-actions>
        </q-card>
      </div>
    </template>
    <template #no-data>
      <etat-vide
        icone="work_off"
        :titre="$t('stages.table.emptyState.title')"
        :aide="$t('stages.table.emptyState.description')"
      >
        <template v-if="peutCreer" #action>
          <q-btn flat no-caps color="primary" icon="add" :label="$t('stages.actions.new')" @click="emit('creer')" />
        </template>
      </etat-vide>
    </template>

    <template #body-cell-intitule="p">
      <q-td :props="p">
        <div class="text-weight-medium">
          {{ LIBELLE_TYPE_ENCADREMENT[p.row.type] }} {{ $t('common.format.emptyValue') }} {{ p.row.intitule }}
        </div>
        <div v-if="p.row.entreprise" class="text-caption text-grey-7">
          {{ p.row.entreprise }}
        </div>
      </q-td>
    </template>
    <template #body-cell-etudiant="p">
      <q-td :props="p">
        <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
        <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule ?? '' }}</div>
      </q-td>
    </template>
    <template #body-cell-encadrant="p">
      <q-td :props="p">
        <span v-if="p.row.encadrant">{{ p.row.encadrant.nom }} {{ p.row.encadrant.prenom }}</span>
        <span v-else class="text-grey-6">{{ $t('stages.toDesignate') }}</span>
      </q-td>
    </template>
    <template #body-cell-periode="p">
      <q-td :props="p">
        <span v-if="p.row.dateDebut || p.row.dateFin">
          {{ dateLisible(p.row.dateDebut) }} → {{ dateLisible(p.row.dateFin) }}
        </span>
        <span v-else class="text-grey-6">{{ $t('common.format.emptyValue') }}</span>
      </q-td>
    </template>
    <template #body-cell-statut="p">
      <q-td :props="p">
        <PastilleStatut domaine="stage" :statut="p.row.statut" />
      </q-td>
    </template>
    <template #body-cell-rapport="p">
      <q-td :props="p" class="text-center">
        <q-toggle
          :model-value="p.row.rapportRendu"
          color="positive"
          :disable="['SOUTENU', 'ABANDONNE'].includes(p.row.statut) || !peutModifierRapport(p.row)"
          @update:model-value="(v: boolean) => emit('rapport', p.row, v)"
        />
        <div class="text-caption text-grey-7">
          {{ p.row.rapportRendu ? $t('stages.table.report.done') : $t('stages.table.report.pending') }}
        </div>
      </q-td>
    </template>
    <template #body-cell-soutenance="p">
      <q-td :props="p">
        <template v-if="p.row.soutenance">
          <div>{{ dateHeureLisible(p.row.soutenance.date) }}</div>
          <div class="text-caption text-grey-7">
            <template v-if="p.row.soutenance.note !== null">
              {{ p.row.soutenance.note }}{{ $t('common.units.outOf20')
              }}<template v-if="p.row.soutenance.mention"> · {{ p.row.soutenance.mention }}</template>
            </template>
            <span v-else>{{ $t('stages.table.defense.awaitingReport') }}</span>
          </div>
        </template>
        <span v-else class="text-grey-6">{{ $t('common.format.emptyValue') }}</span>
      </q-td>
    </template>
    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          flat
          dense
          no-caps
          icon="visibility"
          :label="$t('stages.table.actions.viewSheetTooltip')"
          @click="emit('detail', p.row)"
        />
        <q-btn
          v-for="b in boutonsTransition(p.row).slice(0, 1)"
          :key="b.statut"
          flat
          dense
          no-caps
          :color="b.couleur"
          :icon="b.icone"
          :label="b.libelle"
          @click="emit('transition', p.row, b.statut)"
        />
        <actions-secondaires>
          <q-btn
            v-close-popup
            v-if="peutCreer && ['PROPOSE', 'VALIDE', 'EN_COURS'].includes(p.row.statut)"
            flat
            dense
            no-caps
            icon="edit"
            :label="$t('common.actions.edit')"
            @click="emit('edition', p.row)"
          />
          <q-btn
            v-close-popup
            flat
            dense
            no-caps
            icon="print"
            :label="$t('stages.table.actions.print')"
            @click="emit('imprimer', p.row)"
          />
          <q-btn
            v-close-popup
            v-for="b in boutonsTransition(p.row).slice(1)"
            :key="b.statut"
            flat
            dense
            no-caps
            :color="b.couleur"
            :icon="b.icone"
            :label="b.libelle"
            @click="emit('transition', p.row, b.statut)"
          />
          <q-btn
            v-close-popup
            v-if="peutPlanifierSoutenance(p.row)"
            flat
            dense
            no-caps
            color="primary"
            icon="groups"
            :label="$t('stages.table.actions.planDefense')"
            @click="emit('soutenance', p.row)"
          />
          <q-btn
            v-close-popup
            v-if="peutConstatJury(p.row)"
            flat
            dense
            no-caps
            color="deep-purple"
            icon="fact_check"
            :label="$t('stages.table.actions.juryReport')"
            @click="emit('jury', p.row)"
          />
          <q-btn
            v-close-popup
            v-if="auth.estAdmin && ['PROPOSE', 'VALIDE'].includes(p.row.statut)"
            flat
            dense
            no-caps
            color="negative"
            icon="delete"
            :label="$t('common.actions.delete')"
            @click="emit('supprimer', p.row)"
          />
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>

  <!-- Statistiques par type -->
  <div class="row q-col-gutter-md q-mt-md">
    <q-card flat bordered class="col-12 col-md-6 carte">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ $t('stages.stats.byType') }}</div>
        <q-list dense>
          <q-item v-for="s in statsParType" :key="s.type">
            <q-item-section>
              <q-item-label>{{ s.label }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge color="primary" :label="s.nb" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
    <q-card flat bordered class="col-12 col-md-6 carte">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">{{ $t('stages.stats.byStatus') }}</div>
        <q-list dense>
          <q-item v-for="c in compteurs" :key="`stat-${c.statut}`">
            <q-item-section>
              <q-item-label>{{ c.label }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <PastilleStatut domaine="stage" :statut="c.statut" :libelle="String(c.nb)" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet « Travaux » : filtres, compteurs, tableau de suivi et statistiques.
 *
 * Le composant ne fait aucune requête : la page détient la liste et les
 * filtres, le panneau ne fait que les afficher et remonter les intentions
 * (transition, rapport, impression, édition, soutenance, jury, suppression).
 */
import { computed } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { useAuthStore } from '@/stores/auth';
import { LIBELLE_STATUT_ENCADREMENT, LIBELLE_TYPE_ENCADREMENT } from '@/shared/utils/libelles';
import { dateHeureLisible, dateLisible } from '@/shared/utils/format';
import type { ChipFiltre, StatutEncadrement, TravailEncadre, TypeEncadrement } from '@/types';
import type { BoutonTransition } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();

/** Filtres de l'onglet : la page les détient, le panneau les affiche. */
const filtres = defineModel<Record<string, any>>('filtres', { required: true });

const props = defineProps<{
  lignes: TravailEncadre[];
  chargement: boolean;
  chips: ChipFiltre[];
}>();

const emit = defineEmits<{
  reinitialiser: [];
  transition: [travail: TravailEncadre, cible: StatutEncadrement];
  rapport: [travail: TravailEncadre, rendu: boolean];
  imprimer: [travail: TravailEncadre];
  supprimer: [travail: TravailEncadre];
  edition: [travail: TravailEncadre];
  soutenance: [travail: TravailEncadre];
  jury: [travail: TravailEncadre];
  detail: [travail: TravailEncadre];
  creer: [];
}>();

const optionsTypes = computed(() => [
  { label: t('stages.types.memoire'), value: 'MEMOIRE' },
  { label: t('stages.types.stage'), value: 'STAGE' },
  { label: t('stages.types.rapport'), value: 'RAPPORT' },
]);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'intitule', label: t('stages.table.columns.work'), field: 'intitule', align: 'left', sortable: true },
  { name: 'etudiant', label: t('common.fields.student'), field: 'etudiantId', align: 'left' },
  { name: 'encadrant', label: t('stages.table.columns.supervisor'), field: 'encadrantId', align: 'left' },
  { name: 'periode', label: t('common.fields.period'), field: 'dateDebut', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  { name: 'rapport', label: t('stages.table.columns.report'), field: 'rapportRendu', align: 'center' },
  { name: 'soutenance', label: t('stages.table.columns.defense'), field: 'soutenance', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const compteurs = computed(() => {
  const statuts: StatutEncadrement[] = ['PROPOSE', 'VALIDE', 'EN_COURS', 'SOUTENU', 'ABANDONNE'];
  return statuts.map((statut) => ({
    statut,
    label: LIBELLE_STATUT_ENCADREMENT[statut] ?? statut,
    nb: props.lignes.filter((x) => x.statut === statut).length,
  }));
});

const lignesVisibles = computed(() =>
  filtres.value.statut ? props.lignes.filter((x) => x.statut === filtres.value.statut) : props.lignes,
);

const statsParType = computed(() => {
  const types: TypeEncadrement[] = ['STAGE', 'MEMOIRE', 'RAPPORT'];
  return types.map((type) => ({
    type,
    label: LIBELLE_TYPE_ENCADREMENT[type],
    nb: props.lignes.filter((x) => x.type === type).length,
  }));
});

const BOUTONS_PAR_STATUT = computed<Record<StatutEncadrement, (BoutonTransition & { statut: StatutEncadrement })[]>>(
  () => {
    const abandon = {
      statut: 'ABANDONNE' as const,
      libelle: t('stages.transitions.abandon'),
      icone: 'flag',
      couleur: 'negative',
    };
    return {
      PROPOSE: [
        { statut: 'VALIDE', libelle: t('stages.transitions.validate'), icone: 'check', couleur: 'positive' },
        abandon,
      ],
      VALIDE: [
        {
          statut: 'EN_COURS',
          libelle: t('stages.transitions.startSupervision'),
          icone: 'play_arrow',
          couleur: 'primary',
        },
        abandon,
      ],
      EN_COURS: [
        {
          statut: 'SOUTENU',
          libelle: t('stages.transitions.moveToDefended'),
          icone: 'workspace_premium',
          couleur: 'positive',
        },
        abandon,
      ],
      SOUTENU: [],
      ABANDONNE: [
        {
          statut: 'PROPOSE',
          libelle: t('stages.transitions.reactivate'),
          icone: 'restart_alt',
          couleur: 'primary',
          role: ['ADMIN'],
        },
      ],
    };
  },
);

const peutCreer = computed(() => auth.peut('stages.creer'));

const peutTransitionner = computed(() => auth.peut('stages.transitionner'));

function basculerStatut(statut: StatutEncadrement) {
  filtres.value.statut = filtres.value.statut === statut ? null : statut;
}

const estEncadrant = (tr: TravailEncadre) =>
  auth.role === 'ENSEIGNANT' && tr.encadrantId === auth.utilisateur?.enseignantId;

function boutonsTransition(tr: TravailEncadre) {
  if (!peutTransitionner.value) return [];
  if (auth.role === 'ENSEIGNANT' && !estEncadrant(tr)) return [];
  return (BOUTONS_PAR_STATUT.value[tr.statut] ?? []).filter((b) => !b.role || auth.aRole(b.role as never));
}

function peutModifierRapport(tr: TravailEncadre) {
  return auth.peut('stages.modifierRapport') || estEncadrant(tr);
}

function peutPlanifierSoutenance(tr: TravailEncadre) {
  return auth.peut('stages.planifierSoutenance') && tr.statut === 'EN_COURS' && !tr.soutenance;
}

function peutConstatJury(tr: TravailEncadre) {
  return auth.peut('stages.constaterJury') && !!tr.soutenance;
}
</script>

<style scoped lang="scss">
.carte-compteur {
  cursor: pointer;
  transition: background 0.15s ease;
}
.carte-compteur--actif {
  background: #e3f2fd;
  border-color: #0066cc;
}
</style>
