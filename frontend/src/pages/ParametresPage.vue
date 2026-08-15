<template>
  <q-page class="q-pa-md">
    <div class="page-titre">Paramètres du contrôle</div>
    <div class="page-sous-titre q-mb-md">
      Règles appliquées lors du pointage : tolérance de retard, preuves exigées, en-tête des états
    </div>

    <q-card flat bordered class="carte" style="max-width: 820px">
      <q-list separator>
        <q-item v-for="p in parametres" :key="p.cle">
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ etiquette(p.cle) }}</q-item-label>
            <q-item-label caption>{{ p.description }}</q-item-label>
          </q-item-section>
          <q-item-section side style="min-width: 220px">
            <q-toggle
              v-if="estBooleen(p.valeur)"
              :model-value="p.valeur === 'true'"
              @update:model-value="(v) => (p.valeur = String(v))"
            />
            <q-input
              v-else
              v-model="p.valeur"
              outlined
              dense
              :type="estNombre(p.valeur) ? 'number' : 'text'"
            />
          </q-item-section>
        </q-item>
      </q-list>

      <q-separator />
      <q-card-actions align="right">
        <q-btn flat no-caps label="Recharger" @click="charger" />
        <q-btn
          color="primary"
          unelevated
          no-caps
          icon="save"
          label="Enregistrer les paramètres"
          :loading="enregistrement"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>

    <q-card flat bordered class="carte q-mt-md" style="max-width: 820px">
      <q-card-section class="text-subtitle2">Journal d’audit</q-card-section>
      <q-separator />
      <q-table
        flat
        :rows="audit"
        :columns="colonnesAudit"
        row-key="id"
        :pagination="{ rowsPerPage: 10 }"
        :loading="chargementAudit"
      />
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '../boot/axios';
import { dateHeureLisible } from '../utils/libelles';

const $q = useQuasar();

interface Parametre {
  cle: string;
  valeur: string;
  description?: string | null;
}

const parametres = ref<Parametre[]>([]);
const audit = ref<any[]>([]);
const enregistrement = ref(false);
const chargementAudit = ref(false);

const ETIQUETTES: Record<string, string> = {
  NOM_ETABLISSEMENT: 'Nom de l’établissement',
  TOLERANCE_RETARD_MIN: 'Tolérance avant retard (minutes)',
  ABSENCE_APRES_MIN: 'Absence constatée après (minutes)',
  DUREE_MIN_VALIDE: 'Durée minimale d’une séance tenue (minutes)',
  QR_OBLIGATOIRE: 'Scan du QR de la salle obligatoire',
  GEOLOC_OBLIGATOIRE: 'Position GPS obligatoire',
  SIGNATURE_OBLIGATOIRE: 'Signature de l’enseignant obligatoire',
  EFFECTIF_OBLIGATOIRE: 'Comptage des étudiants obligatoire',
};

const etiquette = (cle: string) => ETIQUETTES[cle] ?? cle;
const estBooleen = (v: string) => v === 'true' || v === 'false';
const estNombre = (v: string) => /^\d+$/.test(v);

const colonnesAudit: QTableColumn[] = [
  {
    name: 'date',
    label: 'Date',
    field: (r: any) => dateHeureLisible(r.createdAt),
    align: 'left',
  },
  {
    name: 'utilisateur',
    label: 'Utilisateur',
    field: (r: any) => (r.user ? `${r.user.prenom} ${r.user.nom}` : '—'),
    align: 'left',
  },
  { name: 'action', label: 'Action', field: 'action', align: 'left' },
  { name: 'entite', label: 'Entité', field: 'entite', align: 'left' },
  { name: 'details', label: 'Détails', field: 'details', align: 'left' },
];

async function charger() {
  const { data } = await api.get('/parametres');
  parametres.value = data;
}

async function chargerAudit() {
  chargementAudit.value = true;
  try {
    const { data } = await api.get('/controles/audit', { params: { pageSize: 50 } });
    audit.value = data.data;
  } finally {
    chargementAudit.value = false;
  }
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    const { data } = await api.put('/parametres', { parametres: parametres.value });
    parametres.value = data;
    $q.notify({ type: 'positive', message: 'Paramètres enregistrés' });
  } finally {
    enregistrement.value = false;
  }
}

onMounted(async () => {
  await charger();
  await chargerAudit();
});
</script>
