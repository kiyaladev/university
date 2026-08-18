<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Étudiants</div>
        <div class="page-sous-titre">
          La base centrale du registre : matricule INE, QR de la carte resto et
          compteur de dossiers — les autres modules en dépendent.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          v-if="peutGerer"
          unelevated
          color="primary"
          no-caps
          icon="add"
          label="Nouvel étudiant"
          @click="ouvrir(null)"
        />
      </div>
    </div>

    <filter-bar
      v-model="filtres"
      :chips="chips"
      placeholder="Rechercher (matricule, nom, email)…"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <autocomplete-async
          v-model="filtres.promotionId"
          endpoint="/promotions"
          :label-fn="(p) => p.nom"
          label="Promotion"
          clearable
        />
        <q-select
          v-model="filtres.actif"
          :options="optionsActif"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Statut"
        />
        <q-select
          v-model="filtres.sexe"
          :options="optionsSexe"
          outlined
          dense
          clearable
          emit-value
          map-options
          label="Genre"
        />
        <champ-date v-model="filtres.dateDebut" label="Inscrit entre (début)" />
        <champ-date v-model="filtres.dateFin" label="et (fin)" />
      </template>
      <template #actions>
        <view-toggle
          cle="etudiants"
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
      :rows="etudiants"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <div class="etudiants-vide">
          <q-icon name="groups" size="42px" class="q-mb-sm" />
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
              v-if="peutGerer && !filtresActifs"
              unelevated
              color="primary"
              no-caps
              icon="add"
              label="Nouvel étudiant"
              @click="ouvrir(null)"
            />
          </div>
        </div>
      </template>

      <template #body-cell-nom="p">
        <q-td :props="p">
          <div>{{ p.row.nom }} {{ p.row.prenom }}</div>
          <div class="text-caption text-grey-7">{{ p.row.matricule }}</div>
        </q-td>
      </template>

      <template #body-cell-sexe="p">
        <q-td :props="p">
          <q-chip v-if="p.row.sexe" dense outline :color="p.row.sexe === 'F' ? 'pink' : 'primary'">
            {{ p.row.sexe === 'F' ? 'F' : 'M' }}
          </q-chip>
          <span v-else class="text-grey-7">—</span>
        </q-td>
      </template>

      <template #body-cell-promotion="p">
        <q-td :props="p">
          <q-chip v-if="dernierePromo(p.row)" dense outline color="primary">
            {{ dernierePromo(p.row) }}
          </q-chip>
          <span v-else class="text-grey-7">—</span>
        </q-td>
      </template>

      <template #body-cell-comptes="p">
        <q-td :props="p" class="text-center">
          <q-icon
            :name="p.row.user ? 'check_circle' : 'remove_circle_outline'"
            :color="p.row.user ? 'positive' : 'grey-5'"
          />
          <q-tooltip>
            {{ p.row.user ? `Compte : ${p.row.user.email}` : 'Aucun compte portail' }}
          </q-tooltip>
        </q-td>
      </template>

      <template #body-cell-inscriptions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="peutValiderVoir && (p.row._count?.inscriptions ?? 0) > 0"
            flat
            dense
            no-caps
            class="chiffres"
            :label="String(p.row._count?.inscriptions ?? 0)"
            :aria-label="`Voir les ${p.row._count?.inscriptions} inscription(s) de ${p.row.prenom} ${p.row.nom}`"
            @click="voirInscriptions(p.row)"
          >
            <q-tooltip>Voir ses inscriptions</q-tooltip>
          </q-btn>
          <span v-else class="chiffres text-grey-7">
            {{ p.row._count?.inscriptions ?? 0 }}
          </span>
        </q-td>
      </template>

      <template #body-cell-actif="p">
        <q-td :props="p">
          <q-toggle
            :model-value="p.row.actif"
            color="secondary"
            :disable="!peutGererCompte(p.row)"
            :aria-label="`Étudiant actif : ${p.row.prenom} ${p.row.nom}`"
            @update:model-value="(v) => basculerActif(p.row, v)"
          />
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="edit"
            aria-label="Modifier la fiche de l'étudiant"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>Modifier la fiche</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutValiderVoir"
            flat
            dense
            round
            color="primary"
            icon="how_to_reg"
            aria-label="Voir les inscriptions de l'étudiant"
            @click="allerAuxInscriptions(p.row)"
          >
            <q-tooltip>Ouvrir ses inscriptions</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutVoirPaiements"
            flat
            dense
            round
            color="primary"
            icon="payments"
            aria-label="Voir les paiements de l'étudiant"
            @click="allerAuxPaiements(p.row)"
          >
            <q-tooltip>Ouvrir ses paiements</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutValiderVoir"
            flat
            dense
            round
            color="primary"
            icon="fact_check"
            aria-label="Voir les évaluations de sa promotion"
            @click="allerAuxEvaluations(p.row)"
          >
            <q-tooltip>Évaluations de sa promotion</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            color="primary"
            icon="print"
            aria-label="Imprimer le certificat d'inscription"
            @click="imprimerAttestation(p.row)"
          >
            <q-tooltip>
              {{
                derniereInscription(p.row)
                  ? 'Certificat d’inscription (dernier dossier)'
                  : 'Aucun dossier d’inscription'
              }}
            </q-tooltip>
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

    <div v-else-if="modeVue === 'cartes'" class="etudiants-cartes">
      <q-card
        v-for="e in etudiants"
        :key="e.id"
        flat
        bordered
        class="carte etudiants-cartes__carte"
      >
        <q-card-section>
          <div class="row items-center q-mb-xs">
            <q-chip
              :outline="e.actif"
              :color="e.actif ? 'positive' : 'grey-7'"
              :icon="e.actif ? 'check_circle' : 'remove_circle'"
              dense
              :label="e.actif ? 'Actif' : 'Inactif'"
            />
            <q-chip v-if="e.sexe" dense outline :color="e.sexe === 'F' ? 'pink' : 'primary'">
              {{ e.sexe === 'F' ? 'Féminin' : 'Masculin' }}
            </q-chip>
            <q-space />
            <div class="text-caption text-grey-7">{{ e.matricule }}</div>
          </div>
          <div class="text-subtitle1 text-weight-medium">
            {{ e.nom }} {{ e.prenom }}
          </div>
          <div class="text-caption text-grey-7">
            <span v-if="e.telephone">{{ e.telephone }}</span>
            <span v-else>—</span>
          </div>
          <div class="q-mt-sm">
            <q-chip
              v-if="dernierePromo(e)"
              outline
              color="primary"
              dense
              :label="dernierePromo(e)"
              icon="school"
            />
            <span v-else class="text-caption text-grey-7">Aucune inscription</span>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-gutter-xs">
          <q-btn
            v-if="peutGerer"
            flat
            dense
            icon="edit"
            no-caps
            label="Modifier"
            @click="ouvrir(e)"
          />
          <q-btn
            v-if="peutValiderVoir"
            flat
            dense
            color="primary"
            icon="how_to_reg"
            no-caps
            label="Inscriptions"
            @click="allerAuxInscriptions(e)"
          />
          <q-btn
            v-if="peutVoirPaiements"
            flat
            dense
            color="primary"
            icon="payments"
            no-caps
            label="Paiements"
            @click="allerAuxPaiements(e)"
          />
          <q-btn
            v-if="peutValiderVoir"
            flat
            dense
            color="primary"
            icon="fact_check"
            no-caps
            label="Évaluations"
            @click="allerAuxEvaluations(e)"
          />
          <q-btn
            v-if="peutGerer"
            flat
            dense
            color="primary"
            icon="print"
            no-caps
            label="Certificat"
            @click="imprimerAttestation(e)"
          />
        </q-card-actions>
      </q-card>
      <div v-if="!etudiants.length" class="etudiants-vide">
        <q-icon name="groups" size="42px" class="q-mb-sm" />
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
            v-if="peutGerer && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            label="Nouvel étudiant"
            @click="ouvrir(null)"
          />
        </div>
      </div>
    </div>

    <div v-if="filtrageLocalActif && etudiants.length" class="text-caption text-grey-7 q-mt-sm">
      Promotion, genre et dates sont appliqués à la page affichée : utilisez
      « Charger tout » pour les appliquer à l’ensemble du registre.
    </div>

    <pagination-bar
      v-if="etudiants.length"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="(v) => { page = v; charger(); }"
      @update:page-size="(v) => { pageSize = v; page = 1; charger(); }"
      @tous="chargerTout"
    />

    <etudiant-dialog
      v-model="dialogOuvert"
      :etudiant="etudiantEdite"
      @enregistre="charger"
    />

    <!-- Dialog : inscriptions de l'étudiant -->
    <q-dialog v-model="dialogInscriptions">
      <q-card style="width: 780px; max-width: 95vw">
        <q-card-section class="row items-center">
          <div class="col">
            <div class="text-h6">
              Inscriptions — {{ etudiantInscriptions?.nom }} {{ etudiantInscriptions?.prenom }}
            </div>
            <div class="text-caption text-grey-7">
              {{ etudiantInscriptions?.matricule }}
            </div>
          </div>
          <q-btn flat round dense icon="close" aria-label="Fermer" v-close-popup />
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-linear-progress v-if="chargementInscriptions" indeterminate color="primary" class="q-mb-sm" />
          <q-table
            v-else
            flat
            bordered
            :rows="listeInscriptions"
            :columns="colonnesInscriptions"
            row-key="id"
            :pagination="{ rowsPerPage: 0 }"
            dense
          >
            <template #no-data>
              <div class="text-center q-pa-md text-grey-7">
                Aucun dossier d’inscription pour cet étudiant.
              </div>
            </template>
            <template #body-cell-statut="p">
              <q-td :props="p">
                <span class="champ badge-statut" :class="classeStatutInscription(p.row.statut)">
                  {{ LIBELLE_STATUT_INSCRIPTION[p.row.statut] ?? p.row.statut }}
                </span>
              </q-td>
            </template>
            <template #body-cell-montant="p">
              <q-td :props="p" class="text-right text-weight-medium chiffres">
                {{ montantLisible(p.row.montantFrais) }} GNF
              </q-td>
            </template>
            <template #body-cell-actions="p">
              <q-td :props="p" class="text-right">
                <q-btn
                  v-if="peutVoirPaiements"
                  flat
                  dense
                  round
                  color="primary"
                  icon="payments"
                  aria-label="Voir les paiements de ce dossier"
                  @click="allerAuxPaiementsDuDossier(p.row)"
                >
                  <q-tooltip>Paiements de ce dossier</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  icon="print"
                  aria-label="Imprimer le certificat d'inscription"
                  @click="imprimerDossier(p.row)"
                >
                  <q-tooltip>Certificat d’inscription</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Fermer" v-close-popup />
          <q-btn
            v-if="peutValiderVoir && etudiantInscriptions"
            unelevated
            color="primary"
            no-caps
            icon="how_to_reg"
            label="Ouvrir dans les inscriptions"
            @click="allerAuxInscriptions(etudiantInscriptions)"
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
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import EtudiantDialog from '../components/EtudiantDialog.vue';
import FilterBar from '../components/FilterBar.vue';
import PaginationBar from '../components/PaginationBar.vue';
import ViewToggle from '../components/ViewToggle.vue';
import AutocompleteAsync from '../components/AutocompleteAsync.vue';
import ChampDate from '../components/ChampDate.vue';
import {
  LIBELLE_STATUT_INSCRIPTION,
  dateLisible,
  montantLisible,
} from '../utils/libelles';
import type { Etudiant, Inscription, Promotion, ChipFiltre } from '../types';

interface EtudiantRegistre extends Etudiant {
  inscriptions?: {
    id: string;
    promotionId?: string;
    promotion?: Promotion | null;
    createdAt?: string;
  }[];
}

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const etudiants = ref<EtudiantRegistre[]>([]);
const promotions = ref<Promotion[]>([]);
const chargement = ref(false);
const dialogOuvert = ref(false);
const etudiantEdite = ref<EtudiantRegistre | null>(null);
const modeVue = ref<'tableau' | 'cartes'>('tableau');

const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
/** Tant que les filtres d'ouverture ne sont pas posés, le watcher ne recharge pas. */
const pret = ref(false);

const filtres = ref<Record<string, any>>({});

const dialogInscriptions = ref(false);
const listeInscriptions = ref<Inscription[]>([]);
const etudiantInscriptions = ref<EtudiantRegistre | null>(null);
const chargementInscriptions = ref(false);

const peutGerer = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutValiderVoir = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION', 'CHEF_DEPARTEMENT']));
/** Le suivi financier n'est ouvert qu'aux écrans qui portent la route /paiements. */
const peutVoirPaiements = computed(() => auth.aRole(['ADMIN', 'SCOLARITE', 'DIRECTION']));
const peutGererCompte = (e: EtudiantRegistre) => auth.estAdmin || !e.user;

const optionsActif = [
  { label: 'Actifs', value: 'true' },
  { label: 'Inactifs', value: 'false' },
];
const optionsSexe = [
  { label: 'Masculin', value: 'M' },
  { label: 'Féminin', value: 'F' },
];

const colonnes: QTableColumn[] = [
  { name: 'nom', label: 'Nom & prénom', field: 'nom', align: 'left', sortable: true },
  { name: 'sexe', label: 'Genre', field: 'sexe', align: 'left' },
  { name: 'promotion', label: 'Dernière promotion', field: 'promotion', align: 'left' },
  { name: 'telephone', label: 'Téléphone', field: 'telephone', align: 'left' },
  { name: 'email', label: 'E-mail', field: 'email', align: 'left' },
  { name: 'comptes', label: 'Compte', field: 'comptes', align: 'center' },
  { name: 'inscriptions', label: 'Inscriptions', field: 'inscriptions', align: 'right', sortable: true },
  { name: 'actif', label: 'Actif', field: 'actif', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const colonnesInscriptions: QTableColumn[] = [
  { name: 'numero', label: 'N°', field: 'numero', align: 'left' },
  { name: 'promotion', label: 'Promotion', field: (r) => r.promotion?.nom ?? '—', align: 'left' },
  { name: 'annee', label: 'Année', field: (r) => r.annee?.libelle ?? '—', align: 'left' },
  { name: 'statut', label: 'Statut', field: 'statut', align: 'left' },
  { name: 'montant', label: 'Frais d’inscription', field: 'montantFrais', align: 'right' },
  { name: 'date', label: 'Créé le', field: (r) => dateLisible(r.createdAt), align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

const classeStatutInscription = (s: string) =>
  ({
    BROUILLON: 'champ--brouillon',
    EN_ATTENTE_PAIEMENT: 'champ--attente-paiement',
    PAYEE: 'champ--payee',
    VALIDEE: 'champ--validee',
    ANNULEE: 'champ--annulee',
  })[s] ?? 'champ--brouillon';

const dernierePromo = (e: EtudiantRegistre) => e.inscriptions?.[0]?.promotion?.nom ?? null;

/** Au moins un critère est posé : l'état vide se répare en réinitialisant. */
const filtresActifs = computed(() =>
  Object.entries(filtres.value).some(([, v]) => v !== null && v !== undefined && v !== ''),
);

const messageVide = computed(() =>
  filtresActifs.value
    ? 'Aucun étudiant ne correspond à ces critères.'
    : 'Le registre est vide : commencez par créer une fiche étudiant.',
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
  if (filtres.value.promotionId) {
    const p = promotions.value.find((x) => x.id === filtres.value.promotionId);
    cs.push({ label: `Promo : ${p?.nom ?? '?'}`, value: filtres.value.promotionId, icone: 'school' });
  }
  if (filtres.value.actif) {
    cs.push({
      label: filtres.value.actif === 'true' ? 'Actifs' : 'Inactifs',
      value: filtres.value.actif,
      icone: 'toggle_on', cle: 'actif'});
  }
  if (filtres.value.sexe) {
    cs.push({
      label: `Genre : ${filtres.value.sexe === 'F' ? 'Féminin' : 'Masculin'}`,
      value: filtres.value.sexe,
      icone: 'wc',
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

function ouvrir(e: EtudiantRegistre | null) {
  etudiantEdite.value = e;
  dialogOuvert.value = true;
}

/** Dernier dossier connu — les inscriptions arrivent triées du plus récent au plus ancien. */
const derniereInscription = (e: EtudiantRegistre) => e.inscriptions?.[0] ?? null;

/**
 * Désactiver un étudiant lui ferme le portail et le retire des feuilles de
 * notes : la bascule se confirme, comme toute décision de registre.
 */
function basculerActif(e: EtudiantRegistre, v: unknown) {
  const actif = v === true;
  const appliquer = async () => {
    try {
      await api.put(`/etudiants/${e.id}`, { actif });
      e.actif = actif;
      $q.notify({
        type: 'positive',
        message: actif ? 'Étudiant réactivé' : 'Étudiant désactivé',
      });
    } catch {
      /* Notification gérée par l'intercepteur axios */
    }
  };
  if (actif) {
    void appliquer();
    return;
  }
  $q.dialog({
    title: 'Désactiver l’étudiant',
    message: `Désactiver ${e.prenom} ${e.nom} (${e.matricule}) ? Sa fiche est conservée, mais l’accès au portail lui est fermé.`,
    cancel: true,
    ok: { color: 'negative', label: 'Désactiver', unelevated: true, noCaps: true },
  }).onOk(() => void appliquer());
  // Bascule refusée : la case reste pilotée par `actif`, rien à défaire.
}

/**
 * Dossiers de l'étudiant. `/inscriptions` ne filtre pas par `etudiantId` :
 * on interroge par matricule (unique, couvert par la recherche serveur) puis
 * on resserre côté client sur l'identifiant exact.
 */
async function voirInscriptions(e: EtudiantRegistre) {
  etudiantInscriptions.value = e;
  dialogInscriptions.value = true;
  chargementInscriptions.value = true;
  try {
    const { data } = await api.get('/inscriptions', {
      params: { all: '1', search: e.matricule },
    });
    const liste: Inscription[] = Array.isArray(data) ? data : data.data ?? [];
    listeInscriptions.value = liste.filter((i) => i.etudiantId === e.id);
  } catch {
    listeInscriptions.value = [];
  } finally {
    chargementInscriptions.value = false;
  }
}

/** Écran Inscriptions préfiltré sur l'étudiant. */
function allerAuxInscriptions(e: EtudiantRegistre) {
  void router.push({ path: '/inscriptions', query: { etudiant: e.id } });
}

/** Écran Paiements préfiltré sur l'étudiant. */
function allerAuxPaiements(e: EtudiantRegistre) {
  void router.push({ path: '/paiements', query: { etudiant: e.id } });
}

/** Écran Paiements préfiltré sur un dossier précis. */
function allerAuxPaiementsDuDossier(dossier: Inscription) {
  void router.push({ path: '/paiements', query: { inscription: dossier.id } });
}

/**
 * Les notes se tiennent par évaluation, pas par étudiant : on ouvre les
 * épreuves de sa promotion, d'où la saisie et la consultation sont accessibles.
 */
function allerAuxEvaluations(e: EtudiantRegistre) {
  const promotionId = derniereInscription(e)?.promotionId;
  if (!promotionId) {
    $q.notify({
      type: 'warning',
      message: `${e.prenom} ${e.nom} n’est inscrit dans aucune promotion.`,
    });
    return;
  }
  void router.push({ path: '/evaluations', query: { promotion: promotionId } });
}

/**
 * Le certificat d'inscription s'édite à partir d'un dossier, pas d'une fiche :
 * on imprime celui du dernier dossier de l'étudiant.
 */
function imprimerAttestation(e: EtudiantRegistre) {
  const dossier = derniereInscription(e);
  if (!dossier) {
    $q.notify({
      type: 'warning',
      message: `${e.prenom} ${e.nom} n’a aucun dossier d’inscription : rien à imprimer.`,
    });
    return;
  }
  const url = `${API_URL}/inscriptions/${dossier.id}/attestation-inscription?token=${encodeURIComponent(auth.token)}`;
  window.open(url, '_blank');
}

/** Certificat d'un dossier précis, depuis la liste des dossiers de l'étudiant. */
function imprimerDossier(dossier: Inscription) {
  const url = `${API_URL}/inscriptions/${dossier.id}/attestation-inscription?token=${encodeURIComponent(auth.token)}`;
  window.open(url, '_blank');
}

/** Paramètres réellement compris par `GET /etudiants`. */
function paramsServeur(): Record<string, any> {
  const params: Record<string, any> = { all: '1' };
  if (filtres.value.recherche) params.search = filtres.value.recherche;
  if (filtres.value.actif) params.actif = filtres.value.actif;
  return params;
}

/**
 * Promotion, genre et dates ne sont pas filtrés par l'API : on les applique
 * sur la page reçue, à partir du dernier dossier de chaque fiche.
 */
function filtrerLocalement(liste: EtudiantRegistre[]): EtudiantRegistre[] {
  let r = liste;
  if (filtres.value.promotionId) {
    r = r.filter((e) => derniereInscription(e)?.promotionId === filtres.value.promotionId);
  }
  if (filtres.value.sexe) r = r.filter((e) => e.sexe === filtres.value.sexe);
  if (filtres.value.dateDebut) {
    const d = new Date(filtres.value.dateDebut).getTime();
    r = r.filter((e) => {
      const c = derniereInscription(e)?.createdAt ?? null;
      return c ? new Date(c).getTime() >= d : true;
    });
  }
  if (filtres.value.dateFin) {
    const d = new Date(filtres.value.dateFin).getTime() + 86_400_000 - 1;
    r = r.filter((e) => {
      const c = derniereInscription(e)?.createdAt ?? null;
      return c ? new Date(c).getTime() <= d : true;
    });
  }
  return r;
}

/** Un filtre non géré par l'API restreint la page affichée, pas le total serveur. */
const filtrageLocalActif = computed(
  () =>
    !!filtres.value.promotionId ||
    !!filtres.value.sexe ||
    !!filtres.value.dateDebut ||
    !!filtres.value.dateFin,
);

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/etudiants', {
      params: { ...paramsServeur(), page: page.value, pageSize: pageSize.value },
    });
    const liste = filtrerLocalement(data.data ?? []);
    etudiants.value = liste;
    total.value = data.total ?? liste.length;
  } catch {
    etudiants.value = [];
    total.value = 0;
  } finally {
    chargement.value = false;
  }
}

async function chargerTout() {
  chargement.value = true;
  try {
    const { data } = await api.get('/etudiants', {
      params: { ...paramsServeur(), pageSize: 1000 },
    });
    const liste = filtrerLocalement(data.data ?? []);
    etudiants.value = liste;
    total.value = liste.length;
    pageSize.value = Math.max(liste.length, 1);
    page.value = 1;
  } catch {
    etudiants.value = [];
    total.value = 0;
  } finally {
    chargement.value = false;
  }
}

function reinitialiser() {
  filtres.value = {};
  page.value = 1;
  void charger();
}

watch(
  () => [
    filtres.value.recherche,
    filtres.value.promotionId,
    filtres.value.actif,
    filtres.value.sexe,
    filtres.value.dateDebut,
    filtres.value.dateFin,
  ],
  () => {
    if (!pret.value) return;
    page.value = 1;
    void charger();
  },
);

onMounted(async () => {
  try {
    const { data } = await api.get('/promotions', { params: { all: '1' } });
    promotions.value = data.data ?? [];
  } catch {
    promotions.value = [];
  }
  // `/etudiants?recherche=…` : arrivée depuis un dossier ou un paiement.
  const recherche = route.query.recherche as string | undefined;
  if (recherche) filtres.value.recherche = recherche;
  pret.value = true;
  await charger();
});
</script>

<style scoped lang="scss">
.etudiants-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.etudiants-cartes__carte {
  background: var(--up-plaque);
}

// État vide : on nomme la cause et on offre la sortie.
.etudiants-vide {
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
.champ--validee { background: #1565c0; }
.champ--annulee { background: #c2321e; }
</style>
