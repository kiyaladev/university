<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Patrimoine & matériel</div>
        <div class="page-sous-titre">
          L'inventaire des équipements de l'université. Chaque pièce porte un QR
          d'inventaire, une valeur d'acquisition et un carnet de réparations qui
          la suit de sa mise en service à sa réforme.
        </div>
      </div>
      <div class="col-auto" v-if="onglet === 'equipements' && auth.peutPlanifier">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvel équipement"
          @click="ouvrirEquipement(null)"
        />
      </div>
      <div class="col-auto" v-if="onglet === 'categories' && auth.peutPlanifier">
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvelle catégorie"
          @click="ouvrirCategorie(null)"
        />
      </div>
    </div>

    <liens-croises
      :liens="[
        { to: '/rectorat', libelle: 'Tableau de bord Rectorat', icone: 'dashboard', aide: 'Les obsolescences ci-dessous, dans la vue d’ensemble de la direction' },
        { to: '/helpdesk', libelle: 'Support IT', icone: 'support_agent', aide: 'Les incidents déclarés sur ces mêmes équipements' },
        { to: '/salles', libelle: 'Salles', icone: 'meeting_room', aide: 'Les lieux où le matériel est affecté' },
      ]"
    />

    <!-- Les mêmes trois chiffres que le Tableau de bord Rectorat, à la source. -->
    <div v-if="synthese" class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-4">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ nombreLisible(synthese.total, 0) }}</div>
            <div class="pochoir text-grey-7">équipements en service</div>
            <div class="text-caption text-grey-6">
              valeur d'acquisition {{ montantLisible(synthese.valeur) }} GNF
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ nombreLisible(synthese.enReparation, 0) }}</div>
            <div class="pochoir text-grey-7">en réparation</div>
            <div class="text-caption text-grey-6">carnet ouvert, pièce indisponible</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="text-center">
            <div class="stat-chiffre chiffres">{{ nombreLisible(synthese.obsoletes, 0) }}</div>
            <div class="pochoir text-grey-7">obsolètes</div>
            <div class="text-caption text-grey-6">
              âge supérieur à la durée d'amortissement de leur catégorie
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-tabs
      v-model="onglet"
      dense
      align="left"
      narrow-indicator
      class="onglets-panneau q-mb-md"
    >
      <q-tab name="equipements" icon="inventory_2" label="Équipements" no-caps />
      <q-tab name="categories" icon="category" label="Catégories" no-caps />
      <q-tab name="reparations" icon="build" label="Réparations" no-caps />
    </q-tabs>

    <!-- ============================== Équipements -->
    <template v-if="onglet === 'equipements'">
      <filter-bar
        v-model="filtres"
        placeholder="Rechercher (libellé, n° série, n° d'inventaire, QR…)"
        :recherche="true"
        @reinitialiser="reinitialiserFiltres"
      >
        <template #avances>
          <autocomplete-async
            v-model="filtres.categorieId"
            label="Catégorie"
            endpoint="/patrimoine/categories"
            :label-fn="(c) => `${c.libelle} (${c.code})`"
            preload
          />
          <autocomplete-async
            v-model="filtres.departementId"
            label="Département"
            endpoint="/departements"
            :label-fn="(d) => d.nom"
            preload
          />
          <q-select
            v-model="filtres.actif"
            :options="[
              { label: 'En service', value: 'true' },
              { label: 'Hors service', value: 'false' },
            ]"
            dense
            outlined
            emit-value
            map-options
            clearable
            label="Statut"
          />
          <q-select
            v-model="filtres.enReparation"
            :options="[
              { label: 'En réparation', value: 'true' },
              { label: 'Disponible', value: 'false' },
            ]"
            dense
            outlined
            emit-value
            map-options
            clearable
            label="État"
          />
        </template>
        <template #actions>
          <view-toggle
            cle="patrimoine.equipements"
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
        :loading="chargement"
        :rows-per-page-options="[0]"
        hide-bottom
      >
        <template #body-cell-libelle="p">
          <q-td :props="p">
            <div class="text-weight-medium">{{ p.row.libelle }}</div>
            <div class="text-caption text-grey-7">{{ p.row.numeroInventaire }}</div>
          </q-td>
        </template>
        <template #body-cell-categorie="p">
          <q-td :props="p">
            <q-chip dense color="primary" text-color="white">
              {{ p.row.categorie?.libelle ?? '—' }}
            </q-chip>
          </q-td>
        </template>
        <template #body-cell-valeur="p">
          <q-td :props="p" class="text-right chiffres">
            <span v-if="p.row.valeurAcquisition != null">
              {{ montantLisible(p.row.valeurAcquisition) }} <span class="text-caption">GNF</span>
            </span>
            <span v-else class="text-grey-6">—</span>
          </q-td>
        </template>
        <template #body-cell-etat="p">
          <q-td :props="p">
            <q-chip
              dense
              :color="p.row.enReparation ? 'warning' : p.row.actif ? 'positive' : 'grey-7'"
              text-color="white"
            >
              {{
                p.row.enReparation
                  ? 'En réparation'
                  : p.row.actif
                  ? 'En service'
                  : 'Hors service'
              }}
            </q-chip>
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              flat
              dense
              round
              icon="visibility"
              :aria-label="`Détails de ${p.row.libelle}`"
              @click="voirDetails(p.row)"
            >
              <q-tooltip>Détails et carnet de réparations</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              icon="print"
              :aria-label="`Imprimer l'étiquette de ${p.row.libelle}`"
              @click="imprimerEtiquette(p.row)"
            >
              <q-tooltip>Étiquette d'inventaire (A4)</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.peutPlanifier && !p.row.enReparation"
              flat
              dense
              round
              icon="build"
              :aria-label="`Déclarer une réparation sur ${p.row.libelle}`"
              @click="ouvrirReparation(p.row, 'declarer')"
            >
              <q-tooltip>Déclarer une réparation</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.peutPlanifier"
              flat
              dense
              round
              icon="edit"
              :aria-label="`Modifier ${p.row.libelle}`"
              @click="ouvrirEquipement(p.row)"
            >
              <q-tooltip>Modifier</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.estAdmin"
              flat
              dense
              round
              color="negative"
              icon="delete"
              :aria-label="`Supprimer ${p.row.libelle}`"
              @click="supprimerEquipement(p.row)"
            >
              <q-tooltip>Supprimer</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <div class="etat-vide">
            <q-icon name="inventory_2" size="36px" />
            <div class="text-subtitle2 q-mt-sm">Aucun équipement</div>
            <div class="text-caption">
              L'inventaire recense le matériel de l'université, pièce par pièce.
              {{ aDesFiltres ? 'Aucune ne correspond aux filtres en cours.' : '' }}
            </div>
            <q-btn
              v-if="aDesFiltres"
              flat
              dense
              no-caps
              color="primary"
              icon="filter_alt_off"
              label="Retirer les filtres"
              @click="reinitialiserFiltres"
            />
            <q-btn
              v-else-if="auth.peutPlanifier"
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Enregistrer le premier équipement"
              @click="ouvrirEquipement(null)"
            />
          </div>
        </template>
      </q-table>

      <div v-else class="row q-col-gutter-md">
        <div
          v-for="e in equipements"
          :key="e.id"
          class="col-12 col-sm-6 col-md-4 col-lg-3"
        >
          <q-card flat bordered class="carte full-height">
            <q-card-section>
              <div class="text-h6 ellipsis">{{ e.libelle }}</div>
              <div class="text-caption text-grey-7">{{ e.numeroInventaire }}</div>
            </q-card-section>
            <q-card-section class="row items-center">
              <div class="col-4 text-center">
                <canvas :ref="(el) => enregistrerCanvas(el, e)" />
              </div>
              <div class="col-8">
                <q-chip dense color="primary" text-color="white">
                  {{ e.categorie?.libelle ?? '—' }}
                </q-chip>
                <div class="text-caption text-grey-7 q-mt-xs">
                  {{ e.departement?.nom ?? 'Sans département' }}
                </div>
                <div class="text-caption text-grey-7" v-if="e.valeurAcquisition != null">
                  {{ montantLisible(e.valeurAcquisition) }} GNF
                </div>
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
              <q-chip
                dense
                :color="e.enReparation ? 'warning' : e.actif ? 'positive' : 'grey-7'"
                text-color="white"
              >
                {{
                  e.enReparation
                    ? 'En réparation'
                    : e.actif
                    ? 'En service'
                    : 'Hors service'
                }}
              </q-chip>
            </q-card-section>
            <q-separator />
            <q-card-actions align="right">
              <q-btn flat dense round icon="visibility" @click="voirDetails(e)">
                <q-tooltip>Détails</q-tooltip>
              </q-btn>
              <q-btn flat dense round icon="print" @click="imprimerEtiquette(e)">
                <q-tooltip>Étiquette A4</q-tooltip>
              </q-btn>
              <q-btn
                v-if="auth.peutPlanifier && !e.enReparation"
                flat
                dense
                round
                icon="build"
                :aria-label="`Déclarer une réparation sur ${e.libelle}`"
                @click="ouvrirReparation(e, 'declarer')"
              >
                <q-tooltip>Déclarer une réparation</q-tooltip>
              </q-btn>
              <q-btn
                v-if="auth.peutPlanifier"
                flat
                dense
                round
                icon="edit"
                :aria-label="`Modifier ${e.libelle}`"
                @click="ouvrirEquipement(e)"
              >
                <q-tooltip>Modifier</q-tooltip>
              </q-btn>
            </q-card-actions>
          </q-card>
        </div>
        <div v-if="!equipements.length && !chargement" class="col-12">
          <div class="etat-vide">
            <q-icon name="inventory_2" size="36px" />
            <div class="text-subtitle2 q-mt-sm">Aucun équipement</div>
            <div class="text-caption">
              L'inventaire recense le matériel de l'université, pièce par pièce.
              {{ aDesFiltres ? 'Aucune ne correspond aux filtres en cours.' : '' }}
            </div>
            <q-btn
              v-if="aDesFiltres"
              flat
              dense
              no-caps
              color="primary"
              icon="filter_alt_off"
              label="Retirer les filtres"
              @click="reinitialiserFiltres"
            />
            <q-btn
              v-else-if="auth.peutPlanifier"
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Enregistrer le premier équipement"
              @click="ouvrirEquipement(null)"
            />
          </div>
        </div>
      </div>

      <pagination-bar
        :page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :show-all="false"
        @update:page="pagination.page = $event; chargerEquipements()"
        @update:page-size="pagination.pageSize = $event; pagination.page = 1; chargerEquipements()"
      />
    </template>

    <!-- ============================== Catégories -->
    <template v-if="onglet === 'categories'">
      <q-table
        flat
        bordered
        class="carte"
        :rows="categories"
        :columns="colonnesCategories"
        row-key="id"
        :loading="chargementCategories"
        :pagination="{ rowsPerPage: 20 }"
      >
        <template #body-cell-equipements="p">
          <q-td :props="p" class="text-right chiffres">
            {{ p.row._count?.equipements ?? 0 }}
          </q-td>
        </template>
        <template #body-cell-actions="p">
          <q-td :props="p" class="text-right">
            <q-btn
              v-if="auth.peutPlanifier"
              flat
              dense
              round
              icon="edit"
              :aria-label="`Modifier la catégorie ${p.row.libelle}`"
              @click="ouvrirCategorie(p.row)"
            >
              <q-tooltip>Modifier</q-tooltip>
            </q-btn>
            <q-btn
              v-if="auth.estAdmin"
              flat
              dense
              round
              color="negative"
              icon="delete"
              :aria-label="`Supprimer la catégorie ${p.row.libelle}`"
              @click="supprimerCategorie(p.row)"
            >
              <q-tooltip>Supprimer</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #no-data>
          <div class="etat-vide">
            <q-icon name="category" size="36px" />
            <div class="text-subtitle2 q-mt-sm">Aucune catégorie</div>
            <div class="text-caption">
              Une catégorie regroupe un type de matériel et porte sa durée
              d'amortissement : c'est elle qui décide quand un équipement devient
              obsolète. Sans catégorie, aucun équipement ne peut être enregistré.
            </div>
            <q-btn
              v-if="auth.peutPlanifier"
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="Créer la première catégorie"
              @click="ouvrirCategorie(null)"
            />
          </div>
        </template>
      </q-table>
    </template>

    <!-- ============================== Réparations -->
    <template v-if="onglet === 'reparations'">
      <q-card flat bordered class="carte">
        <q-card-section>
          <div class="text-subtitle2">Réparations en cours</div>
          <div class="text-caption text-grey-7">
            Badge de délai : vert < 7 jours, orange < 30 jours, rouge au-delà
          </div>
        </q-card-section>
        <q-table
          flat
          bordered
          :rows="reparationsEnCours"
          :columns="colonnesReparations"
          row-key="id"
          :loading="chargementReparations"
          :pagination="{ rowsPerPage: 20 }"
          hide-bottom
        >
          <template #body-cell-equipement="p">
            <q-td :props="p">
              <div class="text-weight-medium">{{ p.row.equipement?.libelle ?? '—' }}</div>
              <div class="text-caption text-grey-7">
                {{ p.row.equipement?.numeroInventaire ?? '—' }}
              </div>
            </q-td>
          </template>
          <template #body-cell-statut="p">
            <q-td :props="p">
              <q-chip
                dense
                :color="p.row.statut === 'EN_COURS' ? 'warning' : 'grey-7'"
                :text-color="p.row.statut === 'EN_COURS' ? 'dark' : 'white'"
              >
                {{ libelleStatutReparation(p.row.statut) }}
              </q-chip>
            </q-td>
          </template>
          <template #body-cell-declarLe="p">
            <q-td :props="p">
              {{ dateLisible(p.row.dateDeclaration) }}
            </q-td>
          </template>
          <template #body-cell-delai="p">
            <q-td :props="p">
              <q-chip
                dense
                :color="couleurDelai(joursEcarts(p.row.dateDeclaration))"
                :text-color="couleurDelai(joursEcarts(p.row.dateDeclaration)) === 'warning' ? 'dark' : 'white'"
              >
                {{ joursEcarts(p.row.dateDeclaration) }} j
              </q-chip>
            </q-td>
          </template>
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <q-btn
                v-if="auth.peutPlanifier"
                flat
                dense
                round
                color="positive"
                icon="check_circle"
                :aria-label="`Clore la réparation de ${p.row.equipement?.libelle ?? 'l’équipement'}`"
                @click="resoudreReparation(p.row)"
              >
                <q-tooltip>Marquer la réparation résolue</q-tooltip>
              </q-btn>
            </q-td>
          </template>
          <template #no-data>
            <div class="etat-vide">
              <q-icon name="build" size="36px" />
              <div class="text-subtitle2 q-mt-sm">Aucune réparation en cours</div>
              <div class="text-caption">
                Tout le matériel en service est disponible. Une réparation se
                déclare depuis la fiche d'un équipement, dans l'onglet Équipements.
              </div>
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                icon="inventory_2"
                label="Aller aux équipements"
                @click="onglet = 'equipements'"
              />
            </div>
          </template>
        </q-table>
      </q-card>
    </template>

    <patrimoine-dialog
      v-model="dialogEquipement"
      :equipement="equipementEdite"
      @enregistre="() => { chargerEquipements(); chargerSynthese(); }"
    />

    <q-dialog v-model="dialogCategorie">
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ categorieEditee ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="formCategorie.code"
            outlined
            dense
            label="Code *"
            hint="Ex. : VIDEO, MICRO, ORDI"
            class="q-mb-md"
          />
          <q-input
            v-model="formCategorie.libelle"
            outlined
            dense
            label="Libellé *"
            hint="Ex. : Vidéoprojecteur"
            class="q-mb-md"
          />
          <q-input
            v-model.number="formCategorie.dureeAmortissement"
            type="number"
            min="1"
            outlined
            dense
            label="Durée d'amortissement (mois)"
            hint="Ex. : 60 (5 ans)"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            label="Enregistrer"
            :loading="enregistrementCategorie"
            :disable="formCategorie.code.length < 2 || formCategorie.libelle.length < 2"
            @click="enregistrerCategorie"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <reparation-dialog
      v-model="dialogReparation"
      :mode="modeReparation"
      :equipement="equipementReparation"
      :reparation-ouverte="reparationOuverte"
      @enregistre="() => { chargerReparations(); chargerEquipements(); chargerSynthese(); }"
    />

    <q-dialog v-model="dialogDetails">
      <q-card style="width: 720px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">{{ equipementDetail?.libelle }}</div>
            <div class="text-caption text-grey-7">{{ equipementDetail?.numeroInventaire }}</div>
          </div>
          <q-btn flat dense round icon="close" v-close-popup />
        </q-card-section>
        <q-card-section v-if="equipementDetail">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-4 text-center">
              <canvas :ref="(el) => enregistrerCanvasDetail(el)" />
              <div class="text-caption text-grey-7 q-mt-xs">
                {{ equipementDetail.qrCode }}
              </div>
            </div>
            <div class="col-12 col-sm-8">
              <q-list dense>
                <q-item><q-item-section avatar><q-icon name="category" /></q-item-section><q-item-section>{{ equipementDetail.categorie?.libelle }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="tag" /></q-item-section><q-item-section>{{ equipementDetail.numeroSerie }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="apartment" /></q-item-section><q-item-section>{{ equipementDetail.departement?.nom ?? '—' }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="meeting_room" /></q-item-section><q-item-section>{{ equipementDetail.salle ? `${equipementDetail.salle.code} — ${equipementDetail.salle.nom}` : '—' }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="shopping_cart" /></q-item-section><q-item-section>{{ equipementDetail.dateAcquisition ? dateLisible(equipementDetail.dateAcquisition) : '—' }}</q-item-section></q-item>
                <q-item><q-item-section avatar><q-icon name="payments" /></q-item-section><q-item-section>{{ equipementDetail.valeurAcquisition != null ? `${montantLisible(equipementDetail.valeurAcquisition)} GNF` : '—' }}</q-item-section></q-item>
              </q-list>
            </div>
          </div>
        </q-card-section>
        <q-card-section v-if="reparationsDetail.length">
          <div class="text-subtitle2 q-mb-sm">Carnet de réparations</div>
          <q-list separator>
            <q-item v-for="r in reparationsDetail" :key="r.id">
              <q-item-section>
                <q-item-label>{{ r.description }}</q-item-label>
                <q-item-label caption>
                  {{ dateLisible(r.dateDeclaration) }}
                  <template v-if="r.prestataire"> · {{ r.prestataire }}</template>
                  <template v-if="r.cout"> · {{ montantLisible(r.cout) }} GNF</template>
                </q-item-label>
                <q-item-label caption v-if="r.notes">
                  <em>{{ r.notes }}</em>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip
                  dense
                  :color="r.statut === 'TERMINE' ? 'positive' : r.statut === 'ANNULE' ? 'grey-7' : 'warning'"
                  text-color="white"
                >
                  {{ libelleStatutReparation(r.statut) }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import QRCode from 'qrcode';
import { API_URL } from '../boot/axios';
import { patrimoineService } from '../services/patrimoine';
import { useAuthStore } from '../stores/auth';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import LiensCroises from '../components/LiensCroises.vue';
import PatrimoineDialog from '../components/PatrimoineDialog.vue';
import ReparationDialog from '../components/ReparationDialog.vue';
import { dateLisible, montantLisible, nombreLisible } from '../utils/libelles';
import type {
  CategoriePatrimoine,
  EquipementPatrimoine,
  ReparationMateriel,
  StatutReparation,
  TableauBordPatrimoine,
} from '../types';

const $q = useQuasar();
const auth = useAuthStore();

const onglet = ref<'equipements' | 'categories' | 'reparations'>('equipements');

const equipements = ref<EquipementPatrimoine[]>([]);
const pagination = ref({ page: 1, pageSize: 20, total: 0 });
const filtres = ref<Record<string, any>>({ recherche: '' });
const modeEquipements = ref<'tableau' | 'cartes'>('tableau');
const chargement = ref(false);

const categories = ref<CategoriePatrimoine[]>([]);
const chargementCategories = ref(false);

const reparationsEnCours = ref<ReparationMateriel[]>([]);
const reparationsDetail = ref<ReparationMateriel[]>([]);
const chargementReparations = ref(false);

const dialogEquipement = ref(false);
const equipementEdite = ref<EquipementPatrimoine | null>(null);

const dialogCategorie = ref(false);
const categorieEditee = ref<CategoriePatrimoine | null>(null);
const formCategorie = ref({ code: '', libelle: '', dureeAmortissement: 60 as number | null });
const enregistrementCategorie = ref(false);

const dialogReparation = ref(false);
const modeReparation = ref<'declarer' | 'resoudre'>('declarer');
const equipementReparation = ref<EquipementPatrimoine | null>(null);
const reparationOuverte = ref<ReparationMateriel | null>(null);

const dialogDetails = ref(false);
const equipementDetail = ref<EquipementPatrimoine | null>(null);

const synthese = ref<TableauBordPatrimoine | null>(null);

/** Un filtre autre que la recherche vide est posé sur la liste. */
const aDesFiltres = computed(() =>
  Boolean(
    filtres.value.recherche ||
      filtres.value.categorieId ||
      filtres.value.departementId ||
      filtres.value.actif ||
      filtres.value.enReparation,
  ),
);

const colonnesEquipements: QTableColumn[] = [
  { name: 'libelle', label: 'Équipement', field: 'libelle', align: 'left' },
  { name: 'categorie', label: 'Catégorie', field: 'categorie', align: 'left' },
  {
    name: 'departement',
    label: 'Département',
    field: (r: EquipementPatrimoine) => r.departement?.nom ?? '—',
    align: 'left',
  },
  { name: 'valeur', label: 'Valeur', field: 'valeur', align: 'right' },
  {
    name: 'serie',
    label: 'N° série',
    field: 'numeroSerie',
    align: 'left',
  },
  { name: 'etat', label: 'État', field: 'etat', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesCategories: QTableColumn[] = [
  { name: 'code', label: 'Code', field: 'code', align: 'left' },
  { name: 'libelle', label: 'Libellé', field: 'libelle', align: 'left' },
  {
    name: 'dureeAmortissement',
    label: 'Amortissement (mois)',
    field: (r: CategoriePatrimoine) => r.dureeAmortissement ?? '—',
    align: 'right',
  },
  { name: 'equipements', label: 'Équipements', field: 'equipements', align: 'right' },
  { name: 'actif', label: 'État', field: 'actif', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesReparations: QTableColumn[] = [
  { name: 'equipement', label: 'Équipement', field: 'equipement', align: 'left' },
  { name: 'description', label: 'Description', field: 'description', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'declarLe', label: 'Déclarée le', field: 'dateDeclaration', align: 'left' },
  { name: 'delai', label: 'Délai', field: 'delai', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

// --- Helpers

function enregistrerCanvas(el: any, e: EquipementPatrimoine) {
  if (!el) return;
  QRCode.toCanvas(el, e.qrCode, { width: 96, margin: 1 }).catch(() => {});
}

function enregistrerCanvasDetail(el: any) {
  if (!el || !equipementDetail.value) return;
  QRCode.toCanvas(el, equipementDetail.value.qrCode, { width: 180, margin: 1 }).catch(() => {});
}

function joursEcarts(date: string): number {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function couleurDelai(j: number): string {
  if (j < 7) return 'positive';
  if (j < 30) return 'warning';
  return 'negative';
}

function libelleStatutReparation(s: StatutReparation): string {
  return s === 'DECLARE'
    ? 'Déclarée'
    : s === 'EN_COURS'
    ? 'En cours'
    : s === 'TERMINE'
    ? 'Terminée'
    : 'Annulée';
}

function reinitialiserFiltres() {
  filtres.value = { recherche: filtres.value.recherche ?? '' };
  pagination.value.page = 1;
  chargerEquipements();
}

// --- Liste

const queryEquipements = computed(() => {
  const f = filtres.value;
  return {
    page: pagination.value.page,
    pageSize: pagination.value.pageSize,
    search: (f.recherche ?? '').toString().trim() || undefined,
    categorieId: f.categorieId || undefined,
    departementId: f.departementId || undefined,
    actif: f.actif || undefined,
    enReparation: f.enReparation || undefined,
  };
});

async function chargerEquipements() {
  chargement.value = true;
  try {
    const { data } = await patrimoineService.listeEquipements(queryEquipements.value);
    equipements.value = data.data;
    pagination.value.total = data.total;
  } catch (e: any) {
    equipements.value = [];
    pagination.value.total = 0;
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement de l’inventaire impossible.',
    });
  } finally {
    chargement.value = false;
  }
}

async function chargerCategories() {
  chargementCategories.value = true;
  try {
    const { data } = await patrimoineService.listeCategories();
    categories.value = Array.isArray(data) ? data : data.data ?? [];
  } catch (e: any) {
    categories.value = [];
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement des catégories impossible.',
    });
  } finally {
    chargementCategories.value = false;
  }
}

async function chargerReparations() {
  chargementReparations.value = true;
  try {
    const { data } = await patrimoineService.listeReparations({});
    const toutes = (data ?? []) as ReparationMateriel[];
    reparationsEnCours.value = toutes
      .filter((r) => r.statut === 'EN_COURS' || r.statut === 'DECLARE')
      .sort(
        (a, b) =>
          new Date(a.dateDeclaration).getTime() - new Date(b.dateDeclaration).getTime(),
      );
  } catch (e: any) {
    reparationsEnCours.value = [];
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement des réparations impossible.',
    });
  } finally {
    chargementReparations.value = false;
  }
}

/** Les trois chiffres d'en-tête, ceux-là mêmes que reprend le Rectorat. */
async function chargerSynthese() {
  try {
    const { data } = await patrimoineService.tableauDeBord();
    synthese.value = data;
  } catch {
    synthese.value = null;
  }
}

// --- Actions

function ouvrirEquipement(e: EquipementPatrimoine | null) {
  equipementEdite.value = e;
  dialogEquipement.value = true;
}

function ouvrirCategorie(c: CategoriePatrimoine | null) {
  categorieEditee.value = c;
  if (c) {
    formCategorie.value = {
      code: c.code,
      libelle: c.libelle,
      dureeAmortissement: c.dureeAmortissement ?? null,
    };
  } else {
    formCategorie.value = { code: '', libelle: '', dureeAmortissement: 60 };
  }
  dialogCategorie.value = true;
}

async function enregistrerCategorie() {
  enregistrementCategorie.value = true;
  try {
    const payload = {
      code: formCategorie.value.code.trim(),
      libelle: formCategorie.value.libelle.trim(),
      dureeAmortissement: formCategorie.value.dureeAmortissement ?? undefined,
    };
    if (categorieEditee.value) {
      await patrimoineService.modifierCategorie(categorieEditee.value.id, payload);
      $q.notify({ type: 'positive', message: 'Catégorie mise à jour' });
    } else {
      await patrimoineService.creerCategorie(payload);
      $q.notify({ type: 'positive', message: 'Catégorie enregistrée' });
    }
    dialogCategorie.value = false;
    await chargerCategories();
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Enregistrement de la catégorie impossible',
    });
  } finally {
    enregistrementCategorie.value = false;
  }
}

function supprimerCategorie(c: CategoriePatrimoine) {
  $q.dialog({
    title: 'Supprimer la catégorie ?',
    message: `« ${c.libelle} » — refusée si des équipements y sont rattachés.`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    try {
      await patrimoineService.supprimerCategorie(c.id);
      $q.notify({ type: 'positive', message: 'Catégorie supprimée' });
      await chargerCategories();
    } catch (e: any) {
      $q.notify({
        type: 'negative',
        message: e?.response?.data?.message ?? 'Suppression impossible',
      });
    }
  });
}

function supprimerEquipement(e: EquipementPatrimoine) {
  $q.dialog({
    title: 'Supprimer l’équipement ?',
    message: `${e.numeroInventaire} — refusée si une réparation a été consignée.`,
    cancel: true,
    ok: { color: 'negative', label: 'Supprimer' },
  }).onOk(async () => {
    try {
      await patrimoineService.supprimerEquipement(e.id);
      $q.notify({ type: 'positive', message: 'Équipement supprimé' });
      await chargerEquipements();
      await chargerSynthese();
    } catch (err: any) {
      $q.notify({
        type: 'negative',
        message: err?.response?.data?.message ?? 'Suppression impossible',
      });
    }
  });
}

function ouvrirReparation(
  e: EquipementPatrimoine,
  mode: 'declarer' | 'resoudre',
  reparation?: ReparationMateriel | null,
) {
  equipementReparation.value = e;
  modeReparation.value = mode;
  reparationOuverte.value = reparation ?? null;
  dialogReparation.value = true;
}

/**
 * La réparation porte son équipement : le chercher dans la page d'inventaire
 * courante échouait dès que la pièce n'était pas sur la page affichée — cas le
 * plus fréquent, l'onglet Réparations ne suivant pas la pagination.
 */
function resoudreReparation(r: ReparationMateriel) {
  const eq =
    (r.equipement as EquipementPatrimoine | undefined) ??
    equipements.value.find((e) => e.id === r.equipementId);
  if (!eq) {
    $q.notify({ type: 'warning', message: 'Équipement introuvable, rechargez la page.' });
    return;
  }
  ouvrirReparation(eq, 'resoudre', r);
}

function imprimerEtiquette(e: EquipementPatrimoine) {
  window.open(
    `${API_URL}/patrimoine/equipements/${e.id}/imprimer?token=${auth.token}`,
    '_blank',
  );
}

async function voirDetails(e: EquipementPatrimoine) {
  equipementDetail.value = e;
  dialogDetails.value = true;
  reparationsDetail.value = [];
  try {
    const { data } = await patrimoineService.reparationsEquipement(e.id);
    reparationsDetail.value = data;
  } catch {
    $q.notify({ type: 'warning', message: 'Carnet de réparations indisponible.' });
  }
}

// --- Wiring

watch(onglet, (v) => {
  if (v === 'reparations') chargerReparations();
  if (v === 'categories' && !categories.value.length) chargerCategories();
});

watch(filtres, () => {
  pagination.value.page = 1;
  chargerEquipements();
}, { deep: true });

onMounted(async () => {
  await chargerCategories();
  await chargerEquipements();
  await chargerSynthese();
});
</script>

<style scoped lang="scss">
/* Même définition que les autres tableaux de bord de l'application. */
.stat-chiffre {
  font-size: 2rem;
  line-height: 1.1;
  font-weight: 700;
}

</style>
