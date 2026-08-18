<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Paiements</div>
        <div class="page-sous-titre">
          Encaissements Mobile Money, espèces et virements : l'agent comptable
          confirme les transactions de l'opérateur, chaque opération est tracée.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutCreer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouveau paiement"
          @click="dialogPaiement = true"
        />
      </div>
    </div>

    <!-- Arrivée depuis un dossier ou une fiche étudiant : le ciblage est annoncé. -->
    <q-banner v-if="libelleCible" dense class="note--info q-mb-md">
      <template #avatar><q-icon name="filter_alt" /></template>
      {{ libelleCible }}
      <template #action>
        <q-btn flat dense no-caps label="Voir tous les paiements" @click="retirerCible" />
      </template>
    </q-banner>

    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-4">
        <q-card flat bordered class="carte paiements-kpi">
          <q-card-section class="row items-center">
            <q-icon name="check_circle" color="positive" size="32px" class="q-mr-md" />
            <div>
              <div class="pochoir text-grey-7">Total encaissé</div>
              <div class="lettrage chiffres paiements-kpi__valeur">
                {{ montantLisible(kpis.totalEncaisse) }} GNF
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered class="carte paiements-kpi">
          <q-card-section class="row items-center">
            <q-icon name="hourglass_top" color="warning" size="32px" class="q-mr-md" />
            <div>
              <div class="pochoir text-grey-7">En attente</div>
              <div class="lettrage chiffres paiements-kpi__valeur">
                {{ kpis.enAttente }}
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4">
        <q-card flat bordered class="carte paiements-kpi">
          <q-card-section class="row items-center">
            <q-icon name="cancel" color="negative" size="32px" class="q-mr-md" />
            <div>
              <div class="pochoir text-grey-7">Échoués</div>
              <div class="lettrage chiffres paiements-kpi__valeur">
                {{ kpis.echoues }}
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Le registre est paginé côté serveur : ces totaux portent sur ce qui est affiché. -->
    <div class="text-caption text-grey-7 q-mb-md">
      Calculé sur les {{ paiements.length }} paiement{{ paiements.length > 1 ? 's' : '' }}
      affiché{{ paiements.length > 1 ? 's' : '' }} sur {{ total }} —
      « Charger tout » pour porter le calcul sur l’ensemble du registre.
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (référence, nom étudiant)…"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.statut"
          :options="optionsStatuts"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Statut"
        />
        <q-select
          v-model="filtres.mode"
          :options="optionsModes"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Mode"
        />
        <q-select
          v-model="filtres.operateur"
          :options="optionsOperateurs"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Opérateur"
        />
        <q-input
          v-model="filtres.motif"
          outlined
          dense
          clearable
          label="Motif"
          placeholder="Frais d'inscription…"
        />
        <autocomplete-async
          v-model="filtres.inscriptionId"
          endpoint="/inscriptions"
          :label-fn="(i) => `${i.numero} — ${i.etudiant?.nom ?? ''} ${i.etudiant?.prenom ?? ''}`"
          label="Dossier d’inscription"
          clearable
        />
        <autocomplete-async
          v-model="filtres.etudiantId"
          endpoint="/etudiants"
          :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}`"
          label="Étudiant"
          clearable
        />
        <champ-date v-model="filtres.dateDebut" label="Depuis" />
        <champ-date v-model="filtres.dateFin" label="Jusqu'à" />
      </template>
      <template #actions>
        <view-toggle
          cle="paiements"
          :modes="['tableau', 'cartes']"
          defaut="tableau"
          @update:mode="(m) => (modeVue = (m as 'tableau' | 'cartes'))"
        />
      </template>
    </filter-bar>

    <q-table
      v-if="modeVue === 'tableau'"
      flat
      bordered
      class="carte"
      :rows="paiementsFiltres"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="paiements-vide">
          <q-icon name="payments" size="42px" class="q-mb-sm" />
          <div>{{ messageVide }}</div>
          <div class="q-mt-sm q-gutter-sm">
            <q-btn
              v-if="filtresActifs"
              outline
              no-caps
              icon="refresh"
              label="Réinitialiser les filtres"
              @click="reinitialiser"
            />
            <q-btn
              v-if="peutCreer"
              unelevated
              color="primary"
              no-caps
              icon="add"
              label="Nouveau paiement"
              @click="dialogPaiement = true"
            />
          </div>
        </div>
      </template>

      <template #body-cell-etudiant="p">
        <q-td :props="p">
          <div>{{ p.row.etudiant?.nom }} {{ p.row.etudiant?.prenom }}</div>
          <div class="text-caption text-grey-7">
            {{ p.row.etudiant?.matricule }}
            <span v-if="p.row.inscription?.numero"> · {{ p.row.inscription.numero }}</span>
          </div>
        </q-td>
      </template>

      <template #body-cell-montant="p">
        <q-td :props="p" class="text-right text-weight-medium">
          {{ montantLisible(p.row.montant) }} {{ p.row.devise }}
        </q-td>
      </template>

      <template #body-cell-modep="p">
        <q-td :props="p">
          <div>{{ LIBELLE_MODE_PAIEMENT[p.row.mode] ?? p.row.mode }}</div>
          <div class="text-caption text-grey-7">
            {{ p.row.operateur ? LIBELLE_OPERATEUR_MM[p.row.operateur] ?? p.row.operateur : '—' }}
          </div>
        </q-td>
      </template>

      <template #body-cell-statut="p">
        <q-td :props="p">
          <span class="champ badge-statut" :class="classeStatut(p.row.statut)">
            {{ LIBELLE_STATUT_PAIEMENT[p.row.statut] ?? p.row.statut }}
          </span>
        </q-td>
      </template>

      <template #body-cell-horodatage="p">
        <q-td :props="p">{{ dateHeureLisible(p.row.horodatage) }}</q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="info"
            color="primary"
            aria-label="Détails de la transaction"
            @click="ouvrirDetail(p.row)"
          >
            <q-tooltip>Détails de la transaction</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.inscription || p.row.inscriptionId"
            flat
            dense
            round
            icon="how_to_reg"
            aria-label="Voir le dossier d'inscription"
            @click="voirInscription(p.row)"
          >
            <q-tooltip>Dossier d’inscription</q-tooltip>
          </q-btn>
          <q-btn
            v-if="p.row.etudiant"
            flat
            dense
            round
            icon="person"
            aria-label="Voir la fiche de l'étudiant"
            @click="voirEtudiant(p.row)"
          >
            <q-tooltip>Fiche de l’étudiant</q-tooltip>
          </q-btn>
          <template v-if="peutSimuler(p.row)">
            <q-btn
              flat
              dense
              round
              color="positive"
              icon="check"
              aria-label="Confirmer le paiement comme réussi"
              @click="simuler(p.row, 'REUSSI')"
            >
              <q-tooltip>Confirmer le paiement (réussi)</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              color="negative"
              icon="close"
              aria-label="Marquer le paiement échoué"
              @click="simuler(p.row, 'ECHOUE')"
            >
              <q-tooltip>Marquer échoué</q-tooltip>
            </q-btn>
          </template>
          <q-btn
            v-if="peutAnnuler(p.row)"
            flat
            dense
            round
            color="negative"
            icon="block"
            aria-label="Annuler le paiement"
            @click="ouvrirAnnulation(p.row)"
          >
            <q-tooltip>Annuler le paiement</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <q-linear-progress
      v-if="modeVue === 'cartes' && chargement"
      indeterminate
      color="primary"
      class="q-mb-sm"
    />

    <div v-else-if="modeVue === 'cartes'" class="paiements-cartes">
      <q-card
        v-for="p in paiementsFiltres"
        :key="p.id"
        flat
        bordered
        class="carte paiements-cartes__carte"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <span class="champ badge-statut" :class="classeStatut(p.statut)">
              {{ LIBELLE_STATUT_PAIEMENT[p.statut] ?? p.statut }}
            </span>
            <q-space />
            <div class="text-caption text-grey-7">{{ p.reference }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">
            {{ p.etudiant?.nom }} {{ p.etudiant?.prenom }}
          </div>
          <div class="text-caption text-grey-7">
            {{ p.etudiant?.matricule }}
            <span v-if="p.inscription?.numero"> · {{ p.inscription.numero }}</span>
          </div>
          <div class="row q-mt-sm q-col-gutter-sm">
            <div class="col-6">
              <div class="text-caption text-grey-7">Mode</div>
              <div class="text-weight-medium">
                {{ LIBELLE_MODE_PAIEMENT[p.mode] ?? p.mode }}
              </div>
              <div class="text-caption text-grey-7">
                {{ p.operateur ? LIBELLE_OPERATEUR_MM[p.operateur] ?? p.operateur : '—' }}
              </div>
            </div>
            <div class="col-6 text-right">
              <div class="text-caption text-grey-7">Montant</div>
              <div class="text-weight-medium lettrage chiffres">
                {{ montantLisible(p.montant) }} {{ p.devise }}
              </div>
            </div>
          </div>
          <div class="text-caption text-grey-7 q-mt-xs">
            {{ dateHeureLisible(p.horodatage) }}
          </div>
          <div v-if="p.transactionId" class="text-caption text-grey-7">
            Transaction : {{ p.transactionId }}
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-gutter-xs">
          <q-btn
            flat
            dense
            color="primary"
            icon="info"
            no-caps
            label="Détails"
            @click="ouvrirDetail(p)"
          />
          <q-btn
            v-if="peutSimuler(p)"
            flat
            dense
            color="positive"
            icon="check"
            no-caps
            label="Réussi"
            @click="simuler(p, 'REUSSI')"
          />
          <q-btn
            v-if="peutSimuler(p)"
            flat
            dense
            color="negative"
            icon="close"
            no-caps
            label="Échoué"
            @click="simuler(p, 'ECHOUE')"
          />
          <q-btn
            v-if="peutAnnuler(p)"
            flat
            dense
            color="negative"
            icon="block"
            no-caps
            label="Annuler"
            @click="ouvrirAnnulation(p)"
          />
          <q-btn
            v-if="p.inscription || p.inscriptionId"
            flat
            dense
            icon="how_to_reg"
            no-caps
            label="Dossier"
            @click="voirInscription(p)"
          />
          <q-btn
            v-if="p.etudiant"
            flat
            dense
            icon="person"
            no-caps
            label="Étudiant"
            @click="voirEtudiant(p)"
          />
        </q-card-actions>
      </q-card>
      <div v-if="!paiementsFiltres.length" class="paiements-vide">
        <q-icon name="payments" size="42px" class="q-mb-sm" />
        <div>{{ messageVide }}</div>
        <div class="q-mt-sm q-gutter-sm">
          <q-btn
            v-if="filtresActifs"
            outline
            no-caps
            icon="refresh"
            label="Réinitialiser les filtres"
            @click="reinitialiser"
          />
          <q-btn
            v-if="peutCreer"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Nouveau paiement"
            @click="dialogPaiement = true"
          />
        </div>
      </div>
    </div>

    <pagination-bar
      v-if="paiements.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <paiement-dialog v-model="dialogPaiement" @paye="charger" />

    <!-- Détail d'une transaction -->
    <q-dialog v-model="dialogDetail">
      <q-card style="width: 520px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">{{ detail?.reference }}</div>
          <div class="text-caption text-grey-7">
            {{ detail ? `${LIBELLE_MODE_PAIEMENT[detail.mode] ?? detail.mode} · ${LIBELLE_STATUT_PAIEMENT[detail.statut] ?? detail.statut}` : '' }}
          </div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-list separator dense>
            <q-item>
              <q-item-section>
                <q-item-label caption>Étudiant / dossier</q-item-label>
                <q-item-label>
                  {{ detail?.etudiant ? `${detail.etudiant.nom} ${detail.etudiant.prenom}` : '—' }}
                  {{ detail?.inscription?.numero ? ` · ${detail.inscription.numero}` : '' }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Montant</q-item-label>
                <q-item-label>{{ montantLisible(detail?.montant) }} {{ detail?.devise }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Transaction (opérateur)</q-item-label>
                <q-item-label>{{ detail?.transactionId ?? 'aucune — simulation pilote' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Opérateur / téléphone</q-item-label>
                <q-item-label>
                  {{ detail?.operateur ? LIBELLE_OPERATEUR_MM[detail.operateur] ?? detail.operateur : '—' }}
                  · {{ detail?.telephone ?? '—' }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Motif</q-item-label>
                <q-item-label>{{ detail?.motif ?? '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Horodatage</q-item-label>
                <q-item-label>{{ detail ? dateHeureLisible(detail.horodatage) : '—' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Causerie</q-item-label>
                <q-item-label>
                  {{ detail?.creePar ? `${detail.creePar.prenom} ${detail.creePar.nom}` : 'registre' }}
                  {{ detail?.completeLe ? ` · complété le ${dateHeureLisible(detail.completeLe)}` : '' }}
                  {{ detail?.motifAnnulation ? ` · annulé : ${detail.motifAnnulation}` : '' }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Annulation : le motif est exigé -->
    <q-dialog v-model="dialogAnnulation">
      <q-card style="width: 460px; max-width: 95vw">
        <q-card-section>
          <div class="text-h6">Annuler {{ paiementAnnuler?.reference }}</div>
          <div class="text-caption text-grey-7">
            {{ paiementAnnuler ? LIBELLE_STATUT_PAIEMENT[paiementAnnuler.statut] : '' }} —
            le paiement reste tracé au registre.
          </div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="motifAnnulation"
            outlined
            dense
            type="textarea"
            rows="3"
            label="Motif d'annulation *"
            autofocus
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Fermer" v-close-popup />
          <q-btn
            color="negative"
            unelevated
            no-caps
            icon="block"
            label="Annuler le paiement"
            :disable="motifAnnulation.trim().length < 3"
            :loading="annulationEnCours"
            @click="confirmerAnnulation"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import PaiementDialog from '../components/PaiementDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import ChampDate from '../components/ChampDate.vue';
import {
  LIBELLE_MODE_PAIEMENT,
  LIBELLE_OPERATEUR_MM,
  LIBELLE_STATUT_PAIEMENT,
  dateHeureLisible,
  dateLisible,
  montantLisible,
} from '../utils/libelles';
import type { Etudiant, Inscription, ModePaiement, Paiement, StatutPaiement, ChipFiltre } from '../types';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const paiements = ref<Paiement[]>([]);
const chargement = ref(false);
const modeVue = ref<'tableau' | 'cartes'>('tableau');

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
/** Tant que les filtres d'ouverture ne sont pas posés, le watcher ne recharge pas. */
const pret = ref(false);

const filtres = ref<Record<string, any>>({});
/** Contexte reçu en paramètre d'URL (`?inscription=…` ou `?etudiant=…`). */
const dossierCible = ref<Inscription | null>(null);
const etudiantCible = ref<Etudiant | null>(null);

const dialogPaiement = ref(false);
const dialogDetail = ref(false);
const detail = ref<Paiement | null>(null);
const dialogAnnulation = ref(false);
const paiementAnnuler = ref<Paiement | null>(null);
const motifAnnulation = ref('');
const annulationEnCours = ref(false);

const peutCreer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutSimuler = (p: Paiement) =>
  auth.aRole(['ADMIN', 'DIRECTION']) && p.statut === 'EN_ATTENTE';
const peutAnnuler = (p: Paiement) =>
  auth.aRole(['ADMIN', 'DIRECTION']) && !['REUSSI', 'ANNULE', 'REMBOURSE'].includes(p.statut);

const optionsStatuts = computed(() =>
  Object.entries(LIBELLE_STATUT_PAIEMENT).map(([value, label]) => ({ value, label })),
);
const optionsModes = computed(() =>
  Object.entries(LIBELLE_MODE_PAIEMENT).map(([value, label]) => ({ value, label })),
);
const optionsOperateurs = computed(() =>
  Object.entries(LIBELLE_OPERATEUR_MM).map(([value, label]) => ({ value, label })),
);

const colonnes: QTableColumn[] = [
  { name: 'reference', label: 'Référence', field: 'reference', align: 'left', sortable: true },
  { name: 'etudiant', label: 'Étudiant', field: 'etudiant', align: 'left' },
  { name: 'mode', label: 'Mode / Opérateur', field: 'mode', align: 'left' },
  { name: 'montant', label: 'Montant', field: 'montant', align: 'right', sortable: true },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left', sortable: true },
  { name: 'motif', label: 'Motif', field: 'motif', align: 'left' },
  { name: 'transactionId', label: 'Transaction', field: 'transactionId', align: 'left' },
  { name: 'horodatage', label: 'Date', field: 'horodatage', align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const classeStatut = (s: string) =>
  ({
    EN_ATTENTE: 'champ--attente-paiement',
    REUSSI: 'champ--payee',
    ECHOUE: 'champ--annulee',
    ANNULE: 'champ--brouillon',
    REMBOURSE: 'champ--brouillon',
  })[s] ?? 'champ--brouillon';

/** Contexte d'arrivée, résumé en une phrase au-dessus du registre. */
const libelleCible = computed(() => {
  if (dossierCible.value) {
    const d = dossierCible.value;
    const qui = d.etudiant ? ` — ${d.etudiant.prenom} ${d.etudiant.nom}` : '';
    return `Paiements du dossier ${d.numero}${qui}.`;
  }
  if (filtres.value.inscriptionId && !dossierCible.value) {
    return 'Paiements d’un dossier d’inscription.';
  }
  if (etudiantCible.value) {
    const e = etudiantCible.value;
    return `Paiements de ${e.prenom} ${e.nom} (${e.matricule}), tous dossiers confondus.`;
  }
  return '';
});

/** Au moins un critère est posé : l'état vide se répare en réinitialisant. */
const filtresActifs = computed(() =>
  Object.entries(filtres.value).some(([, v]) => v !== null && v !== undefined && v !== ''),
);

const messageVide = computed(() =>
  filtresActifs.value
    ? 'Aucun paiement ne correspond à ces critères.'
    : 'Aucun paiement enregistré : encaissez depuis un dossier d’inscription ou créez un paiement libre.',
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: `« ${filtres.value.recherche} »`,
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.statut) {
    cs.push({
      label: `Statut : ${LIBELLE_STATUT_PAIEMENT[filtres.value.statut as StatutPaiement] ?? filtres.value.statut}`,
      value: filtres.value.statut,
      icone: 'flag',
    });
  }
  if (filtres.value.mode) {
    cs.push({
      label: `Mode : ${LIBELLE_MODE_PAIEMENT[filtres.value.mode as ModePaiement] ?? filtres.value.mode}`,
      value: filtres.value.mode,
      icone: 'payments',
    });
  }
  if (filtres.value.operateur) {
    cs.push({
      label: `Op. : ${LIBELLE_OPERATEUR_MM[filtres.value.operateur] ?? filtres.value.operateur}`,
      value: filtres.value.operateur,
      icone: 'cell_tower',
    });
  }
  if (filtres.value.motif) {
    cs.push({
      label: `Motif : ${filtres.value.motif}`,
      value: filtres.value.motif,
      icone: 'description',
    });
  }
  if (filtres.value.inscriptionId) {
    cs.push({
      label: `Dossier : ${dossierCible.value?.numero ?? 'sélectionné'}`,
      value: filtres.value.inscriptionId,
      icone: 'how_to_reg',
    });
  }
  if (filtres.value.etudiantId) {
    cs.push({
      label: `Étudiant : ${etudiantCible.value?.matricule ?? 'sélectionné'}`,
      value: filtres.value.etudiantId,
      icone: 'person',
    });
  }
  if (filtres.value.dateDebut) {
    cs.push({
      label: `Depuis : ${dateLisible(filtres.value.dateDebut)}`,
      value: filtres.value.dateDebut,
      icone: 'event',
    });
  }
  if (filtres.value.dateFin) {
    cs.push({
      label: `Jusqu'à : ${dateLisible(filtres.value.dateFin)}`,
      value: filtres.value.dateFin,
      icone: 'event',
    });
  }
  return cs;
});

const kpis = computed(() => {
  const liste = paiements.value;
  let totalEncaisse = 0;
  let enAttente = 0;
  let echoues = 0;
  for (const p of liste) {
    if (p.statut === 'REUSSI') totalEncaisse += p.montant;
    if (p.statut === 'EN_ATTENTE') enAttente++;
    if (p.statut === 'ECHOUE') echoues++;
  }
  return { totalEncaisse, enAttente, echoues };
});

/** Filtrage client pour les critères que le backend ne gère pas encore. */
const paiementsFiltres = computed(() => {
  let liste = paiements.value;
  if (filtres.value.operateur) {
    liste = liste.filter((p) => p.operateur === filtres.value.operateur);
  }
  if (filtres.value.motif) {
    const needle = String(filtres.value.motif).toLowerCase();
    liste = liste.filter((p) => (p.motif ?? '').toLowerCase().includes(needle));
  }
  if (filtres.value.dateDebut) {
    const d = new Date(filtres.value.dateDebut).getTime();
    liste = liste.filter((p) => new Date(p.horodatage).getTime() >= d);
  }
  if (filtres.value.dateFin) {
    const d = new Date(filtres.value.dateFin).getTime() + 86_400_000 - 1;
    liste = liste.filter((p) => new Date(p.horodatage).getTime() <= d);
  }
  return liste;
});

function ouvrirDetail(p: Paiement) {
  detail.value = p;
  dialogDetail.value = true;
}

/**
 * Retour au dossier d'inscription qui porte le paiement : par l'étudiant si
 * on le connaît, sinon par le numéro de dossier posé en recherche.
 */
function voirInscription(p: Paiement) {
  const etudiantId = p.etudiantId ?? p.inscription?.etudiantId ?? null;
  if (etudiantId) {
    void router.push({ path: '/inscriptions', query: { etudiant: etudiantId } });
    return;
  }
  const numero = p.inscription?.numero;
  if (!numero) return;
  void router.push({ path: '/inscriptions', query: { recherche: numero } });
}

/** Retour à la fiche de l'étudiant payeur. */
function voirEtudiant(p: Paiement) {
  if (!p.etudiant) return;
  void router.push({ path: '/etudiants', query: { recherche: p.etudiant.matricule } });
}

function simuler(p: Paiement, statut: 'REUSSI' | 'ECHOUE') {
  $q.dialog({
    title: statut === 'REUSSI' ? 'Confirmer le paiement' : 'Marquer le paiement échoué',
    message: `${p.reference} pour ${montantLisible(p.montant)} ${p.devise} — répercuter la réponse de l'opérateur (${statut === 'REUSSI' ? 'paiement reçu' : 'transaction rejetée'}) ?`,
    ok: { color: statut === 'REUSSI' ? 'positive' : 'negative', label: 'Confirmer', unelevated: true },
    cancel: true,
  }).onOk(async () => {
    await api.post(`/paiements/${p.id}/simuler`, { statut });
    $q.notify({
      type: 'positive',
      message: statut === 'REUSSI' ? 'Paiement confirmé' : 'Paiement marqué échoué',
    });
    await charger();
  });
}

function ouvrirAnnulation(p: Paiement) {
  paiementAnnuler.value = p;
  motifAnnulation.value = '';
  dialogAnnulation.value = true;
}

async function confirmerAnnulation() {
  annulationEnCours.value = true;
  try {
    await api.post(`/paiements/${paiementAnnuler.value!.id}/annuler`, {
      motif: motifAnnulation.value,
    });
    $q.notify({ type: 'warning', message: 'Paiement annulé' });
    dialogAnnulation.value = false;
    await charger();
  } finally {
    annulationEnCours.value = false;
  }
}

/** Paramètres réellement compris par `GET /paiements`. */
function paramsServeur(): Record<string, any> {
  const params: Record<string, any> = { all: '1' };
  if (filtres.value.recherche) params.search = filtres.value.recherche;
  if (filtres.value.statut) params.statut = filtres.value.statut;
  if (filtres.value.mode) params.mode = filtres.value.mode;
  if (filtres.value.inscriptionId) params.inscriptionId = filtres.value.inscriptionId;
  if (filtres.value.etudiantId) params.etudiantId = filtres.value.etudiantId;
  return params;
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/paiements', {
      params: { ...paramsServeur(), page: page.value, pageSize: pageSize.value },
    });
    paiements.value = data.data ?? [];
    total.value = data.total ?? paiements.value.length;
  } catch {
    paiements.value = [];
    total.value = 0;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  chargement.value = true;
  try {
    const { data } = await api.get('/paiements', {
      params: { ...paramsServeur(), pageSize: 1000 },
    });
    paiements.value = data.data ?? [];
    total.value = paiements.value.length;
    pageSize.value = Math.max(paiements.value.length, 1);
    page.value = 1;
  } catch {
    paiements.value = [];
    total.value = 0;
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = {};
  dossierCible.value = null;
  etudiantCible.value = null;
  void router.replace({ path: '/paiements' });
  page.value = 1;
  void charger();
}

/** Lève le ciblage venu de l'URL sans toucher aux autres filtres. */
async function retirerCible() {
  // Le drapeau évite que chaque retrait de filtre déclenche sa propre requête.
  pret.value = false;
  dossierCible.value = null;
  etudiantCible.value = null;
  delete filtres.value.inscriptionId;
  delete filtres.value.etudiantId;
  await router.replace({ path: '/paiements' });
  page.value = 1;
  pret.value = true;
  await charger();
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.statut,
    filtres.value.mode,
    filtres.value.inscriptionId,
    filtres.value.etudiantId,
  ],
  () => {
    if (!pret.value) return;
    page.value = 1;
    void charger();
  },
);

/** `/paiements?inscription=<id>` — encaissements d'un dossier précis. */
async function appliquerDossierCible(id: string) {
  filtres.value.inscriptionId = id;
  try {
    const { data } = await api.get('/inscriptions', { params: { all: '1' } });
    const liste: Inscription[] = Array.isArray(data) ? data : data.data ?? [];
    dossierCible.value = liste.find((i) => i.id === id) ?? null;
  } catch {
    dossierCible.value = null;
  }
}

/** `/paiements?etudiant=<id>` — tous les encaissements d'un étudiant. */
async function appliquerEtudiantCible(id: string) {
  filtres.value.etudiantId = id;
  try {
    const { data } = await api.get(`/etudiants/${id}`);
    etudiantCible.value = data;
  } catch {
    etudiantCible.value = null;
  }
}

onMounted(async () => {
  const dossier = route.query.inscription as string | undefined;
  const etudiant = route.query.etudiant as string | undefined;
  if (dossier) await appliquerDossierCible(dossier);
  else if (etudiant) await appliquerEtudiantCible(etudiant);
  pret.value = true;
  await charger();
});
</script>

<style scoped lang="scss">
.paiements-kpi {
  background: var(--up-plaque);
  border: var(--up-filet);
}
.paiements-kpi__valeur {
  font-size: 1.4rem;
  margin-top: 2px;
}
.paiements-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--up-3);
}
.paiements-cartes__carte {
  background: var(--up-plaque);
}

// État vide : on nomme la cause et on offre la sortie.
.paiements-vide {
  grid-column: 1 / -1;
  padding: var(--up-5);
  text-align: center;
  color: var(--up-encre-douce);
}

.champ.badge-statut {
  display: inline-flex;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.champ--brouillon { background: #cfd4d9; color: #33463f; }
.champ--attente-paiement { background: #e8a317; color: #10251e; }
.champ--payee { background: #1e7a4c; }
.champ--annulee { background: #c2321e; }
</style>
