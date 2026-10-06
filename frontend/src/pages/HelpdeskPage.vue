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
        <q-btn unelevated color="primary" no-caps icon="warning" :label="$t('helpdesk.actions.declareIncident')" @click="declarerOuvert = true" />
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
        <div class="col-12 col-lg-4">
          <q-card flat bordered class="carte">
            <q-card-section>
              <div class="text-h6">{{ $t('helpdesk.declareCard.title') }}</div>
              <div class="page-sous-titre q-mb-md">
                {{ $t('helpdesk.declareCard.description') }}
                <span v-if="dsi">{{ $t('helpdesk.declareCard.adminNote') }}</span>
              </div>
              <div class="row q-col-gutter-sm">
                <div v-for="c in categoriesApercu" :key="c.value" class="col-6">
                  <q-btn
                    flat
                    no-caps
                    class="tuile-cat full-width"
                    @click="ouvrirDeclaration(c.value)"
                  >
                    <div class="column items-center">
                      <q-icon :name="c.icone" size="22px" />
                      <span class="q-mt-xs text-center">{{ c.label }}</span>
                    </div>
                  </q-btn>
                </div>
              </div>
              <div class="row q-mt-md">
                <q-btn unelevated color="primary" no-caps icon="add" :label="$t('helpdesk.actions.otherProblem')" class="full-width" @click="ouvrirDeclaration()" />
              </div>
              <div class="row q-mt-md">
                <q-btn outline color="primary" no-caps icon="qr_code_scanner" :label="$t('helpdesk.actions.scanEquipment')" class="full-width" @click="scanEquipement = true" />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-lg-8">
          <q-table
            flat
            bordered
            class="carte"
            :rows="mesTickets"
            :columns="colonnesMes"
            row-key="id"
            :loading="chargementMes"
            :pagination="{ rowsPerPage: 10 }"
          >
            <template #top-left>
              <div class="text-subtitle1 text-weight-medium">
                {{ dsi ? $t('helpdesk.myTicketsTable.titleAll') : $t('helpdesk.myTicketsTable.titleMine') }}
              </div>
            </template>
            <template #no-data>
              <div class="full-width text-center text-grey-7 q-pa-lg">
                <q-icon name="assignment_turned_in" size="38px" color="grey-5" />
                <div class="q-mt-sm">
                  {{ dsi ? $t('helpdesk.myTicketsTable.emptyAll') : $t('helpdesk.myTicketsTable.emptyMine') }}
                </div>
                <div class="text-caption q-mt-xs">
                  {{ $t('helpdesk.myTicketsTable.emptyHint') }}
                </div>
              </div>
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
      <div class="row q-col-gutter-md q-mb-md">
        <div v-for="s in statutPlaques" :key="s.cle" class="col-6 col-md-3">
          <q-card flat bordered class="carte">
            <q-card-section class="text-center">
              <div class="stat-chiffre chiffres">{{ stats?.[s.cle] ?? 0 }}</div>
              <div class="pochoir text-grey-7">{{ s.libelle }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
      <q-banner v-if="dsi" class="note--info q-mb-md">
        <i18n-t keypath="helpdesk.stats.resolutionRate" tag="span">
          <template #taux><strong>{{ stats?.tauxResolution24h ?? 0 }} %</strong></template>
          <template #resolus>{{ stats?.resolus24h ?? 0 }}</template>
          <template #pluriel>{{ (stats?.resolus24h ?? 0) > 1 ? 's' : '' }}</template>
        </i18n-t>
      </q-banner>

      <filter-bar
        v-model="filtres"
        :chips="chipsTickets"
        :placeholder="$t('helpdesk.filters.searchTickets')"
        @reinitialiser="filtres = { recherche: '' }"
      >
        <template #avances>
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
        <template #actions>
          <view-toggle
            cle="helpdesk.gestion"
            :modes="['tableau', 'cartes']"
            @update:mode="(v: string) => (modeGestion = v as 'tableau' | 'cartes')"
          />
        </template>
      </filter-bar>

      <pagination-bar
        :page="paginationGestion.page"
        :page-size="paginationGestion.pageSize"
        :total="paginationGestion.total"
        :show-all="false"
        @update:page="paginationGestion.page = $event; requeterGestion()"
        @update:page-size="paginationGestion.pageSize = $event; paginationGestion.page = 1; requeterGestion()"
        @tous="chargerTousGestion"
      />

      <q-table
        v-if="modeGestion === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="tickets"
        :columns="colonnesGestion"
        row-key="id"
        :loading="chargementGestion"
        :rows-per-page-options="[0]"
        :hide-bottom="chargementGestion || tickets.length > 0"
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
          <div class="full-width text-center text-grey-7 q-pa-lg">
            <q-icon name="support_agent" size="38px" color="grey-5" />
            <div class="q-mt-sm">{{ $t('helpdesk.gestionTable.emptyTitle') }}</div>
            <div class="text-caption q-mt-xs">
              {{ $t('helpdesk.gestionTable.emptyHint') }}
            </div>
          </div>
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
        <div v-for="t in tickets" :key="t.id" class="col-12 col-md-6 col-xl-4">
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
                  <span v-if="t.equipement.emplacement" class="text-grey-7">{{ $t('rectoratPage.subtitleFallback') }} {{ t.equipement.emplacement }}</span>
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
        <div v-if="!chargementGestion && !tickets.length" class="col-12 text-center text-grey-7 q-pa-lg">
          <q-icon name="support_agent" size="42px" color="grey-5" />
          <div class="q-mt-sm">{{ $t('helpdesk.gestionTable.emptyTitle') }}</div>
          <div class="text-caption q-mt-xs">
            {{ $t('helpdesk.gestionTable.emptyHintShort') }}
          </div>
        </div>
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
        @reinitialiser="filtresEquip = { recherche: '' }"
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
        <template #actions>
          <view-toggle
            cle="helpdesk.equipements"
            :modes="['tableau', 'cartes']"
            @update:mode="(v: string) => (modeEquipements = v as 'tableau' | 'cartes')"
          />
        </template>
      </filter-bar>

      <q-table
        v-if="modeEquipements === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="equipements"
        :columns="colonnesEquipements"
        row-key="id"
        :loading="chargementEquipements"
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
          <div class="full-width text-center text-grey-7 q-pa-lg">
            <q-icon name="qr_code_2" size="38px" color="grey-5" />
            <div class="q-mt-sm">{{ $t('helpdesk.equipmentTab.emptyTitle') }}</div>
            <div class="text-caption q-mt-xs">
              {{ $t('helpdesk.equipmentTab.emptyHint') }}
            </div>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="add"
              :label="$t('helpdesk.actions.newEquipment')"
              class="q-mt-sm"
              @click="ouvrirEquipement(null)"
            />
          </div>
        </template>
      </q-table>

      <div v-else class="row q-col-gutter-md">
        <div v-for="e in equipements" :key="e.id" class="col-12 col-md-6 col-xl-4">
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
        <div v-if="!chargementEquipements && !equipements.length" class="col-12 text-center text-grey-7 q-pa-lg">
          <q-icon name="qr_code_2" size="42px" color="grey-5" />
          <div class="q-mt-sm">{{ $t('helpdesk.equipmentTab.emptyTitle') }}</div>
          <q-btn
            flat
            no-caps
            color="primary"
            icon="add"
            :label="$t('helpdesk.actions.newEquipment')"
            class="q-mt-sm"
            @click="ouvrirEquipement(null)"
          />
        </div>
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
      :equipements="equipements"
      :categorie-initiale="categorieInitiale"
      @declare="onDeclare"
    />
    <equipement-dialog v-model="equipementDialogOuvert" :equipement="equipementEdite" @enregistre="rechargerEquipements" />

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
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import QrScanner from '../components/QrScanner.vue';
import TicketDialog from '../components/TicketDialog.vue';
import EquipementDialog from '../components/EquipementDialog.vue';
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

const dsi = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));

const onglet = ref('mes-tickets');
const mesTickets = ref<TicketSupport[]>([]);
const tickets = ref<TicketSupport[]>([]);
const equipements = ref<EquipementCampus[]>([]);
const stats = ref<Record<string, number> | null>(null);

const paginationGestion = ref({ page: 1, pageSize: 20, total: 0 });

const chargementMes = ref(false);
const chargementGestion = ref(false);
const chargementEquipements = ref(false);

const declarerOuvert = ref(false);
const categorieInitiale = ref<CategorieIncident | ''>('');
const equipementScanne = ref<EquipementCampus | null>(null);
const ticketDetail = ref<TicketSupport | null>(null);
const equipementDialogOuvert = ref(false);
const equipementEdite = ref<EquipementCampus | null>(null);

const scanEquipement = ref(false);
const codeScanne = ref('');

const modeGestion = ref<'tableau' | 'cartes'>('tableau');
const modeEquipements = ref<'tableau' | 'cartes'>('cartes');

const filtres = ref<Record<string, any>>({ recherche: '' });
const filtresEquip = ref<Record<string, any>>({ recherche: '' });

const ICONES_CATEGORIE: Record<CategorieIncident, string> = {
  VIDEO: 'videocam',
  SON: 'volume_up',
  RESEAU: 'wifi',
  ELECTRICITE: 'bolt',
  MOBILIER: 'chair',
  INFORMATIQUE: 'computer',
  CLIMATISATION: 'ac_unit',
  AUTRE: 'build',
};

const categoriesApercu = (
  Object.keys(LIBELLE_CATEGORIE_INCIDENT) as CategorieIncident[]
)
  .slice(0, 6)
  .map((value) => ({
    value,
    label: LIBELLE_CATEGORIE_INCIDENT[value],
    icone: ICONES_CATEGORIE[value],
  }));

const optionsStatuts = (Object.keys(LIBELLE_STATUT_TICKET) as StatutTicket[]).map((v) => ({
  label: LIBELLE_STATUT_TICKET[v],
  value: v,
}));
const optionsCategories = Object.entries(LIBELLE_CATEGORIE_INCIDENT).map(([value, label]) => ({
  label,
  value,
}));
const optionsPriorites = Object.entries(LIBELLE_PRIORITE_TICKET).map(([value, label]) => ({
  label,
  value,
}));

const chipsTickets = computed(() => {
  const f = filtres.value;
  const cs: ChipFiltre[] = [];
  if (f.recherche) {
    cs.push({ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true });
  }
  if (f.statut) cs.push({ label: libelleStatut(f.statut), value: f.statut, icone: 'flag', cle: 'statut'});
  if (f.categorie) {
    cs.push({ label: libelleCategorie(f.categorie), value: f.categorie, icone: 'category', cle: 'categorie'});
  }
  if (f.priorite) {
    cs.push({ label: libellePriorite(f.priorite), value: f.priorite, icone: 'priority_high', cle: 'priorite'});
  }
  if (f.equipementId) {
    cs.push({ label: t('helpdesk.filters.equipmentFiltered'), value: f.equipementId, icone: 'devices', cle: 'equipementId'});
  }
  return cs;
});

const chipsEquipements = computed(() => {
  const f = filtresEquip.value;
  const cs: ChipFiltre[] = [];
  if (f.recherche) {
    cs.push({ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true });
  }
  if (f.actif) {
    cs.push({
      label: f.actif === 'true' ? t('helpdesk.filters.stateActive') : t('helpdesk.filters.stateInactive'),
      value: f.actif,
      icone: 'toggle_on', cle: 'actif'});
  }
  return cs;
});

const statutPlaques = computed(() => [
  { cle: 'OUVERT', libelle: t('helpdesk.stats.labels.OUVERT') },
  { cle: 'EN_COURS', libelle: t('helpdesk.stats.labels.EN_COURS') },
  { cle: 'RESOLU', libelle: t('helpdesk.stats.labels.RESOLU') },
  { cle: 'CLOTURE', libelle: t('helpdesk.stats.labels.CLOTURE') },
]);

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

const colonnesMes = computed<QTableColumn[]>(() => [
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
  { name: 'description', label: t('helpdesk.table.columns.description'), field: 'description', align: 'left' },
  { name: 'priorite', label: t('helpdesk.table.columns.priority'), field: 'priorite', align: 'left' },
  { name: 'statut', label: t('helpdesk.table.columns.status'), field: 'statut', align: 'left' },
  {
    name: 'createdAt',
    label: t('helpdesk.table.columns.date'),
    field: (r: TicketSupport) => dateHeureLisible(r.createdAt),
    align: 'left',
  },
]);

const colonnesGestion = computed<QTableColumn[]>(() => [
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
  {
    name: 'declarant',
    label: t('helpdesk.table.columns.declarant'),
    field: (r: TicketSupport) => nomCourt(r.utilisateur ?? null) || (r.declarantNom ?? '—'),
    align: 'left',
  },
  { name: 'priorite', label: t('helpdesk.table.columns.priority'), field: 'priorite', align: 'left' },
  { name: 'statut', label: t('helpdesk.table.columns.status'), field: 'statut', align: 'left' },
  {
    name: 'createdAt',
    label: t('helpdesk.table.columns.date'),
    field: (r: TicketSupport) => dateHeureLisible(r.createdAt),
    align: 'left',
  },
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

function ouvrirDeclaration(cat?: CategorieIncident) {
  categorieInitiale.value = (cat ?? '') as CategorieIncident | '';
  declarerOuvert.value = true;
}

function onDeclare() {
  categorieInitiale.value = '';
  void chargerMes();
  if (dsi.value) {
    void requeterGestion();
    void chargerStats();
  }
}

async function chargerMes() {
  chargementMes.value = true;
  try {
    const { data } = await api.get('/tickets', { params: { all: '1' } });
    mesTickets.value = data.data;
  } finally {
    chargementMes.value = false;
  }
}

watch(filtres, () => {
  paginationGestion.value.page = 1;
  void requeterGestion();
}, { deep: true });

watch(filtresEquip, () => chargerEquipements(), { deep: true });

async function requeterGestion() {
  if (!dsi.value) return;
  chargementGestion.value = true;
  try {
    const f = filtres.value;
    const { data } = await api.get('/tickets', {
      params: {
        page: paginationGestion.value.page,
        pageSize: paginationGestion.value.pageSize,
        statut: f.statut || undefined,
        categorie: f.categorie || undefined,
        priorite: f.priorite || undefined,
        equipementId: f.equipementId || undefined,
        search: (f.recherche ?? '').toString().trim() || undefined,
      },
    });
    tickets.value = data.data;
    paginationGestion.value.total = data.total;
  } finally {
    chargementGestion.value = false;
  }
}

async function chargerTousGestion() {
  paginationGestion.value.page = 1;
  paginationGestion.value.pageSize = Math.max(paginationGestion.value.total, 200) || 200;
  await requeterGestion();
}

async function chargerStats() {
  if (!dsi.value) return;
  const { data } = await api.get('/tickets/stats');
  stats.value = data;
}

async function chargerEquipements() {
  chargementEquipements.value = true;
  try {
    const { data } = await api.get('/equipements', {
      params: {
        all: '1',
        search: (filtresEquip.value.recherche ?? '').toString().trim() || undefined,
        actif: filtresEquip.value.actif || undefined,
      },
    });
    equipements.value = data.data;
    await nextTick();
    await dessinerTousLesQr();
  } finally {
    chargementEquipements.value = false;
  }
}

function rechargerEquipements() {
  void chargerEquipements();
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

async function dessinerTousLesQr() {
  const canvases = document.querySelectorAll<HTMLCanvasElement>('canvas.qr-canvas');
  for (const canvas of canvases) {
    const eqId = canvas.dataset.equipement;
    const eq = equipements.value.find((e) => e.id === eqId);
    if (!eq) continue;
    await QRCode.toCanvas(canvas, urlEtiquette(eq.codeQr), { width: 160, margin: 1 });
  }
}

async function changerStatut(ticket: TicketSupport, statut: StatutTicket) {
  try {
    await api.post(`/tickets/${ticket.id}/statut`, { statut });
    $q.notify({ type: 'positive', message: t('helpdesk.messages.ticketStatusChanged', { numero: ticket.numero, statut: libelleStatut(statut).toLowerCase() }) });
    await Promise.all([chargerMes(), requeterGestion(), chargerStats()]);
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
  $q.dialog({
    title: t('helpdesk.deleteEquipmentDialog.title'),
    message: t('helpdesk.deleteEquipmentDialog.message', { libelle: e.libelle }),
    cancel: true,
  }).onOk(async () => {
    await api.delete(`/equipements/${e.id}`);
    $q.notify({ type: 'positive', message: t('helpdesk.messages.equipmentDeleted') });
    await chargerEquipements();
  });
}

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

async function resoudreScanUrl() {
  const brut = String(route.query.equipement ?? route.query.code ?? '').trim();
  if (!brut) return;
  await resoudreScanCode(brut);
}

onMounted(() => {
  void chargerMes();
  void chargerEquipements();
  if (dsi.value) {
    void requeterGestion();
    void chargerStats();
  }
  void resoudreScanUrl();
});
</script>

<style scoped lang="scss">
$encre: #1D1D1F;
$chaux-claire: #FFFFFF;
$blanc-craie: #FFFFFF;
$vert: #007A4D;
$jaune-fonce: #8A6300;
$rouge: #CE1126;

.tuile-cat {
  border: var(--up-filet);
  padding: 10px 6px;
  min-height: 68px;
  background: var(--up-craie);
  color: var(--up-encre);
  font-size: 11px;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 590;
}

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
