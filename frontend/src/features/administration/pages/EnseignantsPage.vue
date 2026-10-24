<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('common.fields.teachers')" :subtitle="$t('enseignants.header.subtitle')">
      <template v-if="auth.peutPlanifier" #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('enseignants.header.newTeacher')"
          @click="ouvrir(null)"
        />
      </template>
    </en-tete-page>

    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('enseignants.filters.searchPlaceholder')"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.departementId"
          :options="optionsDepartements"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.department')"
        />
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.status')"
        />
      </template>
    </barre-filtres>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="ens.lignes"
      :columns="colonnes"
      row-key="id"
      :loading="ens.chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <etat-vide icone="person" :titre="messageVide">
          <template #action>
            <q-btn
              v-if="auth.peutPlanifier && !filtresActifs"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('enseignants.emptyState.createFirst')"
              @click="ouvrir(null)"
            />
            <q-btn
              v-else-if="filtresActifs"
              flat
              no-caps
              icon="refresh"
              :label="$t('enseignants.emptyState.clearFilters')"
              @click="reinitialiser"
            />
          </template>
        </etat-vide>
      </template>

      <template #body-cell-nom="p">
        <q-td :props="p">
          <div>{{ p.row.nom }} {{ p.row.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="enseignant" :statut="p.row.statut" />
          <q-badge v-if="!p.row.actif" color="grey-7" class="q-ml-xs">{{ $t('enseignants.table.inactive') }}</q-badge>
        </q-td>
      </template>

      <template #body-cell-compte="p">
        <q-td :props="p" class="text-center">
          <q-icon
            :name="p.row.user ? 'check_circle' : 'remove_circle_outline'"
            :color="p.row.user ? 'positive' : 'grey-5'"
          />
          <q-tooltip>
            {{
              p.row.user
                ? t('enseignants.table.accountTooltip', { email: p.row.user.email })
                : $t('enseignants.table.noAccount')
            }}
          </q-tooltip>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="auth.peutPlanifier"
            flat
            dense
            no-caps
            icon="edit"
            :aria-label="$t('enseignants.table.actionsAria.modifier')"
            :label="$t('enseignants.table.actionsAria.modifier')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <actions-secondaires>
            <q-btn
              v-close-popup
              flat
              dense
              no-caps
              icon="assignment_ind"
              :aria-label="$t('enseignants.table.actionsAria.charges')"
              :label="$t('enseignants.table.actionsAria.charges')"
              @click="voirCharges(p.row)"
            >
              <q-tooltip>{{ $t('enseignants.table.actionsTooltip.charges') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-close-popup
              flat
              dense
              no-caps
              color="primary"
              icon="verified_user"
              :aria-label="$t('enseignants.table.actionsAria.moyens')"
              :label="$t('enseignants.table.actionsAria.moyens')"
              @click="ouvrirMoyens(p.row)"
            >
              <q-tooltip>{{ $t('enseignants.table.actionsTooltip.moyens') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-close-popup
              flat
              dense
              no-caps
              icon="assessment"
              :aria-label="$t('enseignants.table.actionsAria.fiche')"
              :label="$t('enseignants.table.actionsAria.fiche')"
              @click="imprimerFiche(p.row)"
            >
              <q-tooltip>{{ $t('enseignants.table.actionsTooltip.fiche') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-close-popup
              v-if="auth.estAdmin"
              flat
              dense
              no-caps
              color="negative"
              icon="delete"
              :aria-label="$t('enseignants.table.actionsAria.supprimer')"
              :label="$t('enseignants.table.actionsAria.supprimer')"
              @click="supprimer(p.row)"
            >
              <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
            </q-btn>
          </actions-secondaires>
        </q-td>
      </template>
    </q-table>

    <cartes-enseignants
      v-else
      :enseignants="ens.lignes"
      :message-vide="messageVide"
      :filtres-actifs="filtresActifs"
      :chargement="ens.chargement"
      @ouvrir="ouvrir"
      @voir-charges="voirCharges"
      @ouvrir-moyens="ouvrirMoyens"
      @reinitialiser="reinitialiser"
    />

    <barre-pagination
      v-if="ens.lignes.length"
      v-model:page="ens.page"
      v-model:page-size="ens.pageSize"
      :total="ens.total"
      @tous="ens.toutAfficher()"
    />

    <dialogue-enseignant
      v-model="dialogOuvert"
      :enseignant="enseignantEdite"
      :departements="departements"
      @enregistre="ens.recharger()"
    />

    <!-- Moyens d'attestation : code personnel et empreinte -->
    <dialogue-moyens-enseignant v-model:ouvert="dialogMoyens" :enseignant="enseignantMoyens" />
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import DialogueEnseignant from '@/features/administration/components/DialogueEnseignant.vue';
import CartesEnseignants from '@/features/administration/components/CartesEnseignants.vue';
import DialogueMoyensEnseignant from '@/features/administration/components/DialogueMoyensEnseignant.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { useImpressionFicheEnseignant } from '@/shared/composables/useImpressionFicheEnseignant';
import {
  LIBELLE_STATUT_ENSEIGNANT,
  STATUTS_ENSEIGNANT,
  aujourdhui,
  decalerJours,
  montantLisible,
} from '@/shared/utils/libelles';
import type { Departement, Enseignant, ChipFiltre, FiltresPage } from '@/types';
import { enseignantsService } from '@/features/administration/services/enseignants';

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const router = useRouter();
const { t } = useI18n();
const { confirmer } = useConfirmation();
const { ouvrir: ouvrirFicheEnseignant } = useImpressionFicheEnseignant();

const departements = ref<Departement[]>([]);
const modeVue = usePresentationListe();
const dialogOuvert = ref(false);
const enseignantEdite = ref<Enseignant | null>(null);

// Filtres gardés dans l'URL : l'arrivée depuis « Utilisateurs » pré-recherche la fiche visée.
const filtres = ref<FiltresPage>({ recherche: '', departementId: null, statut: null });
const ens = reactive(
  useListePaginee<Enseignant>({
    filtres,
    syncUrl: true,
    charger: ({ filtres: f, ...p }) =>
      enseignantsService.liste({
        ...pageApi(p),
        search: texteApi(f.recherche),
        departementId: f.departementId || undefined,
        statut: f.statut || undefined,
      }),
  }),
);

const optionsDepartements = computed(() => departements.value.map((d) => ({ label: d.nom, value: d.id })));
const optionsStatuts = STATUTS_ENSEIGNANT.map((s) => ({
  label: LIBELLE_STATUT_ENSEIGNANT[s] ?? s,
  value: s,
}));

const filtresActifs = computed(() =>
  Boolean(filtres.value.recherche || filtres.value.departementId || filtres.value.statut),
);
const messageVide = computed(() =>
  filtresActifs.value ? t('enseignants.emptyState.filtered') : t('enseignants.emptyState.none'),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('enseignants.filters.chips.search', { q: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.departementId) {
    const d = departements.value.find((x) => x.id === filtres.value.departementId);
    cs.push({
      label: t('enseignants.filters.chips.departement', { nom: d?.nom ?? '?' }),
      value: filtres.value.departementId,
      icone: 'apartment',
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: t('enseignants.filters.chips.statut', {
        statut: LIBELLE_STATUT_ENSEIGNANT[filtres.value.statut] ?? filtres.value.statut,
      }),
      value: filtres.value.statut,
      icone: 'badge',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'nom', label: t('enseignants.table.columns.nom'), field: 'nom', align: 'left', sortable: true },
  {
    name: 'grade',
    label: t('enseignants.table.columns.grade'),
    field: (r: Enseignant) => r.grade || '—',
    align: 'left',
  },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left', sortable: true },
  {
    name: 'departement',
    label: t('common.fields.department'),
    field: (r: Enseignant) => r.departement?.nom ?? '—',
    align: 'left',
  },
  {
    name: 'taux',
    label: t('enseignants.table.columns.taux'),
    field: (r: Enseignant) => (r.tauxHoraire ? montantLisible(r.tauxHoraire) : '—'),
    align: 'right',
  },
  { name: 'telephone', label: t('common.fields.phone'), field: (r: Enseignant) => r.telephone || '—', align: 'left' },
  { name: 'compte', label: t('enseignants.table.columns.compte'), field: 'id', align: 'center' },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
]);

function ouvrir(e: Enseignant | null) {
  enseignantEdite.value = e;
  dialogOuvert.value = true;
}

/** Un enseignant se lit d'abord par ce qu'il enseigne : on ouvre ses charges. */
function voirCharges(e: Enseignant) {
  void router.push({ path: '/affectations', query: { enseignantId: e.id } });
}

// ------------------------------------------------- moyens d'attestation
const dialogMoyens = ref(false);
const enseignantMoyens = ref<Enseignant | null>(null);

function ouvrirMoyens(e: Enseignant) {
  enseignantMoyens.value = e;
  dialogMoyens.value = true;
}

function imprimerFiche(e: Enseignant) {
  const debut = decalerJours(aujourdhui(), -90);
  ouvrirFicheEnseignant(e.id, debut, aujourdhui());
}

async function supprimer(e: Enseignant) {
  const ok = await confirmer({
    titre: t('enseignants.messages.deleteTitle'),
    message: t('enseignants.messages.deleteMessage', { nom: e.nom, prenom: e.prenom }),
    ok: t('common.actions.delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await enseignantsService.supprimer(e.id);
  } catch {
    // L'intercepteur axios affiche le motif de l'échec.
    return;
  }
  $q.notify({ type: 'positive', message: t('enseignants.messages.deleteSuccess') });
  await Promise.all([ens.recharger(), referentiels.rafraichir('enseignants')]);
}

function reinitialiser() {
  ens.reinitialiser([]);
}

onMounted(async () => {
  departements.value = await referentiels.departements();
});
</script>
