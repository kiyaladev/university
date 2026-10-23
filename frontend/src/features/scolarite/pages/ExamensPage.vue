<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('examens.title')" :subtitle="$t('examens.subtitle')">
      <template #actions>
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('examens.actions.schedule')"
          @click="dialogOuvert = true"
        />
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="qr_code_scanner"
          :label="$t('examens.actions.scanStation')"
          @click="allerScan(null)"
        />
        <q-btn
          v-if="peutVoirTirage"
          outline
          color="secondary"
          no-caps
          icon="local_printshop"
          :label="$t('examens.actions.draw')"
          @click="allerTirage(null)"
        />
      </template>
    </en-tete-page>

    <barre-filtres
      v-model="filtres"
      :placeholder="$t('examens.filters.searchPlaceholder')"
      :chips="chipsFiltres"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.type"
          :options="optionsTypes"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('examens.filters.type')"
        />
        <champ-recherche
          v-model="filtres.matiereId"
          endpoint="/matieres"
          :label="$t('common.fields.subject')"
          :label-fn="(m) => `${m.code} — ${m.intitule}`"
        />
        <champ-recherche
          v-model="filtres.promotionId"
          endpoint="/referentiel/promotions"
          :label="$t('examens.filters.promotion')"
          :label-fn="(p) => `${p.nom} — ${p.niveau}`"
        />
        <champ-recherche
          v-model="filtres.anneeId"
          endpoint="/referentiel/annees"
          :label="$t('common.fields.academicYear')"
          :label-fn="(a) => a.libelle"
        />
        <champ-date v-model="filtres.dateDebut" :label="$t('examens.filters.dateFrom')" />
        <champ-date v-model="filtres.dateFin" :label="$t('examens.filters.dateTo')" />
      </template>
    </barre-filtres>

    <q-tabs v-model="onglet" dense no-caps align="left" class="onglets-panneau q-mb-md">
      <q-tab name="PLANIFIE" :label="LIBELLE_STATUT_EXAMEN.PLANIFIE" icon="event" />
      <q-tab name="EN_COURS" :label="LIBELLE_STATUT_EXAMEN.EN_COURS" icon="play_circle_outline" />
      <q-tab name="TERMINE" :label="LIBELLE_STATUT_EXAMEN.TERMINE" icon="task_alt" />
      <q-tab name="ANNULE" :label="LIBELLE_STATUT_EXAMEN.ANNULE" icon="block" />
    </q-tabs>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="examensFiltres"
      :columns="colonnes"
      row-key="id"
      :loading="ex.chargement"
      :pagination="{ rowsPerPage: 0 }"
      @row-click="(_, row) => ouvrirFiche(row)"
    >
      <template #no-data>
        <etat-vide icone="quiz" :titre="messageVide">
          <template #action>
            <q-btn
              v-if="peutCreer && onglet === 'PLANIFIE'"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('examens.actions.schedule')"
              @click="dialogOuvert = true"
            />
          </template>
        </etat-vide>
      </template>

      <template #body-cell-type="p">
        <q-td :props="p">
          <q-badge color="primary" :label="libelleType(p.row.type)" />
        </q-td>
      </template>
      <template #body-cell-creneau="p">
        <q-td :props="p">
          <div>{{ dateLisible(p.row.dateExamen) }}</div>
          <div class="text-caption text-grey-7">{{ p.row.heureDebut }}–{{ p.row.heureFin }}</div>
        </q-td>
      </template>
      <template #body-cell-presence="p">
        <q-td :props="p" class="text-right">
          <q-chip dense size="sm" :color="p.row.nbPresents >= p.row.nbInscrits ? 'positive' : 'primary'">
            {{ p.row.nbPresents }} / {{ p.row.nbInscrits }}
          </q-chip>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="examen" :statut="p.row.statut" />
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            no-caps
            icon="visibility"
            color="primary"
            :aria-label="$t('examens.table.tooltips.openSheetAria')"
            :label="$t('examens.table.tooltips.openSheetAria')"
            @click.stop="ouvrirFiche(p.row)"
          >
            <q-tooltip>{{ $t('examens.table.tooltips.openSheet') }}</q-tooltip>
          </q-btn>
          <actions-secondaires>
            <q-btn
              v-close-popup
              v-if="p.row.statut === 'PLANIFIE' && peutDemarrer"
              flat
              dense
              no-caps
              icon="play_arrow"
              color="positive"
              :aria-label="$t('examens.table.tooltips.start')"
              :label="$t('examens.table.tooltips.start')"
              @click.stop="demarrer(p.row)"
            >
              <q-tooltip>{{ $t('examens.table.tooltips.start') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-close-popup
              v-if="p.row.statut === 'EN_COURS' && peutTerminer"
              flat
              dense
              no-caps
              icon="stop"
              color="negative"
              :aria-label="$t('examens.table.tooltips.finish')"
              :label="$t('examens.table.tooltips.finish')"
              @click.stop="terminer(p.row)"
            >
              <q-tooltip>{{ $t('examens.table.tooltips.finish') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-close-popup
              flat
              dense
              no-caps
              icon="qr_code_scanner"
              :aria-label="$t('examens.table.tooltips.scanCardsAria')"
              :label="$t('examens.table.tooltips.scanCardsAria')"
              @click.stop="allerScan(p.row)"
            >
              <q-tooltip>{{ $t('examens.table.tooltips.scanCards') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-close-popup
              v-if="peutVoirTirage"
              flat
              dense
              no-caps
              icon="local_printshop"
              :aria-label="$t('examens.table.tooltips.drawAria')"
              :label="$t('examens.table.tooltips.drawAria')"
              @click.stop="allerTirage(p.row)"
            >
              <q-tooltip>{{ $t('examens.table.tooltips.draw') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-close-popup
              v-if="p.row.statut === 'PLANIFIE' && peutAnnuler"
              flat
              dense
              no-caps
              icon="block"
              color="negative"
              :aria-label="$t('examens.actions.cancelExam')"
              :label="$t('examens.actions.cancelExam')"
              @click.stop="annulerExamen(p.row)"
            />
          </actions-secondaires>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="e in examensFiltres" :key="e.id" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered class="carte carte-examen full-height" @click="ouvrirFiche(e)">
          <q-card-section>
            <div class="row items-start no-wrap q-col-gutter-sm">
              <div class="col">
                <div class="text-caption text-grey-7">{{ e.codeExamen }}</div>
                <div class="text-subtitle1 text-weight-bold">{{ e.intitule }}</div>
                <div class="text-caption">{{ e.matiere?.intitule ?? '—' }} · {{ e.promotion?.nom ?? '—' }}</div>
              </div>
              <PastilleStatut domaine="examen" :statut="e.statut" />
            </div>
          </q-card-section>
          <q-card-section>
            <div class="row q-col-gutter-sm text-caption">
              <div class="col-6"><q-icon name="event" size="14px" /> {{ dateLisible(e.dateExamen) }}</div>
              <div class="col-6 text-right">
                <q-icon name="schedule" size="14px" /> {{ e.heureDebut }}–{{ e.heureFin }}
              </div>
              <div class="col-6"><q-icon name="meeting_room" size="14px" /> {{ e.salle?.code ?? '—' }}</div>
              <div class="col-6 text-right">
                <q-chip dense size="sm" :color="e.nbPresents >= e.nbInscrits ? 'positive' : 'primary'">
                  {{ e.nbPresents }} / {{ e.nbInscrits }}
                </q-chip>
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              v-if="e.statut === 'PLANIFIE' && peutDemarrer"
              flat
              dense
              no-caps
              icon="play_arrow"
              color="positive"
              :label="$t('common.actions.start')"
              @click.stop="demarrer(e)"
            />
            <actions-secondaires>
              <q-btn
                v-close-popup
                v-if="e.statut === 'EN_COURS' && peutTerminer"
                flat
                dense
                no-caps
                icon="stop"
                color="negative"
                :label="$t('examens.actions.finish')"
                @click.stop="terminer(e)"
              />
              <q-btn
                v-close-popup
                v-if="peutVoirTirage"
                flat
                dense
                no-caps
                icon="local_printshop"
                :label="$t('examens.actions.drawShort')"
                @click.stop="allerTirage(e)"
              />
              <q-btn
                v-close-popup
                flat
                dense
                no-caps
                icon="qr_code_scanner"
                :label="$t('examens.actions.scanner')"
                @click.stop="allerScan(e)"
              />
              <q-btn
                v-close-popup
                v-if="e.statut === 'PLANIFIE' && peutAnnuler"
                flat
                dense
                no-caps
                icon="block"
                color="negative"
                :label="$t('examens.actions.cancelExam')"
                @click.stop="annulerExamen(e)"
              />
            </actions-secondaires>
          </q-card-actions>
        </q-card>
      </div>
      <div v-if="!examensFiltres.length" class="col-12">
        <etat-vide class="plaque" icone="quiz" :titre="messageVide">
          <template #action>
            <q-btn
              v-if="peutCreer && onglet === 'PLANIFIE'"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('examens.actions.schedule')"
              @click="dialogOuvert = true"
            />
          </template>
        </etat-vide>
      </div>
    </div>

    <barre-pagination
      v-if="ex.total"
      v-model:page="ex.page"
      v-model:page-size="ex.pageSize"
      :total="ex.total"
      @tous="ex.toutAfficher()"
    />

    <dialogue-examen v-model="dialogOuvert" @enregistre="ex.recharger()" />

    <!-- Fiche de l'examen : les trois maillons de la chaîne au même endroit -->
    <q-dialog v-model="dialogFiche" :maximized="$q.screen.lt.md">
      <q-card style="width: 820px; max-width: 95vw">
        <q-card-section v-if="examenFiche" class="row items-start q-col-gutter-md">
          <div class="col">
            <div class="text-caption text-grey-7">{{ examenFiche.codeExamen }}</div>
            <div class="text-h6">{{ examenFiche.intitule }}</div>
            <div class="text-caption text-grey-7">
              {{ libelleType(examenFiche.type) }} · {{ examenFiche.matiere?.intitule ?? '—' }} ·
              {{ examenFiche.promotion?.nom ?? '—' }}
            </div>
          </div>
          <div class="col-auto">
            <PastilleStatut domaine="examen" :statut="examenFiche.statut" />
          </div>
          <div class="col-auto">
            <q-btn flat round dense icon="close" :aria-label="$t('examens.sheet.closeAria')" v-close-popup />
          </div>
        </q-card-section>

        <q-card-section v-if="examenFiche" class="q-pt-none">
          <div class="row q-col-gutter-md text-caption">
            <div class="col-6 col-sm-3">
              <div class="text-grey-7">{{ $t('common.fields.date') }}</div>
              <div class="text-weight-medium">{{ dateLisible(examenFiche.dateExamen) }}</div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="text-grey-7">{{ $t('common.fields.schedule') }}</div>
              <div class="text-weight-medium">{{ examenFiche.heureDebut }}–{{ examenFiche.heureFin }}</div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="text-grey-7">{{ $t('common.fields.room') }}</div>
              <div class="text-weight-medium">{{ examenFiche.salle?.code ?? '—' }}</div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="text-grey-7">{{ $t('examens.sheet.presentsOverEnrolled') }}</div>
              <div class="text-weight-medium chiffres">{{ examenFiche.nbPresents }} / {{ examenFiche.nbInscrits }}</div>
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
            @click="allerTirage(examenFiche)"
          />
          <q-btn
            outline
            no-caps
            color="secondary"
            icon="qr_code_scanner"
            :label="$t('examens.actions.scanCards')"
            @click="allerScan(examenFiche)"
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
  </q-page>
</template>

<script setup lang="ts">
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '@/boot/axios';
import { useAuthStore } from '@/stores/auth';
import { pageApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampDate from '@/shared/components/ChampDate.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import DialogueExamen from '../components/DialogueExamen.vue';
import {
  LIBELLE_STATUT_EXAMEN,
  LIBELLE_TYPE_EXAMEN,
  aujourdhui,
  dateLisible,
  dateHeureLisible,
  decalerJours,
} from '@/shared/utils/libelles';
import type { Examen, ScanExamen, StatutExamen, ChipFiltre } from '@/types';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const { confirmer } = useConfirmation();

const modeVue = usePresentationListe();
const dialogOuvert = ref(false);

const dialogFiche = ref(false);
const examenFiche = ref<Examen | null>(null);
const scans = ref<ScanExamen[]>([]);
const chargementScans = ref(false);

/** Le statut est porté par les onglets ; la réinitialisation des filtres le garde. */
const onglet = ref<StatutExamen>('PLANIFIE');

/** Les épreuves planifiées sont devant nous : la fenêtre par défaut regarde en avant. */
function filtresParDefaut() {
  return {
    recherche: '',
    type: null as string | null,
    matiereId: null as string | null,
    promotionId: null as string | null,
    anneeId: null as string | null,
    dateDebut: decalerJours(aujourdhui(), -30),
    dateFin: decalerJours(aujourdhui(), 90),
  };
}

const filtres = ref<Record<string, any>>(filtresParDefaut());

/** La recherche texte n'est pas gérée par `/examens` : elle reste locale. */
const ex = reactive(
  useListePaginee<Examen>({
    filtres,
    syncUrl: true,
    clesLocales: ['recherche'],
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/examens', {
          params: {
            ...pageApi(p),
            statut: onglet.value,
            type: f.type || undefined,
            matiereId: f.matiereId || undefined,
            promotionId: f.promotionId || undefined,
            anneeId: f.anneeId || undefined,
            dateDebut: f.dateDebut || undefined,
            dateFin: f.dateFin || undefined,
          },
        })
        .then((r) => r.data),
  }),
);

const peutCreer = computed(() => auth.peut('examens.creer'));
const peutDemarrer = computed(() => auth.peut('examens.demarrer'));
const peutTerminer = computed(() => auth.peut('examens.terminer'));
const peutAnnuler = computed(() => auth.peut('examens.annuler'));
/** La route `tirage` est réservée à l'administration et à la scolarité. */
const peutVoirTirage = computed(() => auth.peut('tirage.gerer'));

const optionsTypes = (['PARTIEL', 'FINAL', 'RATTRAPAGE', 'CONTROLE_CONTINU'] as const).map((value) => ({
  value,
  label: LIBELLE_TYPE_EXAMEN[value],
}));

const chipsFiltres = computed(() => {
  const chips: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    chips.push({
      label: t('examens.filters.searchChip', { query: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.type) {
    chips.push({
      label: t('examens.filters.typeChip', { type: LIBELLE_TYPE_EXAMEN[filtres.value.type] ?? filtres.value.type }),
      value: filtres.value.type,
      icone: 'category',
    });
  }
  return chips;
});

/**
 * Le statut est filtré côté serveur (onglets) ; la recherche texte, elle,
 * n'est pas gérée par `/examens` : on l'applique sur les lignes chargées pour
 * que le champ ne reste pas décoratif.
 */
const examensFiltres = computed(() => {
  const q = String(filtres.value.recherche ?? '')
    .toLowerCase()
    .trim();
  if (!q) return ex.lignes;
  return ex.lignes.filter((e) =>
    [e.codeExamen, e.intitule, e.matiere?.intitule, e.promotion?.nom]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
});

const messageVide = computed(() =>
  filtres.value.recherche
    ? t('examens.emptyState.noResults')
    : t('examens.emptyState.noneForStatus', { status: libelleStatut(onglet.value).toLowerCase() }),
);

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'codeExamen', label: t('common.fields.code'), field: 'codeExamen', align: 'left', sortable: true },
  { name: 'intitule', label: t('common.fields.intitule'), field: 'intitule', align: 'left' },
  { name: 'type', label: t('common.fields.type'), field: 'type', align: 'left' },
  { name: 'creneau', label: t('examens.table.columns.slot'), field: 'dateExamen', align: 'left', sortable: true },
  {
    name: 'matiere',
    label: t('common.fields.subject'),
    field: (r: Examen) => r.matiere?.intitule ?? '—',
    align: 'left',
  },
  {
    name: 'promotion',
    label: t('examens.table.columns.promotion'),
    field: (r: Examen) => r.promotion?.nom ?? '—',
    align: 'left',
  },
  { name: 'salle', label: t('common.fields.room'), field: (r: Examen) => r.salle?.code ?? '—', align: 'left' },
  { name: 'presence', label: t('examens.table.columns.present'), field: 'nbPresents', align: 'right' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

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

function libelleStatut(s: string) {
  return LIBELLE_STATUT_EXAMEN[s] ?? s;
}

function libelleType(s: string) {
  return LIBELLE_TYPE_EXAMEN[s] ?? s;
}

function reinitialiser() {
  filtres.value = filtresParDefaut();
}

// Changer d'onglet ramène en page 1 (le setter recharge).
watch(onglet, () => {
  ex.page = 1;
});

/** Fiche : infos de l'examen + journal des scans, avec les liens de la chaîne. */
async function ouvrirFiche(e: Examen) {
  examenFiche.value = e;
  dialogFiche.value = true;
  scans.value = [];
  chargementScans.value = true;
  try {
    const { data } = await api.get(`/examens/${e.id}/scans`);
    scans.value = Array.isArray(data) ? data : (data?.data ?? []);
  } catch {
    scans.value = [];
  } finally {
    chargementScans.value = false;
  }
}

/** Examen → tirage : la page Tirage se filtre d'elle-même sur cet examen. */
function allerTirage(e: Examen | null) {
  void router.push({ name: 'tirage', query: e ? { examenId: e.id } : {} });
}

/** Examen → scan : le poste de scan présélectionne l'examen. */
function allerScan(e: Examen | null) {
  void router.push({ name: 'scan-examen', query: e ? { examenId: e.id } : {} });
}

/** Passe l'examen à l'étape suivante, puis montre l'onglet où il se trouve désormais. */
async function changerStatut(
  e: Examen,
  action: 'demarrer' | 'terminer' | 'annuler',
  cible: StatutExamen,
  message: string,
) {
  try {
    // L'annulation passe par `PUT /examens/:id/statut` (PLANIFIE → ANNULE seulement).
    if (action === 'annuler') await api.put(`/examens/${e.id}/statut`, { statut: 'ANNULE' });
    else await api.post(`/examens/${e.id}/${action}`);
  } catch {
    return; /* notifié par l'intercepteur */
  }
  $q.notify({ type: 'positive', message });
  // Le changement d'onglet déclenche lui-même le rechargement.
  if (onglet.value === cible) await ex.recharger();
  else onglet.value = cible;
}

async function demarrer(e: Examen) {
  const ok = await confirmer({
    titre: t('examens.confirm.startTitle'),
    message: t('examens.confirm.startMessage', { code: e.codeExamen, title: e.intitule }),
    ok: t('common.actions.start'),
    couleur: 'positive',
  });
  if (ok) await changerStatut(e, 'demarrer', 'EN_COURS', t('examens.messages.started'));
}

async function terminer(e: Examen) {
  const ok = await confirmer({
    titre: t('examens.confirm.finishTitle'),
    message: t('examens.confirm.finishMessage', { code: e.codeExamen, title: e.intitule }),
    ok: t('examens.confirm.finishAction'),
    danger: true,
  });
  if (ok) await changerStatut(e, 'terminer', 'TERMINE', t('examens.messages.finished'));
}

/** Le backend n'accepte pas de motif : simple confirmation. */
async function annulerExamen(e: Examen) {
  const ok = await confirmer({
    titre: t('examens.confirm.cancelTitle'),
    message: t('examens.confirm.cancelMessage', { code: e.codeExamen, title: e.intitule }),
    ok: t('examens.confirm.cancelAction'),
    danger: true,
  });
  if (ok) await changerStatut(e, 'annuler', 'ANNULE', t('examens.messages.cancelled'));
}
</script>

<style scoped lang="scss">
// La plaque est déjà cernée d'un filet entier : un bandeau latéral en plus
// ferait de la carte une languette, ce que le monde refuse.
.carte-examen {
  cursor: pointer;
  transition: background var(--up-transition);
  &:hover {
    background: var(--up-craie);
  }
}
</style>
