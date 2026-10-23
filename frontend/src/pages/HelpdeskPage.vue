<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('helpdesk.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('helpdesk.subtitle') }}
        </div>
      </div>
      <div class="col-auto">
        <q-btn unelevated color="primary" no-caps icon="add" :label="$t('helpdesk.actions.declareIncident')" @click="ouvrirDeclaration()" />
        <q-btn flat no-caps icon="qr_code_scanner" :label="$t('helpdesk.actions.scanEquipment')" @click="scanEquipement = true" />
      </div>
    </div>

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
          <q-table
            flat
            bordered
            class="carte"
            :rows="mes.lignes"
            :columns="colonnesMes"
            row-key="id"
            :loading="mes.chargement"
            :pagination="{ rowsPerPage: 10 }"
          >
            <template #top-left>
              <div class="text-subtitle1 text-weight-medium">
                {{ dsi ? $t('helpdesk.myTicketsTable.titleAll') : $t('helpdesk.myTicketsTable.titleMine') }}
              </div>
            </template>
            <template #no-data>
              <etat-vide
                icone="assignment_turned_in"
                :titre="dsi ? $t('helpdesk.myTicketsTable.emptyAll') : $t('helpdesk.myTicketsTable.emptyMine')"
                :aide="$t('helpdesk.myTicketsTable.emptyHint')"
              />
            </template>
            <template #body-cell-statut="p">
              <q-td :props="p">
                <span class="ticket-champ" :class="`ticket-champ--${p.row.statut}`">
                  <span class="pochoir">{{ libelleStatut(p.row.statut) }}</span>
                </span>
              </q-td>
            </template>
            <template #body-cell-priorite="p">
              <q-td :props="p">
                <span class="ticket-champ" :class="`prio-champ--${p.row.priorite}`">
                  <span class="pochoir">{{ libellePriorite(p.row.priorite) }}</span>
                </span>
              </q-td>
            </template>
          </q-table>
        </div>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- GESTION DSI                                                       -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="dsi && onglet === 'gestion'" name="gestion" class="q-pa-none q-mt-md">
      <div class="resume-liste" role="status">
        <span v-for="s in statutPlaques" :key="s.cle">{{ s.libelle }} : <strong>{{ stats?.[s.cle] ?? 0 }}</strong></span>
      </div>
      <q-banner v-if="dsi" class="note--info q-mb-md">
        <i18n-t keypath="helpdesk.stats.resolutionRate" tag="span">
          <template #taux><strong>{{ stats?.tauxResolution24h ?? 0 }} %</strong></template>
          <template #resolus>{{ $t('helpdesk.stats.resolvedCount', stats?.resolus24h ?? 0) }}</template>
        </i18n-t>
      </q-banner>

      <filter-bar
        v-model="filtres"
        :chips="chipsTickets"
        :placeholder="$t('helpdesk.filters.searchTickets')"
        @reinitialiser="gestion.reinitialiser([])"
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
            :label="$t('helpdesk.filters.status')"
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
            :label="$t('helpdesk.filters.category')"
          />
          <q-select
            v-model="filtres.priorite"
            :options="optionsPriorites"
            dense
            outlined
            clearable
            emit-value
            map-options
            :label="$t('helpdesk.filters.priority')"
          />
          <autocomplete-async
            v-model="filtres.equipementId"
            endpoint="/equipements"
            :label-fn="(e) => `${e.libelle}${e.emplacement ? ' — ' + e.emplacement : ''}`"
            :label="$t('helpdesk.filters.equipment')"
          />
        </template>
      </filter-bar>

      <pagination-bar
        v-model:page="gestion.page"
        v-model:page-size="gestion.pageSize"
        :total="gestion.total"
        :show-all="false"
      />

      <q-table
        v-if="presentation === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="gestion.lignes"
        :columns="colonnesGestion"
        row-key="id"
        :loading="gestion.chargement"
        :rows-per-page-options="[0]"
        :hide-bottom="gestion.chargement || gestion.lignes.length > 0"
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
            <span class="ticket-champ" :class="`ticket-champ--${p.row.statut}`">
              <span class="pochoir">{{ libelleStatut(p.row.statut) }}</span>
            </span>
          </q-td>
        </template>
        <template #no-data>
          <etat-vide icone="support_agent" :titre="$t('helpdesk.gestionTable.emptyTitle')" :aide="$t('helpdesk.gestionTable.emptyHint')" />
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn flat dense round icon="visibility" :aria-label="$t('helpdesk.gestionTable.viewTicket')" @click="ticketDetail = p.row">
              <q-tooltip>{{ $t('helpdesk.gestionTable.viewTicketTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="p.row.statut === 'OUVERT' || p.row.statut === 'EN_COURS'"
              flat dense round icon="autorenew"
              :aria-label="$t('helpdesk.gestionTable.changeStatus')"
            >
              <q-tooltip>{{ $t('helpdesk.gestionTable.changeStatusTooltip') }}</q-tooltip>
              <q-menu>
                <q-list dense style="min-width: 220px">
                  <q-item clickable v-close-popup @click="changerStatut(p.row, 'EN_COURS')">
                    <q-item-section avatar><q-icon name="handyman" size="18px" /></q-item-section>
                    <q-item-section>{{ $t('helpdesk.gestionTable.statutMenu.enCours') }}</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="changerStatut(p.row, 'RESOLU')">
                    <q-item-section avatar><q-icon name="check_circle" size="18px" color="positive" /></q-item-section>
                    <q-item-section>{{ $t('helpdesk.gestionTable.statutMenu.resolu') }}</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="changerStatut(p.row, 'CLOTURE')">
                    <q-item-section avatar><q-icon name="archive" size="18px" /></q-item-section>
                    <q-item-section>{{ $t('helpdesk.gestionTable.statutMenu.cloturer') }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </q-td>
        </template>
      </q-table>

      <div v-else class="row q-col-gutter-md">
        <div v-for="t in gestion.lignes" :key="t.id" class="col-12 col-md-6 col-xl-4">
          <q-card flat bordered class="carte">
            <q-card-section class="row items-center q-pb-none">
              <div class="col">
                <div class="text-uppercase text-caption text-grey-7">{{ t.numero }}</div>
                <div class="text-subtitle1 text-weight-medium">
                  {{ libelleCategorie(t.categorie) }}
                </div>
              </div>
              <div class="column items-end q-gutter-xs">
                <span class="ticket-champ" :class="`ticket-champ--${t.statut}`">
                  <span class="pochoir">{{ libelleStatut(t.statut) }}</span>
                </span>
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
                  <span v-if="t.equipement.emplacement" class="text-grey-7">{{ $t('rectorat.subtitleFallback') }} {{ t.equipement.emplacement }}</span>
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
              <q-btn flat dense no-caps icon="visibility" :label="$t('helpdesk.gestionTable.detail')" @click="ticketDetail = t" />
              <q-space />
              <q-btn
                v-if="t.statut === 'OUVERT' || t.statut === 'EN_COURS'"
                flat dense no-caps color="primary" icon="forward" :label="$t('helpdesk.gestionTable.statutButton')"
              >
                <q-menu>
                  <q-list dense style="min-width: 200px">
                    <q-item clickable v-close-popup @click="changerStatut(t, 'EN_COURS')">
                      <q-item-section>{{ $t('helpdesk.gestionTable.cardMenu.enCours') }}</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="changerStatut(t, 'RESOLU')">
                      <q-item-section>{{ $t('helpdesk.gestionTable.cardMenu.resolu') }}</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="changerStatut(t, 'CLOTURE')">
                      <q-item-section>{{ $t('helpdesk.gestionTable.cardMenu.cloturer') }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </q-card-actions>
          </q-card>
        </div>
        <etat-vide
          v-if="!gestion.chargement && !gestion.lignes.length"
          class="col-12"
          icone="support_agent"
          :titre="$t('helpdesk.gestionTable.emptyTitle')"
          :aide="$t('helpdesk.gestionTable.emptyHintShort')"
        />
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- EQUIPEMENTS & QR                                                  -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="dsi && onglet === 'equipements'" name="equipements" class="q-pa-none q-mt-md">
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="page-sous-titre">
            {{ $t('helpdesk.equipmentTab.subtitle') }}
          </div>
        </div>
        <div class="col-auto">
          <q-btn unelevated color="primary" no-caps icon="add" :label="$t('helpdesk.actions.newEquipment')" @click="ouvrirEquipement(null)" />
        </div>
      </div>

      <filter-bar
        v-model="filtresEquip"
        :chips="chipsEquipements"
        :placeholder="$t('helpdesk.filters.searchEquipment')"
        @reinitialiser="equip.reinitialiser([])"
      >
        <template #avances>
          <q-select
            v-model="filtresEquip.actif"
            :options="[
              { label: $t('helpdesk.filters.stateAll'), value: null },
              { label: $t('helpdesk.filters.stateActive'), value: 'true' },
              { label: $t('helpdesk.filters.stateInactive'), value: 'false' },
            ]"
            dense
            outlined
            emit-value
            map-options
            :label="$t('helpdesk.filters.state')"
          />
        </template>
      </filter-bar>

      <q-table
        v-if="presentation === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="equip.lignes"
        :columns="colonnesEquipements"
        row-key="id"
        :loading="equip.chargement"
        :pagination="{ rowsPerPage: 20 }"
      >
        <template #body-cell-actif="p">
          <q-td :props="p">
            <q-badge :color="p.row.actif ? 'positive' : 'grey-7'">
              {{ p.row.actif ? $t('helpdesk.equipmentTab.active') : $t('helpdesk.equipmentTab.inactive') }}
            </q-badge>
          </q-td>
        </template>
        <template #body-cell-codeQr="p">
          <q-td :props="p">
            <span class="text-caption ellipsis" style="max-width: 200px; display: inline-block; vertical-align: middle">
              {{ p.row.codeQr }}
            </span>
            <q-btn flat dense round size="sm" icon="content_copy" :aria-label="$t('helpdesk.equipmentTab.copyCode')" @click="copier(p.row.codeQr)">
              <q-tooltip>{{ $t('helpdesk.equipmentTab.copyCodeTooltip') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn flat dense round icon="print" :aria-label="$t('helpdesk.equipmentTab.printLabel')" @click="imprimerQr(p.row)">
              <q-tooltip>{{ $t('helpdesk.equipmentTab.printLabel') }}</q-tooltip>
            </q-btn>
            <q-btn flat dense round icon="edit" :aria-label="$t('helpdesk.equipmentTab.editEquipment')" @click="ouvrirEquipement(p.row)">
              <q-tooltip>{{ $t('helpdesk.actions.edit') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="auth.estAdmin" flat dense round color="negative" icon="delete" :aria-label="$t('helpdesk.equipmentTab.deleteEquipment')" @click="supprimerEquipement(p.row)">
              <q-tooltip>{{ $t('helpdesk.actions.delete') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <etat-vide icone="qr_code_2" :titre="$t('helpdesk.equipmentTab.emptyTitle')" :aide="$t('helpdesk.equipmentTab.emptyHint')">
            <template #action>
              <q-btn flat no-caps color="primary" icon="add" :label="$t('helpdesk.actions.newEquipment')" @click="ouvrirEquipement(null)" />
            </template>
          </etat-vide>
        </template>
      </q-table>

      <div v-else class="row q-col-gutter-md">
        <div v-for="e in equip.lignes" :key="e.id" class="col-12 col-md-6 col-xl-4">
          <q-card flat bordered class="carte">
            <q-card-section class="row items-center q-pb-none">
              <div class="col">
                <div class="text-uppercase text-caption text-grey-7">{{ e.codeQr }}</div>
                <div class="text-subtitle1 text-weight-medium">{{ e.libelle }}</div>
                <div v-if="e.emplacement" class="text-caption text-grey-7">{{ e.emplacement }}</div>
              </div>
              <q-badge :color="e.actif ? 'positive' : 'grey-7'">
                {{ e.actif ? $t('helpdesk.equipmentTab.activeCapitalized') : $t('helpdesk.equipmentTab.inactiveCapitalized') }}
              </q-badge>
            </q-card-section>
            <q-card-section class="text-center">
              <!-- Le rendu QR se fait via le fallback querySelectorAll() dans dessinerTousLesQr() -->
              <canvas
                :data-equipement="e.id"
                class="qr-canvas"
                style="width: 160px; height: 160px"
                :aria-label="$t('helpdesk.equipmentTab.qrAriaLabel', { libelle: e.libelle })"
                role="img"
              />
              <div class="text-caption text-grey-7 q-mt-xs">
                {{ $t('helpdesk.gestionTable.ticketsCount', { count: e._count?.tickets ?? 0 }) }}
              </div>
            </q-card-section>
            <q-card-actions class="q-px-md">
              <q-btn flat dense no-caps icon="print" :label="$t('helpdesk.actions.print')" @click="imprimerQr(e)" />
              <q-space />
              <q-btn flat dense no-caps icon="edit" :label="$t('helpdesk.actions.edit')" @click="ouvrirEquipement(e)" />
            </q-card-actions>
          </q-card>
        </div>
        <etat-vide v-if="!equip.chargement && !equip.lignes.length" class="col-12" icone="qr_code_2" :titre="$t('helpdesk.equipmentTab.emptyTitle')">
          <template #action>
            <q-btn flat no-caps color="primary" icon="add" :label="$t('helpdesk.actions.newEquipment')" @click="ouvrirEquipement(null)" />
          </template>
        </etat-vide>
      </div>
    </q-tab-panel>

    <!-- Détail d'un ticket -->
    <q-dialog :model-value="!!ticketDetail" @update:model-value="ticketDetail = null">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section v-if="ticketDetail" class="text-h6">
          {{ $t('helpdesk.ticketDetailDialog.title', { numero: ticketDetail.numero }) }}
        </q-card-section>
        <q-card-section v-if="ticketDetail" class="q-gutter-md">
          <div class="row q-gutter-x-md items-center">
            <span class="ticket-champ" :class="`ticket-champ--${ticketDetail.statut}`">
              <span class="pochoir">{{ libelleStatut(ticketDetail.statut) }}</span>
            </span>
            <span class="ticket-champ" :class="`prio-champ--${ticketDetail.priorite}`">
              <span class="pochoir">{{ libellePriorite(ticketDetail.priorite) }}</span>
            </span>
            <span class="text-caption text-grey-7">{{ dateHeureLisible(ticketDetail.createdAt) }}</span>
          </div>

          <div>
            <span class="section-titre">{{ $t('helpdesk.ticketDetailDialog.signalement') }}</span>
            <div class="text-body1">{{ libelleCategorie(ticketDetail.categorie) }}</div>
            <div class="q-mt-sm" style="white-space: pre-wrap">{{ ticketDetail.description }}</div>
          </div>

          <div class="row q-col-gutter-md">
            <div class="col-6">
              <span class="section-titre">{{ $t('helpdesk.ticketDetailDialog.equipment') }}</span>
              <div>{{ ticketDetail.equipement?.libelle ?? '—' }}</div>
              <div class="text-caption text-grey-7">{{ ticketDetail.equipement?.emplacement ?? '' }}</div>
            </div>
            <div class="col-6">
              <span class="section-titre">{{ $t('helpdesk.ticketDetailDialog.declarant') }}</span>
              <div>
                {{
                  ticketDetail.utilisateur
                    ? `${ticketDetail.utilisateur.prenom} ${ticketDetail.utilisateur.nom}`
                    : (ticketDetail.declarantNom ?? '—')
                }}
              </div>
            </div>
          </div>

          <div>
            <span class="section-titre">{{ $t('helpdesk.ticketDetailDialog.history') }}</span>
            <q-list dense>
              <q-item>
                <q-item-section avatar><q-icon name="radio_button_unchecked" size="18px" /></q-item-section>
                <q-item-section>
                  <q-item-label class="pochoir">{{ $t('helpdesk.ticketDetailDialog.opened') }}</q-item-label>
                  <q-item-label caption>{{ dateHeureLisible(ticketDetail.createdAt) }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="ticketDetail.traiteLe">
                <q-item-section avatar>
                  <q-icon name="handyman" size="18px" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="pochoir">
                    {{ ticketDetail.statut === 'EN_COURS' ? $t('helpdesk.ticketDetailDialog.inProgress') : $t('helpdesk.ticketDetailDialog.resolved') }}
                  </q-item-label>
                  <q-item-label caption>
                    {{ dateHeureLisible(ticketDetail.traiteLe) }} · {{ nomCourt(ticketDetail.traitePar) }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="ticketDetail.clicheLe">
                <q-item-section avatar><q-icon name="archive" size="18px" /></q-item-section>
                <q-item-section>
                  <q-item-label class="pochoir">{{ $t('helpdesk.ticketDetailDialog.closed') }}</q-item-label>
                  <q-item-label caption>{{ dateHeureLisible(ticketDetail.clicheLe) }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('helpdesk.actions.close')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <ticket-dialog
      v-model="declarerOuvert"
      :equipement="equipementScanne"
      :equipements="equip.lignes"
      :categorie-initiale="categorieInitiale"
      @enregistre="onDeclare"
    />
    <equipement-dialog v-model="equipementDialogOuvert" :equipement="equipementEdite" @enregistre="equip.recharger()" />

    <!-- Scanner QR -->
    <q-dialog v-model="scanEquipement">
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section class="text-h6">{{ $t('helpdesk.scanDialog.title') }}</q-card-section>
        <q-card-section>
          <qr-scanner
            v-model="codeScanne"
            :label="$t('helpdesk.scanDialog.label')"
            :hint="$t('helpdesk.scanDialog.hint')"
          />
          <p class="text-caption text-grey-7 q-mt-md">
            {{ $t('helpdesk.scanDialog.instructions') }}
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('helpdesk.actions.cancel')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '../composables/presentationListe';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import QrScanner from '../components/QrScanner.vue';
import TicketDialog from '../components/TicketDialog.vue';
import EquipementDialog from '../components/EquipementDialog.vue';
import EtatVide from '../components/EtatVide.vue';
import {
  LIBELLE_CATEGORIE_INCIDENT,
  LIBELLE_PRIORITE_TICKET,
  LIBELLE_STATUT_TICKET,
  dateHeureLisible,
} from '../utils/libelles';
import type { CategorieIncident, EquipementCampus, StatutTicket, TicketSupport, ChipFiltre } from '../types';
import { ouvrirImpression } from '../services/impression';

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { supprimerAvecConfirmation } = useConfirmation();

const dsi = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const presentation = usePresentationListe();

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
    charger: () => api.get('/tickets', { params: { all: '1' } }).then((r) => r.data),
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
      api
        .get('/tickets', {
          params: {
            ...pageApi(p),
            statut: f.statut || undefined,
            categorie: f.categorie || undefined,
            priorite: f.priorite || undefined,
            equipementId: f.equipementId || undefined,
            search: texteApi(f.recherche),
          },
        })
        .then((r) => r.data),
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
      api
        .get('/equipements', {
          params: { all: '1', search: texteApi(f.recherche), actif: f.actif || undefined },
        })
        .then((r) => r.data),
  }),
);

// ----------------------------------------------------------------- filtres
const optionsStatuts = (Object.keys(LIBELLE_STATUT_TICKET) as StatutTicket[]).map((v) => ({
  label: LIBELLE_STATUT_TICKET[v],
  value: v,
}));
const optionsCategories = Object.entries(LIBELLE_CATEGORIE_INCIDENT).map(([value, label]) => ({ label, value }));
const optionsPriorites = Object.entries(LIBELLE_PRIORITE_TICKET).map(([value, label]) => ({ label, value }));

const chipRecherche = (r: string): ChipFiltre[] =>
  r ? [{ label: `« ${r} »`, value: r, icone: 'search', defaut: true }] : [];

const chipsTickets = computed(() => {
  const f = filtres.value;
  const cs = chipRecherche(f.recherche);
  if (f.statut) cs.push({ label: libelleStatut(f.statut), value: f.statut, icone: 'flag', cle: 'statut' });
  if (f.categorie) cs.push({ label: libelleCategorie(f.categorie), value: f.categorie, icone: 'category', cle: 'categorie' });
  if (f.priorite) cs.push({ label: libellePriorite(f.priorite), value: f.priorite, icone: 'priority_high', cle: 'priorite' });
  if (f.equipementId) {
    cs.push({ label: t('helpdesk.filters.equipmentFiltered'), value: f.equipementId, icone: 'devices', cle: 'equipementId' });
  }
  return cs;
});

const chipsEquipements = computed(() => {
  const f = filtresEquip.value;
  const cs = chipRecherche(f.recherche);
  if (f.actif) {
    cs.push({
      label: f.actif === 'true' ? t('helpdesk.filters.stateActive') : t('helpdesk.filters.stateInactive'),
      value: f.actif,
      icone: 'toggle_on',
      cle: 'actif',
    });
  }
  return cs;
});

const statutPlaques = computed(() =>
  (['OUVERT', 'EN_COURS', 'RESOLU', 'CLOTURE'] as const).map((cle) => ({
    cle,
    libelle: t(`helpdesk.stats.labels.${cle}`),
  })),
);

function libelleStatut(s: string): string {
  return LIBELLE_STATUT_TICKET[s] ?? s;
}
function libellePriorite(p: string): string {
  return LIBELLE_PRIORITE_TICKET[p] ?? p;
}
function libelleCategorie(c: string): string {
  return LIBELLE_CATEGORIE_INCIDENT[c] ?? c;
}
function nomCourt(u: { nom?: string; prenom?: string } | null | undefined): string {
  const nom = `${u?.prenom ?? ''} ${u?.nom ?? ''}`.trim();
  return nom || '—';
}

// ---------------------------------------------------------------- colonnes
const colonnesCommunes = (): QTableColumn[] => [
  { name: 'numero', label: t('helpdesk.table.columns.number'), field: 'numero', align: 'left', sortable: true },
  {
    name: 'categorie',
    label: t('helpdesk.table.columns.category'),
    field: (r: TicketSupport) => libelleCategorie(r.categorie),
    align: 'left',
  },
  {
    name: 'equipement',
    label: t('helpdesk.table.columns.equipment'),
    field: (r: TicketSupport) => r.equipement?.libelle ?? '—',
    align: 'left',
  },
];
const colonnesFin = (): QTableColumn[] => [
  { name: 'priorite', label: t('helpdesk.table.columns.priority'), field: 'priorite', align: 'left' },
  { name: 'statut', label: t('helpdesk.table.columns.status'), field: 'statut', align: 'left' },
  {
    name: 'createdAt',
    label: t('helpdesk.table.columns.date'),
    field: (r: TicketSupport) => dateHeureLisible(r.createdAt),
    align: 'left',
  },
];

const colonnesMes = computed<QTableColumn[]>(() => [
  ...colonnesCommunes(),
  { name: 'description', label: t('helpdesk.table.columns.description'), field: 'description', align: 'left' },
  ...colonnesFin(),
]);

const colonnesGestion = computed<QTableColumn[]>(() => [
  ...colonnesCommunes(),
  {
    name: 'declarant',
    label: t('helpdesk.table.columns.declarant'),
    field: (r: TicketSupport) => nomCourt(r.utilisateur ?? null) || (r.declarantNom ?? '—'),
    align: 'left',
  },
  ...colonnesFin(),
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesEquipements = computed<QTableColumn[]>(() => [
  { name: 'libelle', label: t('helpdesk.table.columns.label'), field: 'libelle', align: 'left', sortable: true },
  { name: 'emplacement', label: t('helpdesk.table.columns.location'), field: 'emplacement', align: 'left' },
  { name: 'codeQr', label: t('helpdesk.table.columns.qrCode'), field: 'codeQr', align: 'left' },
  { name: 'actif', label: t('helpdesk.table.columns.state'), field: 'actif', align: 'left' },
  {
    name: 'tickets',
    label: t('helpdesk.table.columns.tickets'),
    field: (r: EquipementCampus) => r._count?.tickets ?? 0,
    align: 'left',
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

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
  const { data } = await api.get('/tickets/stats');
  stats.value = data;
}

/**
 * URL encodée dans l'étiquette : construite par le routeur, pour rester juste
 * quel que soit le mode (hash ou history). Une URL bricolée à la main donnait
 * « origin//helpdesk », que l'application ne sait pas router.
 */
function urlEtiquette(codeQr: string): string {
  const href = router.resolve({ name: 'helpdesk', query: { equipement: codeQr } }).href;
  return new URL(href, window.location.origin).toString();
}

/** Les vignettes QR des cartes se dessinent dès que la liste ou l'onglet change. */
watch(
  () => [equip.lignes, onglet.value, presentation.value],
  async () => {
    await nextTick();
    const canvases = document.querySelectorAll<HTMLCanvasElement>('canvas.qr-canvas');
    for (const canvas of canvases) {
      const eq = equip.lignes.find((e) => e.id === canvas.dataset.equipement);
      if (eq) await QRCode.toCanvas(canvas, urlEtiquette(eq.codeQr), { width: 160, margin: 1 });
    }
  },
);

async function changerStatut(ticket: TicketSupport, statut: StatutTicket) {
  try {
    await api.post(`/tickets/${ticket.id}/statut`, { statut });
    $q.notify({ type: 'positive', message: t('helpdesk.messages.ticketStatusChanged', { numero: ticket.numero, statut: libelleStatut(statut).toLowerCase() }) });
    await Promise.all([mes.recharger(), gestion.recharger(), chargerStats()]);
  } catch {
    /* le boot axios affiche déjà le motif */
  }
}

function copier(texte: string) {
  void navigator.clipboard?.writeText(texte);
  $q.notify({ type: 'info', message: t('helpdesk.messages.codeCopied') });
}

function imprimerQr(e: EquipementCampus) {
  void ouvrirImpression(`/equipements/${e.id}/imprimer-qr`);
}

function ouvrirEquipement(e: EquipementCampus | null) {
  equipementEdite.value = e;
  equipementDialogOuvert.value = true;
}

function supprimerEquipement(e: EquipementCampus) {
  void supprimerAvecConfirmation(`/equipements/${e.id}`, e.libelle, equip.recharger, {
    titre: t('helpdesk.deleteEquipmentDialog.title'),
    message: t('helpdesk.deleteEquipmentDialog.message', { libelle: e.libelle }),
    succes: t('helpdesk.messages.equipmentDeleted'),
  });
}

// --------------------------------------------------------------- scan QR
async function resoudreScanCode(brut: string) {
  if (!brut) return;
  try {
    const { data } = await api.get(`/equipements/par-code/${encodeURIComponent(brut)}`);
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

<style scoped lang="scss">
$encre: #1D1D1F;
$chaux-claire: #FFFFFF;
$blanc-craie: #FFFFFF;
$vert: #007A4D;
$jaune-fonce: #8A6300;
$rouge: #CE1126;



.ticket-champ {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: var(--up-encre);
  border-radius: var(--up-rayon-sm);

  &.ticket-champ--OUVERT { background: $jaune-fond; color: $jaune-texte; }
  &.ticket-champ--EN_COURS { background: $vert-fond; color: $vert-lien; }
  &.ticket-champ--RESOLU { background: $vert-fond; color: #{$vert}; }
  &.ticket-champ--CLOTURE { background: var(--up-gris-inerte); color: var(--up-encre-douce); }

  &.prio-champ--BASSE {
    background: var(--up-gris-inerte);
    color: var(--up-encre);
    border: var(--up-filet);
    box-shadow: none;
  }
  &.prio-champ--NORMALE { background: $jaune-fond; color: $jaune-texte; }
  &.prio-champ--HAUTE { background: $rouge-fond; color: #{$rouge}; }
}

.qr-canvas {
  margin: 0 auto;
  display: block;
}
</style>
