<template>
  <q-dialog v-model="dialogOuvert">
    <q-card style="width: 720px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">
          {{ equipement ? 'Modifier l’équipement' : 'Nouvel équipement' }}
        </div>
        <div class="text-caption text-grey-7">
          {{ equipement
            ? 'Mettez à jour la fiche : numéro de série, affectation, valeur. Les réparations déjà tracées restent attachées.'
            : 'L’équipement entre à l’inventaire. La durée d’obsolescence sert au signalement Rectorat.' }}
        </div>
      </q-card-section>

      <q-card-section>
        <span class="section-titre">Identification</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.libelle"
              outlined
              dense
              label="Libellé *"
              hint="Ex. : Vidéoprojecteur Epson S41"
              autofocus
            />
          </div>
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.numeroSerie"
              outlined
              dense
              label="Numéro de série *"
              hint="Inscrit sur la plaque constructeur"
            />
          </div>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <q-input
              v-model="form.numeroInventaire"
              outlined
              dense
              label="N° d’inventaire *"
              hint="PAT-AAAA-NNNNN — laissez vide pour générer"
            />
          </div>
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.categorieId"
              label="Catégorie *"
              endpoint="/patrimoine/categories"
              :label-fn="(c) => `${c.libelle} (${c.code})`"
              :clearable="false"
            />
          </div>
        </div>

        <span class="section-titre">Affectation</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.departementId"
              label="Département"
              endpoint="/departements"
              :label-fn="(d) => d.nom"
              :clearable="true"
            />
          </div>
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.salleId"
              label="Salle"
              endpoint="/salles"
              :label-fn="(s) => `${s.code} — ${s.nom}`"
              :clearable="true"
            />
          </div>
        </div>

        <span class="section-titre">Acquisition & obsolescence</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-4">
            <champ-date v-model="form.dateAcquisition" label="Date d'acquisition" />
          </div>
          <div class="col-12 col-sm-4">
            <q-input
              v-model.number="form.valeurAcquisition"
              type="number"
              min="0"
              outlined
              dense
              label="Valeur (GNF)"
              hint="Coût d'achat"
            />
          </div>
          <div class="col-12 col-sm-4">
            <q-input
              v-model.number="form.obsolescenceMois"
              type="number"
              min="1"
              outlined
              dense
              label="Obsolescence (mois)"
              hint="60 par défaut"
            />
          </div>
        </div>

        <div class="row items-center q-mt-md">
          <q-toggle v-model="form.actif" label="Équipement en service" />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          label="Enregistrer"
          :loading="enregistrement"
          :disable="form.libelle.trim().length < 2 || !form.numeroSerie.trim() || !form.categorieId"
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
import AutocompleteAsync from './AutocompleteAsync.vue';
import ChampDate from './ChampDate.vue';
import type { EquipementPatrimoine } from '../types';

const props = defineProps<{ modelValue: boolean; equipement?: EquipementPatrimoine | null }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();

const dialogOuvert = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const enregistrement = ref(false);

const form = ref({
  libelle: '',
  numeroSerie: '',
  numeroInventaire: '',
  categorieId: null as string | null,
  departementId: null as string | null,
  salleId: null as string | null,
  dateAcquisition: '',
  valeurAcquisition: null as number | null,
  obsolescenceMois: 60 as number,
  actif: true,
});

watch(dialogOuvert, (ouvert) => {
  if (!ouvert) return;
  const e = props.equipement;
  if (e) {
    form.value = {
      libelle: e.libelle,
      numeroSerie: e.numeroSerie,
      numeroInventaire: e.numeroInventaire,
      categorieId: e.categorieId,
      departementId: e.departementId ?? null,
      salleId: e.salleId ?? null,
      dateAcquisition: e.dateAcquisition ?? '',
      valeurAcquisition: e.valeurAcquisition ?? null,
      obsolescenceMois: e.obsolescenceMois ?? 60,
      actif: e.actif,
    };
  } else {
    form.value = {
      libelle: '',
      numeroSerie: '',
      numeroInventaire: '',
      categorieId: null,
      departementId: null,
      salleId: null,
      dateAcquisition: '',
      valeurAcquisition: null,
      obsolescenceMois: 60,
      actif: true,
    };
  }
});

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload: Record<string, unknown> = {
      libelle: form.value.libelle.trim(),
      numeroSerie: form.value.numeroSerie.trim(),
      numeroInventaire: form.value.numeroInventaire.trim(),
      categorieId: form.value.categorieId,
      departementId: form.value.departementId ?? undefined,
      salleId: form.value.salleId ?? undefined,
      dateAcquisition: form.value.dateAcquisition || undefined,
      valeurAcquisition: form.value.valeurAcquisition ?? undefined,
      obsolescenceMois: form.value.obsolescenceMois,
      actif: form.value.actif ? 'true' : 'false',
    };
    if (props.equipement) {
      await api.put(`/patrimoine/equipements/${props.equipement.id}`, payload);
      $q.notify({ type: 'positive', message: 'Équipement mis à jour' });
    } else {
      await api.post('/patrimoine/equipements', payload);
      $q.notify({ type: 'positive', message: 'Équipement enregistré à l’inventaire' });
    }
    dialogOuvert.value = false;
    emit('enregistre');
  } finally {
    enregistrement.value = false;
  }
}
</script>
