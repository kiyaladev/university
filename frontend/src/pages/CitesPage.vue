<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Cités universitaires</div>
        <div class="page-sous-titre">
          Attribution transparente des chambres — critères sociaux et mérite, pilotée avec le
          rectorat (Centre des Œuvres Universitaires)
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
      <q-tab name="residences" icon="apartment" label="Résidences" no-caps />
      <q-tab name="chambres" icon="meeting_room" label="Chambres" no-caps />
      <q-tab name="attributions" icon="how_to_reg" label="Attributions" no-caps />
    </q-tabs>

    <!-- ============================================================== -->
    <!-- RÉSIDENCES                                                       -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'residences'" name="residences" class="q-pa-none q-mt-md">
      <filter-bar
        v-model="filtresResidences"
        :chips="chipsResidences"
        placeholder="Rechercher (code, nom, ville, responsable…)"
        @reinitialiser="reinitialiserResidences"
      >
        <template #avances>
          <q-input
            v-model.number="filtresResidences.capaciteMin"
            type="number"
            min="0"
            dense
            outlined
            label="Capacité min"
            clearable
          />
          <q-select
            v-model="filtresResidences.actif"
            :options="[
              { label: 'Toutes', value: null },
              { label: 'Actives', value: 'true' },
              { label: 'Inactives', value: 'false' },
            ]"
            emit-value
            map-options
            dense
            outlined
            label="État"
          />
          <q-input
            v-model="filtresResidences.ville"
            dense
            outlined
            label="Ville"
            clearable
          />
        </template>
        <template #actions>
          <view-toggle cle="cites.residences" :modes="['tableau', 'cartes']" @update:mode="(v: string) => (modeResidences = v as 'tableau' | 'cartes')" />
        </template>
      </filter-bar>

      <!-- Vue tableau -->
      <q-table
        v-if="modeResidences === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="residencesFiltrees"
        :columns="colonnesResidences"
        row-key="id"
        :loading="chargementResidences"
        :rows-per-page-options="[0]"
        hide-bottom
      >
        <template #body-cell-statut="p">
          <q-td :props="p">
            <q-badge :color="p.row.actif ? 'positive' : 'grey-7'">
              {{ p.row.actif ? 'Active' : 'Inactive' }}
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
              aria-label="Voir les chambres de cette résidence"
              @click="voirChambresDe(p.row)"
            >
              <q-tooltip>Voir ses chambres</q-tooltip>
            </q-btn>
            <q-btn v-if="peutGererResidences" flat dense round icon="edit" aria-label="Modifier la résidence" @click="ouvrirResidence(p.row)">
              <q-tooltip>Modifier</q-tooltip>
            </q-btn>
            <q-btn v-if="auth.estAdmin" flat dense round color="negative" icon="delete" aria-label="Supprimer la résidence" @click="supprimerResidence(p.row)">
              <q-tooltip>Supprimer</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <div class="full-width text-center text-grey-7 q-pa-lg">
            <q-icon name="apartment" size="38px" color="grey-5" />
            <div class="q-mt-sm">Aucune résidence pour ces critères.</div>
            <div class="text-caption q-mt-xs">
              Une résidence porte les chambres ; les chambres portent les attributions.
            </div>
            <q-btn
              v-if="peutGererResidences"
              flat
              no-caps
              color="primary"
              icon="add"
              label="Nouvelle résidence"
              class="q-mt-sm"
              @click="ouvrirResidence(null)"
            />
          </div>
        </template>
      </q-table>

      <!-- Vue cartes -->
      <div v-else class="row q-col-gutter-md">
        <div v-if="chargementResidences" class="col-12 q-pa-md text-center">
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
                {{ r.actif ? 'Active' : 'Inactive' }}
              </q-badge>
            </q-card-section>
            <q-card-section class="q-pt-none q-gutter-y-xs">
              <div class="row items-center">
                <q-icon name="place" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">{{ r.ville ?? '—' }}</span>
              </div>
              <div class="row items-center">
                <q-icon name="bed" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">Capacité : {{ nombreLisible(r.capacite) }} lits</span>
              </div>
              <div class="row items-center q-gutter-xs">
                <q-icon name="meeting_room" size="16px" class="q-mr-sm text-grey-6" />
                <q-chip dense size="sm" color="positive" text-color="white">
                  {{ compteLibres(r) }} libres
                </q-chip>
                <q-chip dense size="sm" color="amber-8" text-color="white">
                  {{ compteReservees(r) }} réservées
                </q-chip>
                <q-chip dense size="sm" color="blue-grey-5" text-color="white">
                  {{ compteOccupees(r) }} occupées
                </q-chip>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions class="text-caption text-grey-7 q-px-md">
              <q-icon name="person_outline" size="16px" class="q-mr-xs" />
              {{ r.responsable ?? 'Aucun responsable renseigné' }}
              <q-space />
              <q-btn v-if="peutGererResidences" flat dense round size="sm" icon="edit" aria-label="Modifier la résidence" @click="ouvrirResidence(r)">
                <q-tooltip>Modifier</q-tooltip>
              </q-btn>
              <q-btn v-if="auth.estAdmin" flat dense round size="sm" color="negative" icon="delete" aria-label="Supprimer la résidence" @click="supprimerResidence(r)">
                <q-tooltip>Supprimer</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
        </div>
        <div v-if="!chargementResidences && !residencesFiltrees.length" class="col-12 text-center text-grey-7 q-pa-lg">
          <q-icon name="apartment" size="42px" color="grey-5" />
          <div class="q-mt-sm">Aucune résidence pour ces critères.</div>
          <q-btn
            v-if="peutGererResidences"
            flat
            no-caps
            color="primary"
            icon="add"
            label="Nouvelle résidence"
            class="q-mt-sm"
            @click="ouvrirResidence(null)"
          />
        </div>
      </div>
    </q-tab-panel>

    <!-- ============================================================== -->
    <!-- CHAMBRES                                                         -->
    <!-- ============================================================== -->
    <q-tab-panel v-if="onglet === 'chambres'" name="chambres" class="q-pa-none q-mt-md">
      <filter-bar
        v-model="filtresChambres"
        :chips="chipsChambres"
        placeholder="Rechercher (code de chambre…)"
        @reinitialiser="reinitialiserChambres"
      >
        <template #avances>
          <autocomplete-async
            v-model="filtresChambres.residenceId"
            endpoint="/residences"
            :label-fn="(r) => `${r.code} — ${r.nom}`"
            label="Résidence"
          />
          <q-select
            v-model="filtresChambres.categorie"
            :options="optionsCategories"
            emit-value
            map-options
            dense
            outlined
            clearable
            label="Catégorie"
          />
          <q-select
            v-model="filtresChambres.statut"
            :options="optionsStatutsChambre"
            emit-value
            map-options
            dense
            outlined
            clearable
            label="Statut"
          />
        </template>
        <template #actions>
          <view-toggle cle="cites.chambres" :modes="['tableau', 'cartes']" @update:mode="(v: string) => (modeChambres = v as 'tableau' | 'cartes')" />
        </template>
      </filter-bar>

      <pagination-bar
        :page="paginationChambres.page"
        :page-size="paginationChambres.pageSize"
        :total="paginationChambres.total"
        :show-all="false"
        @update:page="paginationChambres.page = $event; requeterChambres()"
        @update:page-size="paginationChambres.pageSize = $event; paginationChambres.page = 1; requeterChambres()"
        @tous="chargerToutChambres"
      />

      <!-- Vue tableau -->
      <q-table
        v-if="modeChambres === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="chambres"
        :columns="colonnesChambres"
        row-key="id"
        :loading="chargementChambres"
        :rows-per-page-options="[0]"
        hide-bottom
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
              aria-label="Voir les attributions de cette chambre"
              @click="voirAttributionsDe(p.row)"
            >
              <q-tooltip>Qui l'occupe ? (attributions)</q-tooltip>
            </q-btn>
            <q-btn v-if="peutGererChambres" flat dense round icon="edit" aria-label="Modifier la chambre" @click="ouvrirChambre(p.row)">
              <q-tooltip>Modifier</q-tooltip>
            </q-btn>
            <q-btn v-if="auth.estAdmin" flat dense round color="negative" icon="delete" aria-label="Supprimer la chambre" @click="supprimerChambre(p.row)">
              <q-tooltip>Supprimer</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <div class="full-width text-center text-grey-7 q-pa-lg">
            <q-icon name="meeting_room" size="38px" color="grey-5" />
            <div class="q-mt-sm">Aucune chambre pour ces critères.</div>
            <div class="text-caption q-mt-xs">
              Chaque chambre appartient à une résidence et porte son loyer.
            </div>
            <q-btn
              v-if="peutGererChambres"
              flat
              no-caps
              color="primary"
              icon="add"
              label="Nouvelle chambre"
              class="q-mt-sm"
              @click="ouvrirChambre(null)"
            />
          </div>
        </template>
      </q-table>

      <!-- Vue cartes -->
      <div v-else class="row q-col-gutter-md">
        <div v-if="chargementChambres" class="col-12 q-pa-md text-center">
          <q-spinner color="primary" />
        </div>
        <div v-for="c in chambres" :key="c.id" class="col-12 col-md-6 col-xl-4">
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
                <span class="text-caption">{{ c.lits }} lit{{ c.lits > 1 ? 's' : '' }}</span>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions class="text-caption text-grey-7 q-px-md">
              <q-icon name="payments" size="16px" class="q-mr-xs" />
              <span class="chiffres text-weight-medium">{{ montantLisible(c.loyer) }} {{ c.devise }}</span>
              <q-space />
              <q-btn v-if="peutGererChambres" flat dense round size="sm" icon="edit" aria-label="Modifier la chambre" @click="ouvrirChambre(c)">
                <q-tooltip>Modifier</q-tooltip>
              </q-btn>
              <q-btn v-if="auth.estAdmin" flat dense round size="sm" color="negative" icon="delete" aria-label="Supprimer la chambre" @click="supprimerChambre(c)">
                <q-tooltip>Supprimer</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
        </div>
        <div v-if="!chargementChambres && !chambres.length" class="col-12 text-center text-grey-7 q-pa-lg">
          <q-icon name="meeting_room" size="42px" color="grey-5" />
          <div class="q-mt-sm">Aucune chambre pour ces critères.</div>
          <q-btn
            v-if="peutGererChambres"
            flat
            no-caps
            color="primary"
            icon="add"
            label="Nouvelle chambre"
            class="q-mt-sm"
            @click="ouvrirChambre(null)"
          />
        </div>
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
        @reinitialiser="reinitialiserAttributions"
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
            label="Année"
          />
          <q-select
            v-model="filtresAttributions.statut"
            :options="optionsStatutsAttribution"
            emit-value
            map-options
            dense
            outlined
            clearable
            label="Statut"
          />
          <autocomplete-async
            v-model="filtresAttributions.residenceId"
            endpoint="/residences"
            :label-fn="(r) => `${r.code} — ${r.nom}`"
            label="Résidence"
          />
          <q-input
            v-model="filtresAttributions.etudiant"
            dense
            outlined
            label="Recherche étudiant (matricule, nom)"
            clearable
            @keydown.enter="requeterAttributions"
          />
        </template>
        <template #actions>
          <view-toggle cle="cites.attributions" :modes="['tableau', 'cartes']" @update:mode="(v: string) => (modeAttributions = v as 'tableau' | 'cartes')" />
        </template>
      </filter-bar>

      <pagination-bar
        :page="paginationAttributions.page"
        :page-size="paginationAttributions.pageSize"
        :total="paginationAttributions.total"
        :show-all="false"
        @update:page="paginationAttributions.page = $event; requeterAttributions()"
        @update:page-size="paginationAttributions.pageSize = $event; paginationAttributions.page = 1; requeterAttributions()"
        @tous="chargerToutesAttributions"
      />

      <!-- Vue tableau -->
      <q-table
        v-if="modeAttributions === 'tableau'"
        flat
        bordered
        class="carte"
        :rows="attributions"
        :columns="colonnesAttributions"
        row-key="id"
        :loading="chargementAttributions"
        :rows-per-page-options="[0]"
        hide-bottom
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
            <span v-else class="text-grey-6">—</span>
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
            <q-btn v-if="p.row.statut === 'EN_ATTENTE' && peutDecider" flat dense round color="primary" icon="gavel" aria-label="Décider de l'attribution" @click="ouvrirDecision(p.row)">
              <q-tooltip>Décider</q-tooltip>
            </q-btn>
            <q-btn v-if="['EN_ATTENTE', 'ACCORDEE'].includes(p.row.statut) && auth.estAdmin" flat dense round color="negative" icon="undo" aria-label="Retirer l'attribution" @click="retirerAttribution(p.row)">
              <q-tooltip>Retirer</q-tooltip>
            </q-btn>
            <q-btn v-if="p.row.etudiant" flat dense round icon="person" aria-label="Voir l'étudiant attributaire" @click="voirEtudiant(p.row)">
              <q-tooltip>Voir l'étudiant</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <div class="full-width text-center text-grey-7 q-pa-lg">
            <q-icon name="how_to_reg" size="38px" color="grey-5" />
            <div class="q-mt-sm">Aucune attribution pour ces critères.</div>
            <div class="text-caption q-mt-xs">
              Une demande naît « en attente », puis le jury l'accorde ou la refuse.
            </div>
            <q-btn
              v-if="peutCreerAttribution"
              flat
              no-caps
              color="primary"
              icon="how_to_reg"
              label="Nouvelle attribution"
              class="q-mt-sm"
              @click="ouvrirCourant"
            />
          </div>
        </template>
      </q-table>

      <!-- Vue cartes -->
      <div v-else class="row q-col-gutter-md">
        <div v-if="chargementAttributions" class="col-12 q-pa-md text-center">
          <q-spinner color="primary" />
        </div>
        <div v-for="a in attributions" :key="a.id" class="col-12 col-md-6 col-xl-4">
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
                  Chambre <strong>{{ a.chambre?.code }}</strong> — {{ a.chambre?.residence?.nom ?? '—' }}
                </span>
              </div>
              <div class="row items-center">
                <q-icon name="event" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">Demandé le {{ dateLisible(a.createdAt) }}</span>
              </div>
              <div class="row items-center">
                <q-icon name="workspace_premium" size="16px" class="q-mr-sm text-grey-6" />
                <span class="text-caption">Score :</span>
                <q-badge
                  v-if="a.critereScore !== null && a.critereScore !== undefined"
                  dense
                  :color="couleurScore(a.critereScore)"
                  text-color="white"
                  class="q-ml-xs"
                >
                  {{ a.critereScore }}
                </q-badge>
                <span v-else class="text-grey-6 q-ml-xs">—</span>
              </div>
            </q-card-section>
            <q-separator />
            <q-card-actions class="q-px-md">
              <q-btn v-if="a.statut === 'EN_ATTENTE' && peutDecider" flat dense no-caps color="primary" icon="gavel" label="Décider" @click="ouvrirDecision(a)">
                <q-tooltip>Accorder ou refuser</q-tooltip>
              </q-btn>
              <q-btn v-if="['EN_ATTENTE', 'ACCORDEE'].includes(a.statut) && auth.estAdmin" flat dense no-caps color="negative" icon="undo" label="Retirer" @click="retirerAttribution(a)">
                <q-tooltip>Retirer l'attribution</q-tooltip>
              </q-btn>
              <q-btn v-if="a.etudiant" flat dense no-caps icon="person" label="Étudiant" @click="voirEtudiant(a)">
                <q-tooltip>Voir la fiche de l'étudiant</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
        </div>
        <div v-if="!chargementAttributions && !attributions.length" class="col-12 text-center text-grey-7 q-pa-lg">
          <q-icon name="how_to_reg" size="42px" color="grey-5" />
          <div class="q-mt-sm">Aucune attribution pour ces critères.</div>
          <q-btn
            v-if="peutCreerAttribution"
            flat
            no-caps
            color="primary"
            icon="how_to_reg"
            label="Nouvelle attribution"
            class="q-mt-sm"
            @click="ouvrirCourant"
          />
        </div>
      </div>
    </q-tab-panel>

    <!-- Dialogues -->
    <residence-dialog v-model="residenceDialog" :residence="residenceEditee" @enregistre="chargerResidences" />
    <chambre-dialog v-model="chambreDialog" :chambre="chambreEditee" :residences="residences" @enregistre="chargerChambres" />
    <!-- `ouvrirCourant` recharge tout le parc avant d'ouvrir ce dialogue :
         l'attribution doit pouvoir viser une chambre hors de la page affichée. -->
    <attribution-dialog
      v-model="attributionDialog"
      :chambres="chambres"
      :annees="annees"
      :annee-defaut-id="anneeDefaut"
      @enregistre="chargerAttributions"
    />

    <!-- Dialog de décision du jury -->
    <q-dialog v-model="decisionDialog">
      <q-card style="width: 540px; max-width: 95vw">
        <q-card-section class="text-h6">Décision du jury</q-card-section>
        <q-card-section v-if="decision" class="q-pt-none text-caption text-grey-7">
          {{ decision.etudiant?.nom }} {{ decision.etudiant?.prenom }}
          <span v-if="decision.etudiant?.matricule"> — {{ decision.etudiant.matricule }}</span>
          <br />
          Chambre <strong>{{ decision.chambre?.code }}</strong>
          ({{ decision.chambre?.residence?.nom }})
          <template v-if="decision.critereScore !== null && decision.critereScore !== undefined">
            · score <strong>{{ decision.critereScore }}</strong>
          </template>
        </q-card-section>
        <q-card-section>
          <q-option-group
            v-model="decisionStatut"
            :options="[
              { label: 'Accorder la chambre', value: 'ACCORDEE', color: 'positive' },
              { label: 'Refuser la demande', value: 'REFUSEE', color: 'negative' },
            ]"
            inline
            class="q-mb-md"
          />
          <q-banner dense class="note--info q-mb-md">
            <template #avatar><q-icon name="info" /></template>
            <span v-if="decisionStatut === 'ACCORDEE'">
              La chambre passera <strong>OCCUPÉE</strong> et l'étudiant sera notifié.
            </span>
            <span v-else>
              La chambre redeviendra <strong>LIBRE</strong> et la demande sera classée.
            </span>
          </q-banner>
          <q-input
            v-model="decisionMotif"
            outlined
            dense
            type="textarea"
            label="Motif (optionnel)"
            :autogrow="true"
            rows="2"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn
            unelevated
            :color="decisionStatut === 'ACCORDEE' ? 'positive' : 'negative'"
            :icon="decisionStatut === 'ACCORDEE' ? 'check' : 'close'"
            :label="decisionStatut === 'ACCORDEE' ? 'Accorder' : 'Refuser'"
            :loading="decisionEnCours"
            @click="decider"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
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

const onglet = ref<'residences' | 'chambres' | 'attributions'>('residences');

const residences = ref<Residence[]>([]);
const chambres = ref<Chambre[]>([]);
const annees = ref<AnneeAcademique[]>([]);
const attributions = ref<AttributionLogement[]>([]);

const chargementResidences = ref(false);
const chargementChambres = ref(false);
const chargementAttributions = ref(false);

const residenceDialog = ref(false);
const residenceEditee = ref<Residence | null>(null);
const chambreDialog = ref(false);
const chambreEditee = ref<Chambre | null>(null);
const attributionDialog = ref(false);

const modeResidences = ref<'tableau' | 'cartes'>('cartes');
const modeChambres = ref<'tableau' | 'cartes'>('tableau');
const modeAttributions = ref<'tableau' | 'cartes'>('cartes');

const anneeDefaut = ref<string | null>(null);

// ---------------------------------------------------------------- filtres résidences
const filtresResidences = ref<Record<string, any>>({ recherche: '' });

// ---------------------------------------------------------------- filtres chambres
const filtresChambres = ref<Record<string, any>>({ recherche: '' });
const paginationChambres = ref({ page: 1, pageSize: 20, total: 0 });

const optionsCategories = computed(() =>
  Object.entries(LIBELLE_CATEGORIE_CHAMBRE).map(([value, label]) => ({ value, label })),
);
const optionsStatutsChambre = computed(() =>
  Object.entries(LIBELLE_STATUT_CHAMBRE).map(([value, label]) => ({ value, label })),
);

// ---------------------------------------------------------------- filtres attributions
const filtresAttributions = ref<Record<string, any>>({ recherche: '' });
const paginationAttributions = ref({ page: 1, pageSize: 20, total: 0 });

const optionsAnnees = computed(() =>
  annees.value.map((a) => ({ label: a.libelle, value: a.id })),
);
const optionsStatutsAttribution = computed(() =>
  Object.entries(LIBELLE_STATUT_ATTRIBUTION).map(([value, label]) => ({ value, label })),
);

// ------------------------------------------------------------------ chips
// FilterBar masque « Réinitialiser » tant qu'aucun chip personnalisé n'existe :
// chaque onglet décrit donc ses filtres actifs.
type Chip = ChipFiltre;

function chipRecherche(f: Record<string, any>): Chip[] {
  return f.recherche
    ? [{ label: `« ${f.recherche} »`, value: f.recherche, icone: 'search', defaut: true }]
    : [];
}

const chipsResidences = computed<Chip[]>(() => {
  const f = filtresResidences.value;
  const cs = chipRecherche(f);
  if (f.capaciteMin) cs.push({ label: `≥ ${f.capaciteMin} lits`, value: f.capaciteMin, icone: 'bed' });
  if (f.actif) {
    cs.push({ label: f.actif === 'true' ? 'Actives' : 'Inactives', value: f.actif, icone: 'toggle_on', cle: 'actif'});
  }
  if (f.ville) cs.push({ label: `Ville : ${f.ville}`, value: f.ville, icone: 'place' });
  return cs;
});

const chipsChambres = computed<Chip[]>(() => {
  const f = filtresChambres.value;
  const cs = chipRecherche(f);
  if (f.residenceId) {
    const r = residences.value.find((x) => x.id === f.residenceId);
    cs.push({ label: `Résidence : ${r?.code ?? '…'}`, value: f.residenceId, icone: 'apartment' });
  }
  if (f.categorie) {
    cs.push({
      label: LIBELLE_CATEGORIE_CHAMBRE[f.categorie] ?? f.categorie,
      value: f.categorie,
      icone: 'category', cle: 'categorie'});
  }
  if (f.statut) {
    cs.push({
      label: LIBELLE_STATUT_CHAMBRE[f.statut] ?? f.statut,
      value: f.statut,
      icone: 'meeting_room', cle: 'statut'});
  }
  return cs;
});

const chipsAttributions = computed<Chip[]>(() => {
  const f = filtresAttributions.value;
  const cs: Chip[] = [];
  if (f.anneeId) {
    const a = annees.value.find((x) => x.id === f.anneeId);
    cs.push({ label: a?.libelle ?? 'Année', value: f.anneeId, icone: 'event', cle: 'anneeId'});
  }
  if (f.statut) {
    cs.push({
      label: LIBELLE_STATUT_ATTRIBUTION[f.statut] ?? f.statut,
      value: f.statut,
      icone: 'how_to_reg', cle: 'statut'});
  }
  if (f.residenceId) {
    const r = residences.value.find((x) => x.id === f.residenceId);
    cs.push({ label: `Résidence : ${r?.code ?? '…'}`, value: f.residenceId, icone: 'apartment' });
  }
  if (f.etudiant) cs.push({ label: `Étudiant : ${f.etudiant}`, value: f.etudiant, icone: 'person' });
  return cs;
});

watch(filtresChambres, () => {
  paginationChambres.value.page = 1;
  requeterChambres();
}, { deep: true });

watch(filtresAttributions, () => {
  paginationAttributions.value.page = 1;
  requeterAttributions();
}, { deep: true });

// ------------------------------------------------------------- colonnes
const colonnesResidences: QTableColumn[] = [
  { name: 'code', label: 'Code', field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: 'Nom', field: 'nom', align: 'left', sortable: true },
  { name: 'ville', label: 'Ville', field: 'ville', align: 'left' },
  { name: 'capacite', label: 'Capacité', field: 'capacite', align: 'right', sortable: true },
  { name: 'responsable', label: 'Responsable', field: 'responsable', align: 'left' },
  { name: 'statut', label: 'État', field: 'actif', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesChambres: QTableColumn[] = [
  { name: 'code', label: 'Code', field: 'code', align: 'left', sortable: true },
  { name: 'residence', label: 'Résidence', field: 'residence', align: 'left' },
  { name: 'categorie', label: 'Catégorie', field: 'categorie', align: 'left', sortable: true },
  { name: 'lits', label: 'Lits', field: 'lits', align: 'center' },
  { name: 'loyer', label: 'Loyer', field: 'loyer', align: 'right', sortable: true },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesAttributions: QTableColumn[] = [
  { name: 'createdAt', label: 'Demandé le', field: 'createdAt', align: 'left', sortable: true },
  { name: 'etudiant', label: 'Étudiant', field: 'id', align: 'left' },
  { name: 'chambre', label: 'Chambre', field: 'id', align: 'left' },
  { name: 'score', label: 'Score', field: 'critereScore', align: 'center' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

// ---------------------------------------------------------------- droits
const peutGererResidences = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutGererChambres = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));
const peutDecider = computed(() => auth.aRole(['ADMIN', 'DIRECTION']));
const peutCreerAttribution = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));

const peutGerer = computed(() =>
  onglet.value === 'residences' ? peutGererResidences.value
    : onglet.value === 'chambres' ? peutGererChambres.value
      : peutCreerAttribution.value,
);

const boutonOnglet = computed(() =>
  onglet.value === 'residences' ? 'Nouvelle résidence'
    : onglet.value === 'chambres' ? 'Nouvelle chambre'
      : 'Nouvelle attribution',
);

function ouvrirCourant() {
  if (onglet.value === 'residences') ouvrirResidence(null);
  else if (onglet.value === 'chambres') ouvrirChambre(null);
  else {
    // Recharge toutes les chambres (non filtrées par la page courante) pour
    // que le dialogue d'attribution propose la totalité du parc.
    void api.get('/chambres', { params: { all: '1' } }).then(({ data }) => {
      chambres.value = data.data ?? chambres.value;
    }).catch(() => undefined);
    attributionDialog.value = true;
  }
}

// ----------------------------------------------------------- résidences
function ouvrirResidence(r: Residence | null) {
  residenceEditee.value = r;
  residenceDialog.value = true;
}

function supprimerResidence(r: Residence) {
  $q.dialog({
    title: 'Supprimer la résidence',
    message: `Supprimer définitivement ${r.nom} (${r.code}) ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/residences/${r.id}`);
    $q.notify({ type: 'positive', message: 'Résidence supprimée' });
    await chargerResidences();
  });
}

const chambresResidence = (r: Residence) => r.chambres ?? [];
const compteLibres = (r: Residence) => chambresResidence(r).filter((c) => c.statut === 'LIBRE').length;
const compteReservees = (r: Residence) => chambresResidence(r).filter((c) => c.statut === 'RESERVEE').length;
const compteOccupees = (r: Residence) => chambresResidence(r).filter((c) => c.statut === 'OCCUPEE').length;

const residencesFiltrees = computed(() => {
  const f = filtresResidences.value;
  const q = (f.recherche ?? '').toString().trim().toLowerCase();
  const capMin = f.capaciteMin;
  const actif = f.actif;
  const ville = (f.ville ?? '').toString().trim().toLowerCase();
  return residences.value.filter((r) => {
    if (capMin !== null && capMin !== undefined && r.capacite < Number(capMin)) return false;
    if (actif === 'true' && !r.actif) return false;
    if (actif === 'false' && r.actif) return false;
    if (ville && !(r.ville ?? '').toLowerCase().includes(ville)) return false;
    if (q) {
      const blob = `${r.code} ${r.nom} ${r.ville ?? ''} ${r.responsable ?? ''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
});

function reinitialiserResidences() {
  filtresResidences.value = { recherche: filtresResidences.value.recherche ?? '' };
}

// ---------------------------------------------------------------- chambres
function ouvrirChambre(c: Chambre | null) {
  chambreEditee.value = c;
  chambreDialog.value = true;
}

function supprimerChambre(c: Chambre) {
  $q.dialog({
    title: 'Supprimer la chambre',
    message: `Supprimer définitivement la chambre ${c.code} ?`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    await api.delete(`/chambres/${c.id}`);
    $q.notify({ type: 'positive', message: 'Chambre supprimée' });
    await chargerChambres();
  });
}

function reinitialiserChambres() {
  filtresChambres.value = { recherche: filtresChambres.value.recherche ?? '' };
}

async function requeterChambres() {
  chargementChambres.value = true;
  try {
    const f = filtresChambres.value;
    const params: Record<string, any> = {
      page: paginationChambres.value.page,
      pageSize: paginationChambres.value.pageSize,
      search: (f.recherche ?? '').toString().trim() || undefined,
      residenceId: f.residenceId || undefined,
      categorie: f.categorie || undefined,
      statut: f.statut || undefined,
    };
    const { data } = await api.get('/chambres', { params });
    chambres.value = data.data;
    paginationChambres.value.total = data.total;
  } finally {
    chargementChambres.value = false;
  }
}

async function chargerToutChambres() {
  paginationChambres.value.page = 1;
  paginationChambres.value.pageSize = Math.max(paginationChambres.value.total, 200) || 200;
  await requeterChambres();
}

// ------------------------------------------------------------- attributions
function reinitialiserAttributions() {
  filtresAttributions.value = { recherche: filtresAttributions.value.recherche ?? '' };
}

async function requeterAttributions() {
  chargementAttributions.value = true;
  try {
    const f = filtresAttributions.value;
    const params: Record<string, any> = {
      page: paginationAttributions.value.page,
      pageSize: paginationAttributions.value.pageSize,
      anneeId: f.anneeId || undefined,
      statut: f.statut || undefined,
      residenceId: f.residenceId || undefined,
      search: (f.etudiant ?? '').toString().trim() || undefined,
    };
    const { data } = await api.get('/attributions-logement', { params });
    attributions.value = data.data;
    paginationAttributions.value.total = data.total;
  } finally {
    chargementAttributions.value = false;
  }
}

async function chargerToutesAttributions() {
  paginationAttributions.value.page = 1;
  paginationAttributions.value.pageSize = Math.max(paginationAttributions.value.total, 200) || 200;
  await requeterAttributions();
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
        ? 'Attribution accordée — chambre occupée'
        : 'Demande refusée',
    });
    decisionDialog.value = false;
    await Promise.all([chargerAttributions(), chargerChambres(), chargerResidences()]);
  } finally {
    decisionEnCours.value = false;
  }
}

function retirerAttribution(a: AttributionLogement) {
  const etudiant = `${a.etudiant?.nom} ${a.etudiant?.prenom}`;
  $q.dialog({
    title: 'Retirer l’attribution',
    message: `Retirer l’attribution de ${etudiant} pour la chambre ${a.chambre?.code} (${a.chambre?.residence?.nom}) ?`,
    prompt: { model: '', type: 'text', label: 'Motif du retrait (facultatif)' },
    cancel: true,
    ok: { color: 'negative', label: 'Retirer', unelevated: true },
  }).onOk(async (motif: string) => {
    await api.put(`/attributions-logement/${a.id}/retirer`, { motif: motif || undefined });
    $q.notify({ type: 'positive', message: 'Attribution retirée' });
    await Promise.all([chargerAttributions(), chargerChambres(), chargerResidences()]);
  });
}

function voirEtudiant(a: AttributionLogement) {
  const e = a.etudiant;
  if (!e) return;
  const chambre = a.chambre
    ? `\nChambre : ${a.chambre.code} (${a.chambre.residence?.nom ?? '—'})`
    : '';
  $q.dialog({
    title: `${e.prenom} ${e.nom}`,
    message:
      `Matricule : ${e.matricule}\nTéléphone : ${e.telephone ?? '—'}\n`
      + `E-mail : ${e.email ?? '—'}${chambre}`,
    ok: { label: 'Fermer', flat: true },
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
  filtresAttributions.value = {
    ...(c.residenceId ? { residenceId: c.residenceId } : {}),
  };
  onglet.value = 'attributions';
  $q.notify({
    type: 'info',
    message: `Attributions de la résidence — repérez la chambre ${c.code}`,
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
async function chargerResidences() {
  chargementResidences.value = true;
  try {
    const { data } = await api.get('/residences', { params: { all: '1' } });
    residences.value = data.data;
  } finally {
    chargementResidences.value = false;
  }
}

async function chargerChambres() {
  await requeterChambres();
}

async function chargerAttributions() {
  await requeterAttributions();
}

onMounted(async () => {
  await Promise.all([
    chargerResidences(),
    chargerChambres(),
    (async () => {
      const { data } = await api.get('/annees', { params: { all: '1' } });
      annees.value = data.data;
      const active = annees.value.find((a) => a.active);
      if (active) {
        anneeDefaut.value = active.id;
        filtresAttributions.value.anneeId = active.id;
      }
    })(),
    chargerAttributions(),
  ]);
});
</script>
