<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Tarifs des demandes</div>
        <div class="page-sous-titre">
          Chaque type de document (attestation de scolarité, relevé de notes,
          duplicata…) est facturé au tarif paramétré ici. Le montant et le délai
          annoncés à l'étudiant au moment de sa demande en dépendent.
        </div>
      </div>
      <div v-if="!rolePasBon" class="col-auto q-gutter-sm">
        <q-btn
          outline
          color="primary"
          icon="description"
          label="Demandes de documents"
          no-caps
          :to="{ name: 'demandes-docs' }"
        />
        <q-btn
          unelevated
          color="primary"
          icon="add"
          label="Nouveau tarif"
          no-caps
          :disable="!optionsTypeCreation.length"
          @click="ouvrir(null)"
        >
          <q-tooltip v-if="!optionsTypeCreation.length">
            Tous les types de document ont déjà un tarif : modifiez-le.
          </q-tooltip>
        </q-btn>
      </div>
    </div>

    <q-banner v-if="rolePasBon" class="note--erreur q-mb-md">
      Cette page est réservée à l'administrateur. Vous êtes connecté en
      {{ auth.utilisateur?.role }}.
    </q-banner>

    <q-table
      v-if="!rolePasBon"
      flat
      bordered
      class="carte"
      :rows="tarifs"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :rows-per-page-options="[0]"
      hide-bottom
    >
      <template #no-data>
        <div class="text-center q-pa-md text-grey-7">
          Aucun tarif enregistré. Tant qu'un type n'a pas de tarif, les demandes
          des étudiants sont créées sans frais et passent directement en
          traitement.
        </div>
      </template>
      <template #body-cell-type="p">
        <q-td :props="p">{{ libelleType(p.row.type) }}</q-td>
      </template>
      <template #body-cell-montant="p">
        <q-td :props="p" class="text-right chiffres">
          {{ montantLisible(p.row.montant) }} {{ p.row.devise }}
        </q-td>
      </template>
      <template #body-cell-delaiHeures="p">
        <q-td :props="p" class="text-right chiffres">
          {{ p.row.delaiHeures }} h
        </q-td>
      </template>
      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn flat dense round icon="edit" aria-label="Modifier le tarif" @click="ouvrir(p.row)">
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="dialogOuvert">
      <q-card style="width: 480px; max-width: 95vw">
        <q-form ref="formRef" @submit.prevent="enregistrer">
          <q-card-section class="text-h6">
            {{ tarifEdite ? 'Modifier le tarif' : 'Nouveau tarif' }}
          </q-card-section>
          <q-card-section>
            <q-select
              v-if="!tarifEdite"
              v-model="form.type"
              :options="optionsTypeCreation"
              emit-value
              map-options
              outlined
              dense
              label="Type"
              hint="Le type est figé après création"
              class="q-mb-md"
              :rules="[(v) => !!v || 'Type requis']"
            />
            <q-input
              v-else
              :model-value="libelleType(form.type)"
              outlined
              dense
              label="Type"
              disable
              hint="Le type est figé après création"
              class="q-mb-md"
            />
            <q-input
              v-model.number="form.montant"
              type="number"
              outlined
              dense
              min="0"
              label="Montant"
              suffix="GNF"
              class="q-mb-md"
              :rules="[(v) => (v !== null && v !== undefined && v > 0) || 'Montant requis']"
            />
            <q-input
              v-model.number="form.delaiHeures"
              type="number"
              outlined
              dense
              min="1"
              label="Délai habituel (heures)"
              :rules="[(v) => (v !== null && v !== undefined && v > 0) || 'Délai requis']"
            />
          </q-card-section>
          <q-banner v-if="erreur" dense class="note--erreur q-mx-md q-mb-sm">
            <template #avatar><q-icon name="warning" /></template>
            {{ erreur }}
          </q-banner>
          <q-card-actions align="right">
            <q-btn flat label="Annuler" no-caps v-close-popup />
            <q-btn
              color="primary"
              unelevated
              icon="save"
              label="Enregistrer"
              no-caps
              :loading="enregistrement"
              :disable="!formulaireValide"
              type="submit"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { LIBELLE_TYPE_DEMANDE, montantLisible, optionsDepuis } from '../utils/libelles';
import type { TarifDemande, TypeDemandeDocument } from '../types';

const $q = useQuasar();

const auth = useAuthStore();
const rolePasBon = computed(() => auth.utilisateur && auth.utilisateur.role !== 'ADMIN');

const tarifs = ref<TarifDemande[]>([]);
const chargement = ref(false);
const dialogOuvert = ref(false);
const tarifEdite = ref<TarifDemande | null>(null);
const enregistrement = ref(false);
const erreur = ref('');
const formRef = ref<{ validate: () => Promise<boolean>; resetValidation: () => void } | null>(null);

const form = ref({
  type: 'AUTRE' as TypeDemandeDocument,
  montant: 0,
  delaiHeures: 72,
});

/** Mêmes libellés de type que les écrans de demande (scolarité et étudiant). */
const TYPES_DOCUMENT = optionsDepuis(LIBELLE_TYPE_DEMANDE) as {
  value: TypeDemandeDocument;
  label: string;
}[];

function libelleType(t: string) {
  return LIBELLE_TYPE_DEMANDE[t as TypeDemandeDocument] ?? t;
}

const optionsTypeCreation = computed(() =>
  TYPES_DOCUMENT.filter((t) => !tarifs.value.some((x) => x.type === t.value)),
);

const formulaireValide = computed(
  () => !!form.value.type && form.value.montant > 0 && form.value.delaiHeures > 0,
);

const colonnes: QTableColumn[] = [
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  { name: 'montant', label: 'Montant', field: 'montant', align: 'right' },
  { name: 'delaiHeures', label: 'Délai', field: 'delaiHeures', align: 'right' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

function ouvrir(t: TarifDemande | null) {
  tarifEdite.value = t;
  if (t) {
    form.value = { type: t.type, montant: t.montant, delaiHeures: t.delaiHeures };
  } else {
    const premierTypeDisponible =
      TYPES_DOCUMENT.find((x) => !tarifs.value.some((y) => y.type === x.value))?.value ?? 'AUTRE';
    form.value = { type: premierTypeDisponible, montant: 0, delaiHeures: 72 };
  }
  formRef.value?.resetValidation();
  dialogOuvert.value = true;
  erreur.value = '';
}

async function enregistrer() {
  const valide = await formRef.value?.validate();
  if (valide === false) return;
  enregistrement.value = true;
  erreur.value = '';
  try {
    if (tarifEdite.value) {
      await api.put(`/documents-demande/tarifs/${tarifEdite.value.id}`, {
        montant: form.value.montant,
        delaiHeures: form.value.delaiHeures,
      });
      $q.notify({ type: 'positive', message: 'Tarif mis à jour' });
    } else {
      await api.post('/documents-demande/tarifs', {
        type: form.value.type,
        montant: form.value.montant,
        delaiHeures: form.value.delaiHeures,
      });
      $q.notify({ type: 'positive', message: 'Tarif créé' });
    }
    dialogOuvert.value = false;
    await charger();
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? 'Enregistrement impossible';
  } finally {
    enregistrement.value = false;
  }
}

async function charger() {
  if (!auth.estAdmin) return;
  chargement.value = true;
  try {
    const { data } = await api.get('/documents-demande/tarifs');
    tarifs.value = Array.isArray(data) ? data : data.data ?? [];
  } catch {
    tarifs.value = [];
  } finally {
    chargement.value = false;
  }
}

onMounted(() => {
  void charger();
});
</script>