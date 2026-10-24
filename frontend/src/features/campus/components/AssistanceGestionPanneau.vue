<template>
  <div>
    <div class="resume-liste" role="status">
      <span v-for="s in statutPlaques" :key="s.cle"
        >{{ s.libelle }} : <strong>{{ stats?.[s.cle] ?? 0 }}</strong></span
      >
    </div>
    <q-banner class="note--info q-mb-md">
      <i18n-t keypath="helpdesk.stats.resolutionRate" tag="span">
        <template #taux
          ><strong>{{ stats?.tauxResolution24h ?? 0 }} %</strong></template
        >
        <template #resolus>{{ $t('helpdesk.stats.resolvedCount', stats?.resolus24h ?? 0) }}</template>
      </i18n-t>
    </q-banner>

    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('helpdesk.filters.searchTickets')"
      @reinitialiser="emit('reinitialiser')"
    >
      <template #principaux>
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('common.fields.status')"
        />
      </template>
      <template #avances>
        <q-select
          v-model="filtres.categorie"
          :options="optionsCategories"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('common.fields.category')"
        />
        <q-select
          v-model="filtres.priorite"
          :options="optionsPriorites"
          dense
          outlined
          clearable
          emit-value
          map-options
          :label="$t('common.fields.priority')"
        />
        <champ-recherche
          v-model="filtres.equipementId"
          endpoint="/equipements"
          :label-fn="(e) => `${e.libelle}${e.emplacement ? ' — ' + e.emplacement : ''}`"
          :label="$t('helpdesk.filters.equipment')"
        />
      </template>
    </barre-filtres>

    <barre-pagination v-model:page="page" v-model:page-size="pageSize" :total="total" :show-all="false" />

    <q-table
      v-if="presentation === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="lignes"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      :hide-bottom="chargement || lignes.length > 0"
    >
      <template #body-cell-priorite="p">
        <q-td :props="p">
          <span class="ticket-champ" :class="`prio-champ--${p.row.priorite}`">
            <span class="pochoir">{{ libellePriorite(p.row.priorite) }}</span>
          </span>
        </q-td>
      </template>
      <template #body-cell-statut="p">
        <q-td :props="p">
          <PastilleStatut domaine="ticket" :statut="p.row.statut" />
        </q-td>
      </template>
      <template #no-data>
        <etat-vide
          icone="support_agent"
          :titre="$t('helpdesk.gestionTable.emptyTitle')"
          :aide="$t('helpdesk.gestionTable.emptyHint')"
        />
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            :aria-label="$t('helpdesk.gestionTable.viewTicket')"
            @click="emit('voirTicket', p.row)"
          >
            <q-tooltip>{{ $t('helpdesk.gestionTable.viewTicketTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.statut === 'OUVERT' || p.row.statut === 'EN_COURS'"
            flat
            dense
            round
            icon="autorenew"
            :aria-label="$t('helpdesk.gestionTable.changeStatus')"
          >
            <q-tooltip>{{ $t('helpdesk.gestionTable.changeStatusTooltip') }}</q-tooltip>
            <q-menu>
              <q-list dense style="min-width: 220px">
                <q-item clickable v-close-popup @click="emit('changerStatut', p.row, 'EN_COURS')">
                  <q-item-section avatar><q-icon name="handyman" size="18px" /></q-item-section>
                  <q-item-section>{{ $t('helpdesk.gestionTable.statutMenu.enCours') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="emit('changerStatut', p.row, 'RESOLU')">
                  <q-item-section avatar><q-icon name="check_circle" size="18px" color="positive" /></q-item-section>
                  <q-item-section>{{ $t('helpdesk.gestionTable.statutMenu.resolu') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="emit('changerStatut', p.row, 'CLOTURE')">
                  <q-item-section avatar><q-icon name="archive" size="18px" /></q-item-section>
                  <q-item-section>{{ $t('common.actions.closeOut') }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <div v-else class="row q-col-gutter-md">
      <div v-for="t in lignes" :key="t.id" class="col-12 col-md-6 col-xl-4">
        <q-card flat bordered class="carte">
          <q-card-section class="row items-center q-pb-none">
            <div class="col">
              <div class="text-uppercase text-caption text-grey-7">{{ t.numero }}</div>
              <div class="text-subtitle1 text-weight-medium">
                {{ libelleCategorie(t.categorie) }}
              </div>
            </div>
            <div class="column items-end q-gutter-xs">
              <PastilleStatut domaine="ticket" :statut="t.statut" />
              <span class="ticket-champ" :class="`prio-champ--${t.priorite}`">
                <span class="pochoir">{{ libellePriorite(t.priorite) }}</span>
              </span>
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none q-gutter-y-xs">
            <div v-if="t.equipement" class="row items-center">
              <q-icon name="devices" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">
                {{ t.equipement.libelle }}
                <span v-if="t.equipement.emplacement" class="text-grey-7"
                  >{{ $t('common.format.emptyValue') }} {{ t.equipement.emplacement }}</span
                >
              </span>
            </div>
            <div v-if="t.utilisateur || t.declarantNom" class="row items-center">
              <q-icon name="person" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">
                {{ t.utilisateur ? `${t.utilisateur.prenom} ${t.utilisateur.nom}` : (t.declarantNom ?? '—') }}
              </span>
            </div>
            <div class="row items-center">
              <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
              <span class="text-caption">{{ dateHeureLisible(t.createdAt) }}</span>
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions class="q-px-md">
            <q-btn
              flat
              dense
              no-caps
              icon="visibility"
              :label="$t('common.actions.detail')"
              @click="emit('voirTicket', t)"
            />
            <q-space />
            <q-btn
              v-if="t.statut === 'OUVERT' || t.statut === 'EN_COURS'"
              flat
              dense
              no-caps
              color="primary"
              icon="forward"
              :label="$t('common.fields.status')"
            >
              <q-menu>
                <q-list dense style="min-width: 200px">
                  <q-item clickable v-close-popup @click="emit('changerStatut', t, 'EN_COURS')">
                    <q-item-section>{{ $t('helpdesk.gestionTable.cardMenu.enCours') }}</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="emit('changerStatut', t, 'RESOLU')">
                    <q-item-section>{{ $t('helpdesk.gestionTable.cardMenu.resolu') }}</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="emit('changerStatut', t, 'CLOTURE')">
                    <q-item-section>{{ $t('common.actions.closeOut') }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!chargement && !lignes.length"
        class="col-12"
        icone="support_agent"
        :titre="$t('helpdesk.gestionTable.emptyTitle')"
        :aide="$t('helpdesk.gestionTable.emptyHintShort')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet « Gestion » de l'assistance : le traitement des tickets par la DSI,
 * ses filtres et le changement de statut.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QTableColumn } from 'quasar';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { dateHeureLisible } from '@/shared/utils/format';
import { LIBELLE_CATEGORIE_INCIDENT, LIBELLE_PRIORITE_TICKET, LIBELLE_STATUT_TICKET } from '@/shared/utils/libelles';
import type { ChipFiltre, StatutTicket, TicketSupport, FiltresPage } from '@/types';

defineProps<{
  lignes: TicketSupport[];
  chargement: boolean;
  total: number;
  /** Compteurs du tableau de bord (DSI). */
  stats: Record<string, number> | null;
}>();

/** Filtres du panneau : la page les garde (et les inscrit dans l'URL). */
const filtres = defineModel<FiltresPage>('filtres', { required: true });
/** Pagination : la page garde l'état, pour rester synchronisée avec l'URL. */
const page = defineModel<number>('page', { required: true });
const pageSize = defineModel<number>('pageSize', { required: true });

const emit = defineEmits<{
  changerStatut: [ticket: TicketSupport, statut: StatutTicket];
  voirTicket: [ticket: TicketSupport];
  reinitialiser: [];
}>();

const { t } = useI18n();
const presentation = usePresentationListe();

const libelleStatut = (s: string) => LIBELLE_STATUT_TICKET[s] ?? s;
const libellePriorite = (p: string) => LIBELLE_PRIORITE_TICKET[p] ?? p;
const libelleCategorie = (c: string) => LIBELLE_CATEGORIE_INCIDENT[c] ?? c;
const nomCourt = (u: { nom?: string; prenom?: string } | null | undefined) =>
  `${u?.prenom ?? ''} ${u?.nom ?? ''}`.trim() || '—';

const optionsStatuts = (Object.keys(LIBELLE_STATUT_TICKET) as StatutTicket[]).map((v) => ({
  label: LIBELLE_STATUT_TICKET[v],
  value: v,
}));
const optionsCategories = Object.entries(LIBELLE_CATEGORIE_INCIDENT).map(([value, label]) => ({ label, value }));
const optionsPriorites = Object.entries(LIBELLE_PRIORITE_TICKET).map(([value, label]) => ({ label, value }));

const statutPlaques = computed(() =>
  (['OUVERT', 'EN_COURS', 'RESOLU', 'CLOTURE'] as const).map((cle) => ({
    cle,
    libelle: t(`helpdesk.stats.labels.${cle}`),
  })),
);

const chips = computed<ChipFiltre[]>(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = f.recherche
    ? [{ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true }]
    : [];
  if (f.statut) cs.push({ label: libelleStatut(f.statut), value: f.statut, icone: 'flag', cle: 'statut' });
  if (f.categorie)
    cs.push({ label: libelleCategorie(f.categorie), value: f.categorie, icone: 'category', cle: 'categorie' });
  if (f.priorite)
    cs.push({ label: libellePriorite(f.priorite), value: f.priorite, icone: 'priority_high', cle: 'priorite' });
  if (f.equipementId) {
    cs.push({
      label: t('helpdesk.filters.equipmentFiltered'),
      value: f.equipementId,
      icone: 'devices',
      cle: 'equipementId',
    });
  }
  return cs;
});

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'numero', label: t('common.fields.numberShort'), field: 'numero', align: 'left', sortable: true },
  {
    name: 'categorie',
    label: t('common.fields.category'),
    field: (r: TicketSupport) => libelleCategorie(r.categorie),
    align: 'left',
  },
  {
    name: 'equipement',
    label: t('helpdesk.table.columns.equipment'),
    field: (r: TicketSupport) => r.equipement?.libelle ?? '—',
    align: 'left',
  },
  {
    name: 'declarant',
    label: t('helpdesk.table.columns.declarant'),
    field: (r: TicketSupport) => nomCourt(r.utilisateur ?? null) || (r.declarantNom ?? '—'),
    align: 'left',
  },
  { name: 'priorite', label: t('common.fields.priority'), field: 'priorite', align: 'left' },
  { name: 'statut', label: t('common.fields.status'), field: 'statut', align: 'left' },
  {
    name: 'createdAt',
    label: t('common.fields.date'),
    field: (r: TicketSupport) => dateHeureLisible(r.createdAt),
    align: 'left',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);
</script>

<style scoped lang="scss">
.ticket-champ {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: var(--up-encre);
  border-radius: var(--up-rayon-sm);

  &.prio-champ--BASSE {
    background: var(--up-gris-inerte);
    color: var(--up-encre);
    border: var(--up-filet);
    box-shadow: none;
  }
  &.prio-champ--NORMALE {
    background: $jaune-fond;
    color: $jaune-texte;
  }
  &.prio-champ--HAUTE {
    background: $rouge-fond;
    color: #{$rouge};
  }
}
</style>
