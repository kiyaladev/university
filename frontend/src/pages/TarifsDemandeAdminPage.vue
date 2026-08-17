<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="page-titre">Tarifs des demandes de documents</div>
        <div class="page-sous-titre">
          Chaque type de document (attestation de scolarité, relevé de notes,
          duplicata…) est facturé au tarif paramétré ici. Le délai de
          traitement annoncé à l'étudiant en dépend.
        </div>
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
          <q-btn flat dense round icon="edit" @click="ouvrir(p.row)">
            <q-tooltip>Modifier</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <q-banner v-if="!rolePasBon && !tarifs.length && !chargement" class="note--info q-mt-md">
      Aucun tarif enregistré. Les demandes créées par les étudiants
      remonteront sans frais tant que les tarifs ne sont pas paramétrés.
    </q-banner>

    <q-dialog v-model="dialogOuvert">
      <q-card style="width: 480px; max-width: 95vw">
        <q-card-section class="text-h6">
          {{ tarifEdite ? 'Modifier le tarif' : 'Nouveau tarif' }}
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="form.type"
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
          />
          <q-input
            v-model.number="form.delaiHeures"
            type="number"
            outlined
            dense
            min="1"
            label="Délai habituel (heures)"
          />
        </q-card-section>
        <q-banner v-if="erreur" dense class="note--erreur q-mx-md q-mb-sm">
          <template #avatar><q-icon name="warning" /></template>
          {{ erreur }}
        </q-banner>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            icon="save"
            label="Enregistrer"
            :loading="enregistrement"
            @click="enregistrer"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import { montantLisible } from '../utils/libelles';
import type { TarifDemande, TypeDemandeDocument } from '../types';

const $q = useAuthStore();
const q = useQuasar();

const auth = useAuthStore();
const rolePasBon = computed(() => auth.utilisateur && auth.utilisateur.role !== 'ADMIN');

const tarifs = ref<TarifDemande[]>([]);
const chargement = ref(false);
const dialogOuvert = ref(false);
const tarifEdite = ref<TarifDemande | null>(null);
const enregistrement = ref(false);
const erreur = ref('');

const form = ref({
  type: 'AUTRE' as TypeDemandeDocument,
  montant: 0,
  delaiHeures: 72,
});

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
  }
  dialogOuvert.value = true;
  erreur.value = '';
}

async function enregistrer() {
  enregistrement.value = true;
  erreur.value = '';
  try {
    if (tarifEdite.value) {
      await api.put(`/documents-demande/tarifs/${tarifEdite.value.id}`, {
        montant: form.value.montant,
        delaiHeures: form.value.delaiHeures,
      });
      q.notify({ type: 'positive', message: 'Tarif mis à jour' });
    } else {
      await api.post('/documents-demande/tarifs', {
        type: form.value.type,
        montant: form.value.montant,
        delaiHeures: form.value.delaiHeures,
      });
      q.notify({ type: 'positive', message: 'Tarif créé' });
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