<template>
  <q-dialog v-model="dialogOuvert">
    <q-card style="width: 640px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ formation ? 'Modifier la formation' : 'Nouvelle formation' }}</div>
        <div class="text-caption text-grey-7">
          Toute formation naît en brouillon : rien ne se vend avant publication.
          Dès la première inscription confirmée, le titre et le prix se figent.
        </div>
      </q-card-section>

      <q-card-section>
        <span class="section-titre">Présentation</span>
        <q-input
          v-model="form.titre"
          outlined
          dense
          label="Titre de la formation *"
          hint="Ex. : Certification professionnelle en comptabilité"
          autofocus
        />
        <q-input
          v-model="form.description"
          outlined
          dense
          type="textarea"
          rows="3"
          autogrow
          label="Description"
        />
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.categorie"
              outlined
              dense
              label="Catégorie"
              hint="Ex. : Informatique, Gestion, Santé…"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.lieu"
              outlined
              dense
              label="Lieu / district"
              hint="Campus, salle, faculté…"
            />
          </div>
        </div>

        <span class="section-titre">Tarif</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-8">
            <q-input
              v-model.number="form.prix"
              type="number"
              min="0"
              outlined
              dense
              label="Prix (GNF) *"
            />
          </div>
          <div class="col-12 col-sm-4">
            <q-select
              v-model="form.devise"
              :options="['GNF']"
              outlined
              dense
              emit-value
              map-options
              label="Devise"
            />
          </div>
        </div>

        <span class="section-titre">Déroulement</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.dureeHeures"
              type="number"
              min="1"
              outlined
              dense
              label="Durée (heures)"
            />
          </div>
          <div class="col-12 col-sm-3">
            <champ-date v-model="form.dateDebut" label="Début" />
          </div>
          <div class="col-12 col-sm-3">
            <champ-date v-model="form.dateFin" label="Fin" />
          </div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model.number="form.capacite"
              type="number"
              min="1"
              outlined
              dense
              label="Capacité (places)"
              hint="Vide = accès libre"
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-select
              v-model="form.statut"
              :options="optionsStatuts"
              outlined
              dense
              emit-value
              map-options
              label="Statut"
              :disable="!!formation"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          label="Enregistrer"
          :loading="enregistrement"
          :disable="form.titre.trim().length < 3"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import ChampDate from './ChampDate.vue';
import { LIBELLE_STATUT_FORMATION } from '../utils/libelles';
import type { Formation, StatutFormation } from '../types';

const props = defineProps<{ modelValue: boolean; formation?: Formation | null }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();

const DEVICES = ['GNF'];
const optionsStatuts = Object.entries(LIBELLE_STATUT_FORMATION).map(([value, label]) => ({
  value: value as StatutFormation,
  label,
}));

const dialogOuvert = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const enregistrement = ref(false);

const form = ref({
  titre: '',
  description: '',
  categorie: '',
  prix: 0 as number | null,
  devise: 'GNF',
  dureeHeures: null as number | null,
  dateDebut: '',
  dateFin: '',
  lieu: '',
  capacite: null as number | null,
  statut: 'BROUILLON' as StatutFormation,
});

watch(dialogOuvert, (ouvert) => {
  if (!ouvert) return;
  const f = props.formation;
  if (f) {
    form.value = {
      titre: f.titre,
      description: f.description ?? '',
      categorie: f.categorie ?? '',
      prix: f.prix ?? 0,
      devise: f.devise ?? 'GNF',
      dureeHeures: f.dureeHeures ?? null,
      dateDebut: f.dateDebut ?? '',
      dateFin: f.dateFin ?? '',
      lieu: f.lieu ?? '',
      capacite: f.capacite ?? null,
      statut: f.statut,
    };
  } else {
    form.value = {
      titre: '',
      description: '',
      categorie: '',
      prix: 0,
      devise: 'GNF',
      dureeHeures: null,
      dateDebut: '',
      dateFin: '',
      lieu: '',
      capacite: null,
      statut: 'BROUILLON',
    };
  }
});

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = {
      titre: form.value.titre.trim(),
      description: form.value.description.trim() || undefined,
      categorie: form.value.categorie.trim() || undefined,
      prix: form.value.prix ?? 0,
      devise: form.value.devise,
      dureeHeures: form.value.dureeHeures ?? null,
      dateDebut: form.value.dateDebut || undefined,
      dateFin: form.value.dateFin || undefined,
      lieu: form.value.lieu.trim() || undefined,
      capacite: form.value.capacite ?? null,
      statut: form.value.statut,
    };
    if (props.formation) {
      await api.put(`/formations/${props.formation.id}`, payload);
      $q.notify({ type: 'positive', message: 'Formation mise à jour' });
    } else {
      await api.post('/formations', payload);
      $q.notify({ type: 'positive', message: 'Formation enregistrée — pensez à la publier' });
    }
    dialogOuvert.value = false;
    emit('enregistre');
  } finally {
    enregistrement.value = false;
  }
}
</script>