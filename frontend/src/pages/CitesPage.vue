<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <h1 class="page-titre">{{ $t('cites.title') }}</h1>
        <div class="page-sous-titre">
          {{ $t('cites.subtitle') }}
        </div>
      </div>
      <div class="col-auto" v-if="peutGerer">
        <q-btn
          unelevated
          color="primary"
          no-caps
          :icon="onglet === 'attributions' ? 'how_to_reg' : 'add'"
          :label="boutonOnglet"
          @click="ouvrirCourant"
        />
      </div>
    </div>

    <q-tabs v-model="onglet" dense align="left" class="onglets-panneau" narrow-indicator>
      <q-tab name="residences" icon="apartment" :label="$t('cites.tabs.residences')" no-caps />
      <q-tab name="chambres" icon="meeting_room" :label="$t('cites.tabs.chambres')" no-caps />
      <q-tab name="attributions" icon="how_to_reg" :label="$t('cites.tabs.attributions')" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- RÉSIDENCES                                                       -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'residences'" name="residences" class="q-pa-none q-mt-md">
      <filter-bar
        v-model="filtresResidences"
        :chips="chipsResidences"
        :placeholder="$t('cites.residences.filters.placeholder')"
        @reinitialiser="res.reinitialiser()"
      >
        <template #avances>
          <q-input
            v-model.number="filtresResidences.capaciteMin"
            type="number"
            min="0"
            dense
            outlined
            :label="$t('cites.residences.filters.capaciteMin')"
            clearable
          />
          <q-select
            v-model="filtresResidences.actif"
            :options="[
              { label: $t('cites.residences.filters.etatToutes'), value: null },
              { label: $t('cites.residences.filters.etatActives'), value: 'true' },
              { label: $t('cites.residences.filters.etatInactives'), value: 'false' },
            ]"
            emit-value
            map-options
            dense
            outlined
            :label="$t('cites.residences.filters.etat')"
          />
          <q-input
            v-model="filtresResidences.ville"
            dense
            outlined
            :label="$t('cites.residences.filters.ville')"
            clearable
          />
        </template>
      </filter-bar>

      <!-- Vue tableau -->
      <q-table
        v-if="presentation === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="residencesFiltrees"
        :columns="colonnesResidences"
        row-key="id"
        :loading="res.chargement"
        :rows-per-page-options="[0]"
        :hide-bottom="res.chargement || residencesFiltrees.length > 0"
      >
        <template #body-cell-statut="p">
          <q-td :props="p">
            <q-badge :color="p.row.actif ? 'positive' : 'grey-7'">
              {{ p.row.actif ? $t('cites.common.status.active') : $t('cites.common.status.inactive') }}
            </q-badge>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              flat
              dense
              round
              icon="meeting_room"
              :aria-label="$t('cites.residences.table.aria.voirChambres')"
              @click="voirChambresDe(p.row)"
            >
              <q-tooltip>{{ $t('cites.residences.table.tooltip.voirChambres') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="peutGererResidences" flat dense round icon="edit" :aria-label="$t('cites.residences.table.aria.modifier')" @click="ouvrirResidence(p.row)">
              <q-tooltip>{{ $t('cites.common.tooltip.edit') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="auth.estAdmin" flat dense round color="negative" icon="delete" :aria-label="$t('cites.residences.table.aria.supprimer')" @click="supprimerResidence(p.row)">
              <q-tooltip>{{ $t('cites.common.tooltip.delete') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <etat-vide icone="apartment" :titre="$t('cites.residences.emptyState.title')" :aide="$t('cites.residences.emptyState.hint')">
            <template v-if="peutGererResidences" #action>
              <q-btn flat no-caps color="primary" icon="add" :label="$t('cites.actions.newResidence')" @click="ouvrirResidence(null)" />
            </template>
          </etat-vide>
        </template>
      </q-table>

      <!-- Vue cartes -->
      <div v-else class="row q-col-gutter-md">
        <div v-if="res.chargement" class="col-12 q-pa-md text-center">
          <q-spinner color="primary" />
        </div>
        <div v-for="r in residencesFiltrees" :key="r.id" class="col-12 col-md-6 col-xl-4">
          <q-card flat bordered class="carte">
            <q-card-section class="row items-center q-pb-none">
              <div class="col">
                <div class="text-uppercase text-caption text-grey-7">{{ r.code }}</div>
                <div class="text-subtitle1 text-weight-medium">{{ r.nom }}</div>
              </div>
              <q-badge :color="r.actif ? 'positive' : 'grey-7'">
                {{ r.actif ? $t('cites.common.status.active') : $t('cites.common.status.inactive') }}
              </q-badge>
            </q-card-section>
            <q-card-section class="q-pt-none q-gutter-y-xs">
              <div class="row items-center">
                <q-icon name="place" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">{{ r.ville ?? '—' }}</span>
              </div>
              <div class="row items-center">
                <q-icon name="bed" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">{{ $t('cites.residences.card.capacite', { n: nombreLisible(r.capacite) }) }}</span>
              </div>
              <div class="row items-center q-gutter-xs">
                <q-icon name="meeting_room" size="16px" class="q-mr-sm text-grey-6" />
                <q-chip dense size="sm" color="positive" text-color="white">
                  {{ $t('cites.residences.card.libres', { n: compteLibres(r) }) }}
                </q-chip>
                <q-chip dense size="sm" color="amber-8" text-color="white">
                  {{ $t('cites.residences.card.reservees', { n: compteReservees(r) }) }}
                </q-chip>
                <q-chip dense size="sm" color="blue-grey-5" text-color="white">
                  {{ $t('cites.residences.card.occupees', { n: compteOccupees(r) }) }}
                </q-chip>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions class="text-caption text-grey-7 q-px-md">
              <q-icon name="person_outline" size="16px" class="q-mr-xs" />
              {{ r.responsable ?? $t('cites.residences.card.noResponsable') }}
              <q-space />
              <q-btn v-if="peutGererResidences" flat dense round size="sm" icon="edit" :aria-label="$t('cites.residences.table.aria.modifier')" @click="ouvrirResidence(r)">
                <q-tooltip>{{ $t('cites.common.tooltip.edit') }}</q-tooltip>
              </q-btn>
              <q-btn v-if="auth.estAdmin" flat dense round size="sm" color="negative" icon="delete" :aria-label="$t('cites.residences.table.aria.supprimer')" @click="supprimerResidence(r)">
                <q-tooltip>{{ $t('cites.common.tooltip.delete') }}</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
        </div>
        <etat-vide v-if="!res.chargement && !residencesFiltrees.length" class="col-12" icone="apartment" :titre="$t('cites.residences.emptyState.title')">
          <template v-if="peutGererResidences" #action>
            <q-btn flat no-caps color="primary" icon="add" :label="$t('cites.actions.newResidence')" @click="ouvrirResidence(null)" />
          </template>
        </etat-vide>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- CHAMBRES                                                         -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'chambres'" name="chambres" class="q-pa-none q-mt-md">
      <filter-bar
        v-model="filtresChambres"
        :chips="chipsChambres"
        :placeholder="$t('cites.chambres.filters.placeholder')"
        @reinitialiser="ch.reinitialiser()"
      >
        <template #avances>
          <autocomplete-async
            v-model="filtresChambres.residenceId"
            endpoint="/residences"
            :label-fn="(r) => `${r.code} — ${r.nom}`"
            :label="$t('cites.chambres.filters.residence')"
          />
          <q-select
            v-model="filtresChambres.categorie"
            :options="optionsCategories"
            emit-value
            map-options
            dense
            outlined
            clearable
            :label="$t('cites.chambres.filters.categorie')"
          />
          <q-select
            v-model="filtresChambres.statut"
            :options="optionsStatutsChambre"
            emit-value
            map-options
            dense
            outlined
            clearable
            :label="$t('cites.chambres.filters.statut')"
          />
        </template>
      </filter-bar>

      <pagination-bar v-model:page="ch.page" v-model:page-size="ch.pageSize" :total="ch.total" :show-all="false" />

      <!-- Vue tableau -->
      <q-table
        v-if="presentation === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="ch.lignes"
        :columns="colonnesChambres"
        row-key="id"
        :loading="ch.chargement"
        :rows-per-page-options="[0]"
        :hide-bottom="ch.chargement || ch.lignes.length > 0"
      >
        <template #body-cell-categorie="p">
          <q-td :props="p">{{ LIBELLE_CATEGORIE_CHAMBRE[p.row.categorie] ?? p.row.categorie }}</q-td>
        </template>
        <template #body-cell-statut="p">
          <q-td :props="p">
            <span class="champ champ-statut champ-statut--dense" :class="classeStatutChambre(p.row.statut)">
              <span class="pochoir">{{ LIBELLE_STATUT_CHAMBRE[p.row.statut] ?? p.row.statut }}</span>
            </span>
          </q-td>
        </template>
        <template #body-cell-loyer="p">
          <q-td :props="p" class="text-right">{{ montantLisible(p.row.loyer) }} {{ p.row.devise }}</q-td>
        </template>
        <template #body-cell-residence="p">
          <q-td :props="p">{{ p.row.residence?.nom ?? '—' }}</q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              flat
              dense
              round
              icon="how_to_reg"
              :aria-label="$t('cites.chambres.table.aria.voirAttributions')"
              @click="voirAttributionsDe(p.row)"
            >
              <q-tooltip>{{ $t('cites.chambres.table.tooltip.voirAttributions') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="peutGererChambres" flat dense round icon="edit" :aria-label="$t('cites.chambres.table.aria.modifier')" @click="ouvrirChambre(p.row)">
              <q-tooltip>{{ $t('cites.common.tooltip.edit') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="auth.estAdmin" flat dense round color="negative" icon="delete" :aria-label="$t('cites.chambres.table.aria.supprimer')" @click="supprimerChambre(p.row)">
              <q-tooltip>{{ $t('cites.common.tooltip.delete') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <etat-vide icone="meeting_room" :titre="$t('cites.chambres.emptyState.title')" :aide="$t('cites.chambres.emptyState.hint')">
            <template v-if="peutGererChambres" #action>
              <q-btn flat no-caps color="primary" icon="add" :label="$t('cites.actions.newChambre')" @click="ouvrirChambre(null)" />
            </template>
          </etat-vide>
        </template>
      </q-table>

      <!-- Vue cartes -->
      <div v-else class="row q-col-gutter-md">
        <div v-if="ch.chargement" class="col-12 q-pa-md text-center">
          <q-spinner color="primary" />
        </div>
        <div v-for="c in ch.lignes" :key="c.id" class="col-12 col-md-6 col-xl-4">
          <q-card flat bordered class="carte">
            <q-card-section class="row items-center q-pb-none">
              <div class="col">
                <div class="text-uppercase text-caption text-grey-7">{{ c.residence?.code ?? '—' }}</div>
                <div class="text-subtitle1 text-weight-medium">{{ c.code }}</div>
              </div>
              <span class="champ champ-statut champ-statut--dense" :class="classeStatutChambre(c.statut)">
                <span class="pochoir">{{ LIBELLE_STATUT_CHAMBRE[c.statut] ?? c.statut }}</span>
              </span>
            </q-card-section>
            <q-card-section class="q-pt-none q-gutter-y-xs">
              <div class="row items-center">
                <q-icon name="apartment" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">{{ c.residence?.nom ?? '—' }}</span>
              </div>
              <div class="row items-center">
                <q-icon name="category" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">{{ LIBELLE_CATEGORIE_CHAMBRE[c.categorie] ?? c.categorie }}</span>
              </div>
              <div class="row items-center">
                <q-icon name="bed" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">{{ c.lits }} {{ c.lits > 1 ? $t('cites.chambres.card.litPlural') : $t('cites.chambres.card.litSingular') }}</span>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions class="text-caption text-grey-7 q-px-md">
              <q-icon name="payments" size="16px" class="q-mr-xs" />
              <span class="chiffres text-weight-medium">{{ montantLisible(c.loyer) }} {{ c.devise }}</span>
              <q-space />
              <q-btn v-if="peutGererChambres" flat dense round size="sm" icon="edit" :aria-label="$t('cites.chambres.table.aria.modifier')" @click="ouvrirChambre(c)">
                <q-tooltip>{{ $t('cites.common.tooltip.edit') }}</q-tooltip>
              </q-btn>
              <q-btn v-if="auth.estAdmin" flat dense round size="sm" color="negative" icon="delete" :aria-label="$t('cites.chambres.table.aria.supprimer')" @click="supprimerChambre(c)">
                <q-tooltip>{{ $t('cites.common.tooltip.delete') }}</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
        </div>
        <etat-vide v-if="!ch.chargement && !ch.lignes.length" class="col-12" icone="meeting_room" :titre="$t('cites.chambres.emptyState.title')">
          <template v-if="peutGererChambres" #action>
            <q-btn flat no-caps color="primary" icon="add" :label="$t('cites.actions.newChambre')" @click="ouvrirChambre(null)" />
          </template>
        </etat-vide>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- ATTRIBUTIONS                                                     -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'attributions'" name="attributions" class="q-pa-none q-mt-md">
      <filter-bar
        v-model="filtresAttributions"
        :chips="chipsAttributions"
        :recherche="false"
        @reinitialiser="att.reinitialiser([])"
      >
        <template #avances>
          <q-select
            v-model="filtresAttributions.anneeId"
            :options="optionsAnnees"
            emit-value
            map-options
            dense
            outlined
            clearable
            :label="$t('cites.attributions.filters.annee')"
          />
          <q-select
            v-model="filtresAttributions.statut"
            :options="optionsStatutsAttribution"
            emit-value
            map-options
            dense
            outlined
            clearable
            :label="$t('cites.attributions.filters.statut')"
          />
          <autocomplete-async
            v-model="filtresAttributions.residenceId"
            endpoint="/residences"
            :label-fn="(r) => `${r.code} — ${r.nom}`"
            :label="$t('cites.attributions.filters.residence')"
          />
          <q-input
            v-model="filtresAttributions.etudiant"
            dense
            outlined
            :label="$t('cites.attributions.filters.etudiant')"
            clearable
            @keydown.enter="att.recharger()"
          />
        </template>
      </filter-bar>

      <pagination-bar v-model:page="att.page" v-model:page-size="att.pageSize" :total="att.total" :show-all="false" />

      <!-- Vue tableau -->
      <q-table
        v-if="presentation === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="att.lignes"
        :columns="colonnesAttributions"
        row-key="id"
        :loading="att.chargement"
        :rows-per-page-options="[0]"
        :hide-bottom="att.chargement || att.lignes.length > 0"
      >
        <template #body-cell-createdAt="p">
          <q-td :props="p">{{ dateLisible(p.row.createdAt) }}</q-td>
        </template>
        <template #body-cell-etudiant="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
            <div class="text-caption text-grey-7">{{ p.row.etudiant?.matricule }}</div>
          </q-td>
        </template>
        <template #body-cell-chambre="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.chambre?.code }}</div>
            <div class="text-caption text-grey-7">{{ p.row.chambre?.residence?.nom }}</div>
          </q-td>
        </template>
        <template #body-cell-score="p">
          <q-td :props="p">
            <q-badge
              v-if="p.row.critereScore !== null && p.row.critereScore !== undefined"
              dense
              :color="couleurScore(p.row.critereScore)"
              text-color="white"
            >
              {{ p.row.critereScore }}
            </q-badge>
            <span v-else class="text-grey-6">{{ $t('rectoratPage.subtitleFallback') }}</span>
          </q-td>
        </template>
        <template #body-cell-statut="p">
          <q-td :props="p">
            <span class="champ champ-statut champ-statut--dense" :class="classeStatutAttribution(p.row.statut)">
              <span class="pochoir">{{ LIBELLE_STATUT_ATTRIBUTION[p.row.statut] ?? p.row.statut }}</span>
            </span>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn v-if="p.row.statut === 'EN_ATTENTE' && peutDecider" flat dense round color="primary" icon="gavel" :aria-label="$t('cites.attributions.table.aria.decider')" @click="ouvrirDecision(p.row)">
              <q-tooltip>{{ $t('cites.attributions.table.tooltip.decider') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="['EN_ATTENTE', 'ACCORDEE'].includes(p.row.statut) && auth.estAdmin" flat dense round color="negative" icon="undo" :aria-label="$t('cites.attributions.table.aria.retirer')" @click="retirerAttribution(p.row)">
              <q-tooltip>{{ $t('cites.attributions.table.tooltip.retirer') }}</q-tooltip>
            </q-btn>
            <q-btn v-if="p.row.etudiant" flat dense round icon="person" :aria-label="$t('cites.attributions.table.aria.voirEtudiant')" @click="voirEtudiant(p.row)">
              <q-tooltip>{{ $t('cites.attributions.table.tooltip.voirEtudiant') }}</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <etat-vide icone="how_to_reg" :titre="$t('cites.attributions.emptyState.title')" :aide="$t('cites.attributions.emptyState.hint')">
            <template v-if="peutCreerAttribution" #action>
              <q-btn flat no-caps color="primary" icon="how_to_reg" :label="$t('cites.actions.newAttribution')" @click="ouvrirCourant" />
            </template>
          </etat-vide>
        </template>
      </q-table>

      <!-- Vue cartes -->
      <div v-else class="row q-col-gutter-md">
        <div v-if="att.chargement" class="col-12 q-pa-md text-center">
          <q-spinner color="primary" />
        </div>
        <div v-for="a in att.lignes" :key="a.id" class="col-12 col-md-6 col-xl-4">
          <q-card flat bordered class="carte">
            <q-card-section class="row items-center q-pb-none">
              <div class="col">
                <div class="text-uppercase text-caption text-grey-7">{{ a.etudiant?.matricule ?? '—' }}</div>
                <div class="text-subtitle1 text-weight-medium">
                  {{ a.etudiant?.nom }} {{ a.etudiant?.prenom }}
                </div>
              </div>
              <span class="champ champ-statut champ-statut--dense" :class="classeStatutAttribution(a.statut)">
                <span class="pochoir">{{ LIBELLE_STATUT_ATTRIBUTION[a.statut] ?? a.statut }}</span>
              </span>
            </q-card-section>
            <q-card-section class="q-pt-none q-gutter-y-xs">
              <div class="row items-center">
                <q-icon name="meeting_room" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">
                  <i18n-t keypath="cites.attributions.card.chambreLabel" tag="span">
                    <template #code><strong>{{ a.chambre?.code }}</strong></template>
                    <template #residence>{{ a.chambre?.residence?.nom ?? '—' }}</template>
                  </i18n-t>
                </span>
              </div>
              <div class="row items-center">
                <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">{{ $t('cites.attributions.card.demandeLe', { date: dateLisible(a.createdAt) }) }}</span>
              </div>
              <div class="row items-center">
                <q-icon name="workspace_premium" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">{{ $t('cites.attributions.card.score') }}</span>
                <q-badge
                  v-if="a.critereScore !== null && a.critereScore !== undefined"
                  dense
                  :color="couleurScore(a.critereScore)"
                  text-color="white"
                  class="q-ml-xs"
                >
                  {{ a.critereScore }}
                </q-badge>
                <span v-else class="text-grey-6 q-ml-xs">{{ $t('rectoratPage.subtitleFallback') }}</span>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions class="q-px-md">
              <q-btn v-if="a.statut === 'EN_ATTENTE' && peutDecider" flat dense no-caps color="primary" icon="gavel" :label="$t('cites.attributions.card.decider')" @click="ouvrirDecision(a)">
                <q-tooltip>{{ $t('cites.attributions.card.deciderTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn v-if="['EN_ATTENTE', 'ACCORDEE'].includes(a.statut) && auth.estAdmin" flat dense no-caps color="negative" icon="undo" :label="$t('cites.attributions.card.retirer')" @click="retirerAttribution(a)">
                <q-tooltip>{{ $t('cites.attributions.card.retirerTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn v-if="a.etudiant" flat dense no-caps icon="person" :label="$t('cites.attributions.card.etudiant')" @click="voirEtudiant(a)">
                <q-tooltip>{{ $t('cites.attributions.card.etudiantTooltip') }}</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
        </div>
        <etat-vide v-if="!att.chargement && !att.lignes.length" class="col-12" icone="how_to_reg" :titre="$t('cites.attributions.emptyState.title')">
          <template v-if="peutCreerAttribution" #action>
            <q-btn flat no-caps color="primary" icon="how_to_reg" :label="$t('cites.actions.newAttribution')" @click="ouvrirCourant" />
          </template>
        </etat-vide>
      </div>
    </q-tab-panel>

    <!-- Dialogues -->
    <residence-dialog v-model="residenceDialog" :residence="residenceEditee" @enregistre="res.recharger()" />
    <chambre-dialog v-model="chambreDialog" :chambre="chambreEditee" :residences="res.lignes" @enregistre="ch.recharger()" />
    <!-- `ouvrirCourant` charge tout le parc avant d'ouvrir ce dialogue :
         l'attribution doit pouvoir viser une chambre hors de la page affichée. -->
    <attribution-dialog
      v-model="attributionDialog"
      :chambres="chambresDialogue"
      :annees="annees"
      :annee-defaut-id="anneeDefaut"
      @enregistre="att.recharger()"
    />

    <!-- Dialog de décision du jury -->
    <q-dialog v-model="decisionDialog">
      <q-card style="width: 540px; max-width: 95vw">
        <q-card-section class="text-h6">{{ $t('cites.attributions.dialogs.decision.title') }}</q-card-section>
        <q-card-section v-if="decision" class="q-pt-none text-caption text-grey-7">
          {{ decision.etudiant?.nom }} {{ decision.etudiant?.prenom }}
          <span v-if="decision.etudiant?.matricule"> {{ $t('rectoratPage.subtitleFallback') }} {{ decision.etudiant.matricule }}</span>
          <br />
          <i18n-t keypath="cites.attributions.dialogs.decision.chambreLabel" tag="span">
            <template #code><strong>{{ decision.chambre?.code }}</strong></template>
            <template #residence>{{ decision.chambre?.residence?.nom }}</template>
          </i18n-t>
          <template v-if="decision.critereScore !== null && decision.critereScore !== undefined">
            · {{ $t('cites.attributions.dialogs.decision.scoreLabel', { score: decision.critereScore }) }}
          </template>
        </q-card-section>
        <q-card-section>
          <q-option-group
            v-model="decisionStatut"
            :options="[
              { label: $t('cites.attributions.dialogs.decision.optionAccorder'), value: 'ACCORDEE', color: 'positive' },
              { label: $t('cites.attributions.dialogs.decision.optionRefuser'), value: 'REFUSEE', color: 'negative' },
            ]"
            inline
            class="q-mb-md"
          />
          <q-banner dense class="note--info q-mb-md">
            <template #avatar><q-icon name="info" /></template>
            <span v-if="decisionStatut === 'ACCORDEE'">
              <i18n-t keypath="cites.attributions.dialogs.decision.infoAccorder" tag="span">
                <template #statut><strong>{{ $t('cites.attributions.dialogs.decision.statutOccupee') }}</strong></template>
              </i18n-t>
            </span>
            <span v-else>
              <i18n-t keypath="cites.attributions.dialogs.decision.infoRefuser" tag="span">
                <template #statut><strong>{{ $t('cites.attributions.dialogs.decision.statutLibre') }}</strong></template>
              </i18n-t>
            </span>
          </q-banner>
          <q-input
            v-model="decisionMotif"
            outlined
            dense
            type="textarea"
            :label="$t('cites.attributions.dialogs.decision.motifLabel')"
            :autogrow="true"
            rows="2"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('cites.attributions.dialogs.decision.cancel')" v-close-popup />
          <q-btn
            unelevated
            :color="decisionStatut === 'ACCORDEE' ? 'positive' : 'negative'"
            :icon="decisionStatut === 'ACCORDEE' ? 'check' : 'close'"
            :label="decisionStatut === 'ACCORDEE' ? $t('cites.attributions.dialogs.decision.accorder') : $t('cites.attributions.dialogs.decision.refuser')"
            :loading="decisionEnCours"
            @click="decider"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '../composables/presentationListe';
import { pageApi, texteApi, useListePaginee } from '../composables/useListePaginee';
import { useConfirmation } from '../composables/useConfirmation';
import { computed, onMounted, reactive, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import EtatVide from '../components/EtatVide.vue';
import ResidenceDialog from '../components/ResidenceDialog.vue';
import ChambreDialog from '../components/ChambreDialog.vue';
import AttributionDialog from '../components/AttributionDialog.vue';
import {
  LIBELLE_CATEGORIE_CHAMBRE,
  LIBELLE_STATUT_ATTRIBUTION,
  LIBELLE_STATUT_CHAMBRE,
  dateLisible,
  montantLisible,
  nombreLisible,
} from '../utils/libelles';
import type { AnneeAcademique, AttributionLogement, Chambre, Residence, ChipFiltre } from '../types';

const $q = useQuasar();
const auth = useAuthStore();
const { t } = useI18n();
const { confirmerAvecSaisie, supprimerAvecConfirmation } = useConfirmation();
const presentation = usePresentationListe();

const onglet = ref<'residences' | 'chambres' | 'attributions'>('residences');
const annees = ref<AnneeAcademique[]>([]);
const anneeDefaut = ref<string | null>(null);

const residenceDialog = ref(false);
const residenceEditee = ref<Residence | null>(null);
const chambreDialog = ref(false);
const chambreEditee = ref<Chambre | null>(null);
const attributionDialog = ref(false);
/** Tout le parc, pas seulement la page affichée : voir `ouvrirCourant`. */
const chambresDialogue = ref<Chambre[]>([]);

// ------------------------------------------------------------------ listes
// Trois listes sur une page : chacune garde ses filtres dans l'URL sous son
// préfixe (res_, ch_, at_).

/** Résidences : peu nombreuses, chargées en entier et filtrées ici. */
const filtresResidences = ref<Record<string, any>>({ recherche: '', capaciteMin: null, actif: null, ville: '' });
const res = reactive(
  useListePaginee<Residence>({
    filtres: filtresResidences,
    pageSize: 0,
    clesLocales: true,
    syncUrl: true,
    prefixeUrl: 'res_',
    charger: () => api.get('/residences', { params: { all: '1' } }).then((r) => r.data),
  }),
);

const filtresChambres = ref<Record<string, any>>({ recherche: '', residenceId: null, categorie: null, statut: null });
const ch = reactive(
  useListePaginee<Chambre>({
    filtres: filtresChambres,
    syncUrl: true,
    prefixeUrl: 'ch_',
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/chambres', {
          params: {
            ...pageApi(p),
            search: texteApi(f.recherche),
            residenceId: f.residenceId || undefined,
            categorie: f.categorie || undefined,
            statut: f.statut || undefined,
          },
        })
        .then((r) => r.data),
  }),
);

const filtresAttributions = ref<Record<string, any>>({ anneeId: null, statut: null, residenceId: null, etudiant: '' });
const att = reactive(
  useListePaginee<AttributionLogement>({
    filtres: filtresAttributions,
    syncUrl: true,
    prefixeUrl: 'at_',
    clesTexte: ['etudiant'],
    charger: ({ filtres: f, ...p }) =>
      api
        .get('/attributions-logement', {
          params: {
            ...pageApi(p),
            anneeId: f.anneeId || undefined,
            statut: f.statut || undefined,
            residenceId: f.residenceId || undefined,
            search: texteApi(f.etudiant),
          },
        })
        .then((r) => r.data),
  }),
);

const residencesFiltrees = computed(() => {
  const f = filtresResidences.value;
  const q = (f.recherche ?? '').toString().trim().toLowerCase();
  const capMin = f.capaciteMin;
  const ville = (f.ville ?? '').toString().trim().toLowerCase();
  return res.lignes.filter((r) => {
    if (capMin !== null && capMin !== undefined && capMin !== '' && r.capacite < Number(capMin)) return false;
    if (f.actif === 'true' && !r.actif) return false;
    if (f.actif === 'false' && r.actif) return false;
    if (ville && !(r.ville ?? '').toLowerCase().includes(ville)) return false;
    if (q && !`${r.code} ${r.nom} ${r.ville ?? ''} ${r.responsable ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
});

const optionsCategories = Object.entries(LIBELLE_CATEGORIE_CHAMBRE).map(([value, label]) => ({ value, label }));
const optionsStatutsChambre = Object.entries(LIBELLE_STATUT_CHAMBRE).map(([value, label]) => ({ value, label }));
const optionsStatutsAttribution = Object.entries(LIBELLE_STATUT_ATTRIBUTION).map(([value, label]) => ({ value, label }));
const optionsAnnees = computed(() => annees.value.map((a) => ({ label: a.libelle, value: a.id })));

// ------------------------------------------------------------------ chips
// FilterBar masque « Réinitialiser » tant qu'aucun chip personnalisé n'existe :
// chaque onglet décrit donc ses filtres actifs.
function chipRecherche(f: Record<string, any>): ChipFiltre[] {
  return f.recherche
    ? [{ label: t('cites.chips.recherche', { q: f.recherche }), value: f.recherche, icone: 'search', defaut: true }]
    : [];
}

const codeResidence = (id: string) => res.lignes.find((x) => x.id === id)?.code ?? '…';

const chipsResidences = computed<ChipFiltre[]>(() => {
  const f = filtresResidences.value;
  const cs = chipRecherche(f);
  if (f.capaciteMin) cs.push({ label: t('cites.residences.chips.capaciteMin', { n: f.capaciteMin }), value: f.capaciteMin, icone: 'bed' });
  if (f.actif) {
    cs.push({
      label: f.actif === 'true' ? t('cites.residences.filters.etatActives') : t('cites.residences.filters.etatInactives'),
      value: f.actif,
      icone: 'toggle_on',
      cle: 'actif',
    });
  }
  if (f.ville) cs.push({ label: t('cites.residences.chips.ville', { ville: f.ville }), value: f.ville, icone: 'place' });
  return cs;
});

const chipsChambres = computed<ChipFiltre[]>(() => {
  const f = filtresChambres.value;
  const cs = chipRecherche(f);
  if (f.residenceId) {
    cs.push({ label: t('cites.chambres.chips.residence', { code: codeResidence(f.residenceId) }), value: f.residenceId, icone: 'apartment' });
  }
  if (f.categorie) cs.push({ label: LIBELLE_CATEGORIE_CHAMBRE[f.categorie] ?? f.categorie, value: f.categorie, icone: 'category', cle: 'categorie' });
  if (f.statut) cs.push({ label: LIBELLE_STATUT_CHAMBRE[f.statut] ?? f.statut, value: f.statut, icone: 'meeting_room', cle: 'statut' });
  return cs;
});

const chipsAttributions = computed<ChipFiltre[]>(() => {
  const f = filtresAttributions.value;
  const cs: ChipFiltre[] = [];
  if (f.anneeId) {
    const a = annees.value.find((x) => x.id === f.anneeId);
    cs.push({ label: a?.libelle ?? t('cites.attributions.chips.anneeFallback'), value: f.anneeId, icone: 'event', cle: 'anneeId' });
  }
  if (f.statut) cs.push({ label: LIBELLE_STATUT_ATTRIBUTION[f.statut] ?? f.statut, value: f.statut, icone: 'how_to_reg', cle: 'statut' });
  if (f.residenceId) {
    cs.push({ label: t('cites.attributions.chips.residence', { code: codeResidence(f.residenceId) }), value: f.residenceId, icone: 'apartment' });
  }
  if (f.etudiant) cs.push({ label: t('cites.attributions.chips.etudiant', { etudiant: f.etudiant }), value: f.etudiant, icone: 'person' });
  return cs;
});

// ------------------------------------------------------------- colonnes
const colonnesResidences = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('cites.residences.table.columns.code'), field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: t('cites.residences.table.columns.nom'), field: 'nom', align: 'left', sortable: true },
  { name: 'ville', label: t('cites.residences.table.columns.ville'), field: 'ville', align: 'left' },
  { name: 'capacite', label: t('cites.residences.table.columns.capacite'), field: 'capacite', align: 'right', sortable: true },
  { name: 'responsable', label: t('cites.residences.table.columns.responsable'), field: 'responsable', align: 'left' },
  { name: 'statut', label: t('cites.residences.table.columns.statut'), field: 'actif', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesChambres = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('cites.chambres.table.columns.code'), field: 'code', align: 'left', sortable: true },
  { name: 'residence', label: t('cites.chambres.table.columns.residence'), field: 'residence', align: 'left' },
  { name: 'categorie', label: t('cites.chambres.table.columns.categorie'), field: 'categorie', align: 'left', sortable: true },
  { name: 'lits', label: t('cites.chambres.table.columns.lits'), field: 'lits', align: 'center' },
  { name: 'loyer', label: t('cites.chambres.table.columns.loyer'), field: 'loyer', align: 'right', sortable: true },
  { name: 'statut', label: t('cites.chambres.table.columns.statut'), field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const colonnesAttributions = computed<QTableColumn[]>(() => [
  { name: 'createdAt', label: t('cites.attributions.table.columns.demandeLe'), field: 'createdAt', align: 'left', sortable: true },
  { name: 'etudiant', label: t('cites.attributions.table.columns.etudiant'), field: 'id', align: 'left' },
  { name: 'chambre', label: t('cites.attributions.table.columns.chambre'), field: 'id', align: 'left' },
  { name: 'score', label: t('cites.attributions.table.columns.score'), field: 'critereScore', align: 'center' },
  { name: 'statut', label: t('cites.attributions.table.columns.statut'), field: 'statut', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

// ---------------------------------------------------------------- droits
const peutGererResidences = computed(() => auth.peut('cites.gererResidences'));
const peutGererChambres = computed(() => auth.peut('cites.gererChambres'));
const peutDecider = computed(() => auth.peut('cites.decider'));
const peutCreerAttribution = computed(() => auth.peut('cites.creerAttribution'));

const peutGerer = computed(() =>
  onglet.value === 'residences' ? peutGererResidences.value
    : onglet.value === 'chambres' ? peutGererChambres.value
      : peutCreerAttribution.value,
);

const boutonOnglet = computed(() =>
  onglet.value === 'residences' ? t('cites.actions.newResidence')
    : onglet.value === 'chambres' ? t('cites.actions.newChambre')
      : t('cites.actions.newAttribution'),
);

function ouvrirCourant() {
  if (onglet.value === 'residences') ouvrirResidence(null);
  else if (onglet.value === 'chambres') ouvrirChambre(null);
  else {
    // La page courante d'abord, puis tout le parc dès qu'il arrive : le
    // dialogue d'attribution doit pouvoir viser n'importe quelle chambre.
    chambresDialogue.value = ch.lignes;
    void ch.chargerTout().then((toutes) => (chambresDialogue.value = toutes)).catch(() => undefined);
    attributionDialog.value = true;
  }
}

/** Une décision ou un retrait change l'état des chambres et des résidences. */
const rechargerParc = () => Promise.all([att.recharger(), ch.recharger(), res.recharger()]);

// ----------------------------------------------------------- résidences
function ouvrirResidence(r: Residence | null) {
  residenceEditee.value = r;
  residenceDialog.value = true;
}

function supprimerResidence(r: Residence) {
  void supprimerAvecConfirmation(`/residences/${r.id}`, r.nom, res.recharger, {
    titre: t('cites.residences.dialogs.delete.title'),
    message: t('cites.residences.dialogs.delete.message', { nom: r.nom, code: r.code }),
    ok: t('cites.residences.dialogs.delete.confirm'),
    succes: t('cites.residences.dialogs.deleted'),
  });
}

const compteStatut = (r: Residence, statut: string) => (r.chambres ?? []).filter((c) => c.statut === statut).length;
const compteLibres = (r: Residence) => compteStatut(r, 'LIBRE');
const compteReservees = (r: Residence) => compteStatut(r, 'RESERVEE');
const compteOccupees = (r: Residence) => compteStatut(r, 'OCCUPEE');

// ---------------------------------------------------------------- chambres
function ouvrirChambre(c: Chambre | null) {
  chambreEditee.value = c;
  chambreDialog.value = true;
}

function supprimerChambre(c: Chambre) {
  void supprimerAvecConfirmation(`/chambres/${c.id}`, c.code, ch.recharger, {
    titre: t('cites.chambres.dialogs.delete.title'),
    message: t('cites.chambres.dialogs.delete.message', { code: c.code }),
    ok: t('cites.chambres.dialogs.delete.confirm'),
    succes: t('cites.chambres.dialogs.deleted'),
  });
}

// ------------------------------------------------------- décision du jury
const decisionDialog = ref(false);
const decision = ref<AttributionLogement | null>(null);
const decisionStatut = ref<'ACCORDEE' | 'REFUSEE'>('ACCORDEE');
const decisionMotif = ref('');
const decisionEnCours = ref(false);

function ouvrirDecision(a: AttributionLogement) {
  decision.value = a;
  decisionStatut.value = 'ACCORDEE';
  decisionMotif.value = '';
  decisionDialog.value = true;
}

async function decider() {
  if (!decision.value) return;
  decisionEnCours.value = true;
  try {
    // Le backend attend `commentaire` : envoyé sous « motif », il était
    // silencieusement écarté et le motif de la décision se perdait.
    await api.put(`/attributions-logement/${decision.value.id}/decider`, {
      statut: decisionStatut.value,
      commentaire: decisionMotif.value || undefined,
    });
    $q.notify({
      type: decisionStatut.value === 'ACCORDEE' ? 'positive' : 'info',
      message: decisionStatut.value === 'ACCORDEE'
        ? t('cites.attributions.dialogs.accorded')
        : t('cites.attributions.dialogs.refused'),
    });
    decisionDialog.value = false;
    await rechargerParc();
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    decisionEnCours.value = false;
  }
}

async function retirerAttribution(a: AttributionLogement) {
  const motif = await confirmerAvecSaisie({
    titre: t('cites.attributions.dialogs.retirer.title'),
    message: t('cites.attributions.dialogs.retirer.message', {
      etudiant: `${a.etudiant?.nom} ${a.etudiant?.prenom}`,
      code: a.chambre?.code,
      residence: a.chambre?.residence?.nom,
    }),
    libelleSaisie: t('cites.attributions.dialogs.retirer.motifLabel'),
    ok: t('cites.attributions.dialogs.retirer.confirm'),
    danger: true,
  });
  if (motif === null) return;
  try {
    await api.put(`/attributions-logement/${a.id}/retirer`, { motif: motif || undefined });
    $q.notify({ type: 'positive', message: t('cites.attributions.dialogs.withdrawn') });
    await rechargerParc();
  } catch {
    /* l'intercepteur axios affiche le motif */
  }
}

function voirEtudiant(a: AttributionLogement) {
  const e = a.etudiant;
  if (!e) return;
  const chambre = a.chambre
    ? t('cites.attributions.dialogs.etudiantDetail.chambreLine', {
        code: a.chambre.code,
        residence: a.chambre.residence?.nom ?? '—',
      })
    : '';
  $q.dialog({
    title: `${e.prenom} ${e.nom}`,
    message: t('cites.attributions.dialogs.etudiantDetail.message', {
      matricule: e.matricule,
      telephone: e.telephone ?? '—',
      email: e.email ?? '—',
      chambre,
    }),
    ok: { label: t('cites.attributions.dialogs.etudiantDetail.close'), flat: true },
  });
}

/** Résidence → ses chambres : on bascule d'onglet en portant le filtre. */
function voirChambresDe(r: Residence) {
  filtresChambres.value = { recherche: '', residenceId: r.id };
  onglet.value = 'chambres';
}

/**
 * Chambre → qui l'occupe. Le service ne filtre pas par chambre : on cadre sur
 * sa résidence et on rappelle le code recherché.
 */
function voirAttributionsDe(c: Chambre) {
  filtresAttributions.value = c.residenceId ? { residenceId: c.residenceId } : {};
  onglet.value = 'attributions';
  $q.notify({
    type: 'info',
    message: t('cites.attributions.notify.attributionsOfResidence', { code: c.code }),
  });
}

// ------------------------------------------------------------------ labels
const classeStatutChambre = (s: string) =>
  ({
    LIBRE: 'champ--present',
    RESERVEE: 'champ--retard',
    OCCUPEE: 'champ--attente',
    MAINTENANCE: 'champ--absent',
  })[s] ?? 'champ--attente';

const classeStatutAttribution = (s: string) =>
  ({
    EN_ATTENTE: 'champ--attente',
    ACCORDEE: 'champ--present',
    REFUSEE: 'champ--absent',
    RETIREE: 'champ--retard',
  })[s] ?? 'champ--attente';

const couleurScore = (score: number) =>
  (score >= 70 ? 'positive' : score >= 40 ? 'warning' : 'negative');

// ------------------------------------------------------------------ chargement
onMounted(async () => {
  const { data } = await api.get('/annees', { params: { all: '1' } });
  annees.value = data.data;
  const active = annees.value.find((a) => a.active);
  if (active) {
    anneeDefaut.value = active.id;
    // L'année venue de l'URL (retour arrière) prime sur l'année active.
    if (!filtresAttributions.value.anneeId) filtresAttributions.value.anneeId = active.id;
  }
});
</script>
