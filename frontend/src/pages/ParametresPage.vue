<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Paramètres</div>
        <div class="page-sous-titre">
          Règles appliquées lors du pointage : tolérance de retard, preuves exigées, en-tête des états
        </div>
      </div>
      <div class="col-auto q-gutter-sm">
        <q-btn
          flat
          no-caps
          icon="undo"
          label="Annuler mes modifications"
          :disable="!modifie || chargement"
          @click="charger"
        />
        <q-btn
          color="primary"
          unelevated
          no-caps
          icon="save"
          label="Enregistrer les paramètres"
          :disable="!modifie"
          :loading="enregistrement"
          @click="enregistrer"
        />
      </div>
    </div>

    <q-banner v-if="modifie" class="note--alerte q-mb-md" style="max-width: 820px">
      <template #avatar><q-icon name="edit_note" /></template>
      Modifications non enregistrées — elles ne s’appliqueront qu’après enregistrement.
    </q-banner>

    <q-linear-progress v-if="chargement" indeterminate color="primary" class="q-mb-sm" />

    <q-card
      v-for="groupe in groupes"
      :key="groupe.titre"
      flat
      bordered
      class="carte q-mb-md"
      style="max-width: 820px"
    >
      <q-card-section class="q-pb-none">
        <span class="section-titre">{{ groupe.titre }}</span>
        <div class="text-caption text-grey-7">{{ groupe.aide }}</div>
      </q-card-section>
      <q-list separator>
        <q-item v-for="p in groupe.parametres" :key="p.cle">
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ etiquette(p.cle) }}</q-item-label>
            <q-item-label caption>{{ p.description }}</q-item-label>
          </q-item-section>
          <q-item-section side style="min-width: 220px">
            <q-toggle
              v-if="estBooleen(p.valeur)"
              :model-value="p.valeur === 'true'"
              :aria-label="etiquette(p.cle)"
              @update:model-value="(v) => (p.valeur = String(v))"
            />
            <q-input
              v-else
              v-model="p.valeur"
              outlined
              dense
              :type="estNombre(p.valeur) ? 'number' : 'text'"
              :aria-label="etiquette(p.cle)"
            />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <div v-if="!chargement && !parametres.length" class="etat-vide">
      <q-icon name="settings" size="34px" />
      <div class="pochoir">Aucun paramètre disponible.</div>
      <q-btn flat no-caps icon="refresh" label="Recharger" @click="charger" />
    </div>

    <!-- --------------------------------------------------- Journal d'audit -->
    <q-card flat bordered class="carte q-mt-lg" style="max-width: 1100px">
      <q-card-section class="row items-center q-pb-none">
        <div class="col">
          <span class="section-titre">Journal d’audit</span>
          <div class="text-caption text-grey-7">
            Qui a fait quoi, et quand — les corrections de pointage sont tracées ici.
          </div>
        </div>
        <div class="col-auto">
          <q-select
            v-model="entite"
            :options="optionsEntites"
            outlined
            dense
            clearable
            emit-value
            map-options
            label="Entité"
            style="min-width: 180px"
            @update:model-value="() => { pageAudit = 1; chargerAudit(); }"
          />
        </div>
      </q-card-section>
      <q-separator class="q-mt-md" />
      <q-table
        flat
        :rows="audit"
        :columns="colonnesAudit"
        row-key="id"
        :pagination="{ rowsPerPage: 0 }"
        :loading="chargementAudit"
      >
        <template #no-data>
          <div class="etat-vide">
            <q-icon name="history" size="34px" />
            <div class="pochoir">
              {{ entite ? 'Aucune trace pour cette entité.' : 'Aucune trace enregistrée.' }}
            </div>
          </div>
        </template>
      </q-table>
      <pagination-bar
        v-if="audit.length"
        :page="pageAudit"
        :page-size="pageSizeAudit"
        :total="totalAudit"
        :show-all="false"
        @update:page="(v) => { pageAudit = v; chargerAudit(); }"
        @update:page-size="(v) => { pageSizeAudit = v; pageAudit = 1; chargerAudit(); }"
      />
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import PaginationBar from '../components/PaginationBar.vue';
import { dateHeureLisible } from '../utils/libelles';

const $q = useQuasar();

interface Parametre {
  cle: string;
  valeur: string;
  description?: string | null;
}

interface TraceAudit {
  id: string;
  createdAt: string;
  action: string;
  entite?: string | null;
  entiteId?: string | null;
  details?: string | null;
  ip?: string | null;
  user?: { nom: string; prenom: string; role: string } | null;
}

const parametres = ref<Parametre[]>([]);
/** Copie de référence : sert à détecter les modifications non enregistrées. */
const reference = ref<Record<string, string>>({});
const audit = ref<TraceAudit[]>([]);
const chargement = ref(false);
const enregistrement = ref(false);
const chargementAudit = ref(false);

const entite = ref<string | null>(null);
const pageAudit = ref(1);
const pageSizeAudit = ref(20);
const totalAudit = ref(0);

const ETIQUETTES: Record<string, string> = {
  NOM_ETABLISSEMENT: 'Nom de l’établissement',
  TOLERANCE_RETARD_MIN: 'Tolérance avant retard (minutes)',
  ABSENCE_APRES_MIN: 'Absence constatée après (minutes)',
  DUREE_MIN_VALIDE: 'Durée minimale d’une séance tenue (minutes)',
  QR_OBLIGATOIRE: 'Scan du QR de la salle obligatoire',
  GEOLOC_OBLIGATOIRE: 'Position GPS obligatoire',
  ATTESTATION_OBLIGATOIRE: 'Attestation de présence de l’enseignant obligatoire',
  SIGNATURE_OBLIGATOIRE: 'Signature manuscrite obligatoire',
  EMPREINTE_SCORE_MIN: 'Score minimal du lecteur d’empreintes (0-100)',
  EFFECTIF_OBLIGATOIRE: 'Comptage des étudiants obligatoire',
};

/** Regroupement lisible : l'établissement, le temps, puis les preuves. */
const GROUPES: Array<{ titre: string; aide: string; cles: string[] }> = [
  {
    titre: 'Établissement',
    aide: 'Identité reprise en en-tête de tous les états imprimés.',
    cles: ['NOM_ETABLISSEMENT'],
  },
  {
    titre: 'Tolérances horaires',
    aide: 'À partir de quand un enseignant est en retard, absent, ou sa séance non tenue.',
    cles: ['TOLERANCE_RETARD_MIN', 'ABSENCE_APRES_MIN', 'DUREE_MIN_VALIDE'],
  },
  {
    titre: 'Preuves exigées au pointage',
    aide: 'Ce que le contrôleur doit fournir pour qu’un pointage soit recevable.',
    cles: [
      'QR_OBLIGATOIRE',
      'GEOLOC_OBLIGATOIRE',
      'ATTESTATION_OBLIGATOIRE',
      'SIGNATURE_OBLIGATOIRE',
      'EMPREINTE_SCORE_MIN',
      'EFFECTIF_OBLIGATOIRE',
    ],
  },
];

const etiquette = (cle: string) => ETIQUETTES[cle] ?? cle;
const estBooleen = (v: string) => v === 'true' || v === 'false';
const estNombre = (v: string) => /^\d+$/.test(v);

const groupes = computed(() => {
  const classees = new Set(GROUPES.flatMap((g) => g.cles));
  const blocs = GROUPES.map((g) => ({
    titre: g.titre,
    aide: g.aide,
    parametres: g.cles
      .map((c) => parametres.value.find((p) => p.cle === c))
      .filter((p): p is Parametre => !!p),
  })).filter((g) => g.parametres.length);

  // Une clé ajoutée côté serveur reste visible même sans étiquette dédiée.
  const autres = parametres.value.filter((p) => !classees.has(p.cle));
  if (autres.length) {
    blocs.push({
      titre: 'Autres réglages',
      aide: 'Clés propres à cet établissement.',
      parametres: autres,
    });
  }
  return blocs;
});

const modifie = computed(() =>
  parametres.value.some((p) => reference.value[p.cle] !== p.valeur),
);

const optionsEntites = [
  { label: 'Contrôles', value: 'Controle' },
  { label: 'Séances', value: 'Seance' },
  { label: 'Utilisateurs', value: 'User' },
];

const colonnesAudit: QTableColumn[] = [
  {
    name: 'date',
    label: 'Date',
    field: (r: TraceAudit) => dateHeureLisible(r.createdAt),
    align: 'left',
  },
  {
    name: 'utilisateur',
    label: 'Utilisateur',
    field: (r: TraceAudit) => (r.user ? `${r.user.prenom} ${r.user.nom}` : '—'),
    align: 'left',
  },
  { name: 'action', label: 'Action', field: 'action', align: 'left' },
  { name: 'entite', label: 'Entité', field: (r: TraceAudit) => r.entite || '—', align: 'left' },
  { name: 'details', label: 'Détails', field: (r: TraceAudit) => r.details || '—', align: 'left' },
  { name: 'ip', label: 'Poste', field: (r: TraceAudit) => r.ip || '—', align: 'left' },
];

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/parametres');
    parametres.value = data;
    reference.value = Object.fromEntries(
      (data as Parametre[]).map((p) => [p.cle, p.valeur]),
    );
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Chargement des paramètres impossible',
    });
  } finally {
    chargement.value = false;
  }
}

async function chargerAudit() {
  chargementAudit.value = true;
  try {
    const { data } = await api.get('/controles/audit', {
      params: {
        page: pageAudit.value,
        pageSize: pageSizeAudit.value,
        ...(entite.value ? { entite: entite.value } : {}),
      },
    });
    audit.value = data.data ?? [];
    totalAudit.value = data.total ?? audit.value.length;
  } catch (e: any) {
    audit.value = [];
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Journal d’audit illisible',
    });
  } finally {
    chargementAudit.value = false;
  }
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    const { data } = await api.put('/parametres', { parametres: parametres.value });
    parametres.value = data;
    reference.value = Object.fromEntries(
      (data as Parametre[]).map((p) => [p.cle, p.valeur]),
    );
    $q.notify({ type: 'positive', message: 'Paramètres enregistrés' });
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Enregistrement impossible',
    });
  } finally {
    enregistrement.value = false;
  }
}

onMounted(async () => {
  await charger();
  await chargerAudit();
});
</script>

<style scoped lang="scss">
</style>
