<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('helpdesk.title')" :subtitle="$t('helpdesk.subtitle')">
      <template #actions>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('helpdesk.actions.declareIncident')"
          @click="ouvrirDeclaration()"
        />
        <q-btn
          flat
          no-caps
          icon="qr_code_scanner"
          :label="$t('helpdesk.actions.scanEquipment')"
          @click="scanEquipement = true"
        />
      </template>
    </en-tete-page>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="mes-tickets" icon="assignment_outlined" :label="$t('helpdesk.tabs.myTickets')" no-caps />
      <q-tab v-if="dsi" name="gestion" icon="support_agent" :label="$t('helpdesk.tabs.management')" no-caps />
      <q-tab v-if="dsi" name="equipements" icon="qr_code_2" :label="$t('helpdesk.tabs.equipment')" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- MES TICKETS / DECLARER                                            -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'mes-tickets'" name="mes-tickets" class="q-pa-none q-mt-md">
      <div class="row q-col-gutter-md">
        <div class="col-12">
          <assistance-mes-tickets-panneau :lignes="mes.lignes" :chargement="mes.chargement" :dsi="dsi" />
        </div>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- GESTION DSI                                                       -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="dsi && onglet === 'gestion'" name="gestion" class="q-pa-none q-mt-md">
      <assistance-gestion-panneau
        v-model:filtres="filtres"
        v-model:page="gestion.page"
        v-model:page-size="gestion.pageSize"
        :lignes="gestion.lignes"
        :chargement="gestion.chargement"
        :total="gestion.total"
        :stats="stats"
        @changer-statut="changerStatut"
        @voir-ticket="(t) => (ticketDetail = t)"
        @reinitialiser="gestion.reinitialiser([])"
      />
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- EQUIPEMENTS & QR                                                  -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="dsi && onglet === 'equipements'" name="equipements" class="q-pa-none q-mt-md">
      <assistance-equipements-panneau
        v-model:filtres="filtresEquip"
        :lignes="equip.lignes"
        :chargement="equip.chargement"
        :est-admin="auth.estAdmin"
        @creer="ouvrirEquipement(null)"
        @modifier="ouvrirEquipement"
        @supprimer="supprimerEquipement"
        @reinitialiser="equip.reinitialiser([])"
      />
    </q-tab-panel>

    <!-- Détail d'un ticket -->
    <assistance-ticket-dialogue :ticket="ticketDetail" @update:model-value="ticketDetail = null" />

    <dialogue-ticket
      v-model="declarerOuvert"
      :equipement="equipementScanne"
      :equipements="equip.lignes"
      :categorie-initiale="categorieInitiale"
      @enregistre="onDeclare"
    />
    <dialogue-equipement
      v-model="equipementDialogOuvert"
      :equipement="equipementEdite"
      @enregistre="equip.recharger()"
    />

    <!-- Scanner QR -->
    <q-dialog v-model="scanEquipement">
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section class="text-h6">{{ $t('helpdesk.scanDialog.title') }}</q-card-section>
        <q-card-section>
          <lecteur-qr
            v-model="codeScanne"
            :label="$t('helpdesk.scanDialog.label')"
            :hint="$t('helpdesk.scanDialog.hint')"
          />
          <p class="text-caption text-grey-7 q-mt-md">
            {{ $t('helpdesk.scanDialog.instructions') }}
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('common.actions.cancel')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
/**
 * Assistance : le helpdesk de l'université — mes tickets, le traitement par
 * la DSI et le parc d'équipements à codes QR.
 *
 * La page garde l'état partagé (les trois listes, les statistiques, les
 * dialogues) ; chaque onglet est un composant qui présente ses lignes et rend
 * les actions.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import LecteurQr from '@/shared/components/LecteurQr.vue';
import { pageApi, texteApi, useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import { LIBELLE_STATUT_TICKET } from '@/shared/utils/libelles';
import { equipementsService, ticketsService } from '../services/assistance';
import DialogueTicket from '../components/DialogueTicket.vue';
import DialogueEquipement from '../components/DialogueEquipement.vue';
import AssistanceMesTicketsPanneau from '../components/AssistanceMesTicketsPanneau.vue';
import AssistanceGestionPanneau from '../components/AssistanceGestionPanneau.vue';
import AssistanceEquipementsPanneau from '../components/AssistanceEquipementsPanneau.vue';
import AssistanceTicketDialogue from '../components/AssistanceTicketDialogue.vue';
import type { CategorieIncident, EquipementCampus, StatutTicket, TicketSupport } from '@/types';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const { confirmer } = useConfirmation();

const dsi = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));

const onglet = ref('mes-tickets');
const stats = ref<Record<string, number> | null>(null);

const declarerOuvert = ref(false);
const categorieInitiale = ref<CategorieIncident | ''>('');
const equipementScanne = ref<EquipementCampus | null>(null);
const ticketDetail = ref<TicketSupport | null>(null);
const equipementDialogOuvert = ref(false);
const equipementEdite = ref<EquipementCampus | null>(null);

const scanEquipement = ref(false);
const codeScanne = ref('');

// ------------------------------------------------------------------ listes
/** Mes tickets (ou tous pour la DSI) : liste entière, paginée par le q-table. */
const mes = reactive(
  useListePaginee<TicketSupport>({
    filtres: ref({}),
    pageSize: 0,
    charger: () => ticketsService.liste({ all: '1' }),
  }),
);

const filtres = ref<Record<string, any>>({
  recherche: '',
  statut: null,
  categorie: null,
  priorite: null,
  equipementId: null,
});
/** Gestion DSI : paginée côté serveur, filtres gardés dans l'URL. */
const gestion = reactive(
  useListePaginee<TicketSupport>({
    filtres,
    syncUrl: true,
    actif: () => dsi.value,
    charger: ({ filtres: f, ...p }) =>
      ticketsService.liste({
        ...pageApi(p),
        statut: f.statut || undefined,
        categorie: f.categorie || undefined,
        priorite: f.priorite || undefined,
        equipementId: f.equipementId || undefined,
        search: texteApi(f.recherche),
      }),
  }),
);

const filtresEquip = ref<Record<string, any>>({ recherche: '', actif: null });
/** Parc d'équipements : l'API filtre mais ne pagine pas. */
const equip = reactive(
  useListePaginee<EquipementCampus>({
    filtres: filtresEquip,
    pageSize: 0,
    syncUrl: true,
    prefixeUrl: 'eq_',
    charger: ({ filtres: f }) =>
      equipementsService.liste({ all: '1', search: texteApi(f.recherche), actif: f.actif || undefined }),
  }),
);

// ----------------------------------------------------------------- actions
function ouvrirDeclaration(cat?: CategorieIncident) {
  categorieInitiale.value = (cat ?? '') as CategorieIncident | '';
  declarerOuvert.value = true;
}

function onDeclare() {
  categorieInitiale.value = '';
  void mes.recharger();
  if (dsi.value) {
    void gestion.recharger();
    void chargerStats();
  }
}

async function chargerStats() {
  if (!dsi.value) return;
  const data = await ticketsService.stats();
  stats.value = data as Record<string, number>;
}

async function changerStatut(ticket: TicketSupport, statut: StatutTicket) {
  try {
    await ticketsService.changerStatut(ticket.id, statut);
    $q.notify({
      type: 'positive',
      message: t('helpdesk.messages.ticketStatusChanged', {
        numero: ticket.numero,
        statut: (LIBELLE_STATUT_TICKET[statut] ?? statut).toLowerCase(),
      }),
    });
    await Promise.all([mes.recharger(), gestion.recharger(), chargerStats()]);
  } catch {
    /* le boot axios affiche déjà le motif */
  }
}

function ouvrirEquipement(e: EquipementCampus | null) {
  equipementEdite.value = e;
  equipementDialogOuvert.value = true;
}

async function supprimerEquipement(e: EquipementCampus) {
  const ok = await confirmer({
    titre: t('helpdesk.deleteEquipmentDialog.title'),
    message: t('helpdesk.deleteEquipmentDialog.message', { libelle: e.libelle }),
    ok: t('common.actions.yes_delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await equipementsService.supprimer(e.id);
  } catch {
    /* l'intercepteur axios affiche le motif */
    return;
  }
  $q.notify({ type: 'positive', message: t('helpdesk.messages.equipmentDeleted') });
  await equip.recharger();
}

// --------------------------------------------------------------- scan QR
async function resoudreScanCode(brut: string) {
  if (!brut) return;
  try {
    const data = await equipementsService.parCode(brut);
    equipementScanne.value = data;
    declarerOuvert.value = true;
    $q.notify({ type: 'info', message: t('helpdesk.messages.equipmentRecognized', { libelle: data.libelle }) });
  } catch {
    /* code inconnu ou équipement désactivé : la page reste utilisable */
  }
}

watch(codeScanne, (v) => {
  if (v) {
    scanEquipement.value = false;
    void resoudreScanCode(v);
    codeScanne.value = '';
  }
});

onMounted(() => {
  void chargerStats();
  void resoudreScanCode(String(route.query.equipement ?? route.query.code ?? '').trim());
});
</script>
