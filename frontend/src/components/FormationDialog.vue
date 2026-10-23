<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="formation ? $t('formationsAdmin.dialog.title.edit') : $t('formationsAdmin.dialog.title.create')"
    :sous-titre="$t('formationsAdmin.dialog.subtitle')"
    :libelle-valider="$t('common.actions.register')"
    :envoi="enregistrement"
    :desactive="form.titre.trim().length < 3"
    @valider="enregistrer"
  >
    <span class="section-titre">{{ $t('formationsAdmin.dialog.sections.presentation') }}</span>
    <q-input
      v-model="form.titre"
      outlined
      dense
      :label="$t('formationsAdmin.dialog.fields.title')"
      :hint="$t('formationsAdmin.dialog.fields.titleHint')"
      autofocus
    />
    <q-input
      v-model="form.description"
      outlined
      dense
      type="textarea"
      rows="3"
      autogrow
      :label="$t('common.fields.description')"
    />
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.categorie"
          outlined
          dense
          :label="$t('cites.chambres.filters.categorie')"
          :hint="$t('formationsAdmin.dialog.fields.categoryHint')"
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.lieu"
          outlined
          dense
          :label="$t('formationsAdmin.dialog.fields.location')"
          :hint="$t('formationsAdmin.dialog.fields.locationHint')"
        />
      </div>
    </div>

    <span class="section-titre">{{ $t('formationsAdmin.dialog.sections.price') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-8">
        <q-input
          v-model.number="form.prix"
          type="number"
          min="0"
          outlined
          dense
          :label="$t('formationsAdmin.dialog.fields.price')"
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
          :label="$t('formationsAdmin.dialog.fields.currency')"
        />
      </div>
    </div>

    <span class="section-titre">{{ $t('formationsAdmin.dialog.sections.schedule') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model.number="form.dureeHeures"
          type="number"
          min="1"
          outlined
          dense
          :label="$t('formationsAdmin.dialog.fields.duration')"
        />
      </div>
      <div class="col-12 col-sm-3">
        <champ-date v-model="form.dateDebut" :label="$t('structure.dialogs.annee.debut')" />
      </div>
      <div class="col-12 col-sm-3">
        <champ-date v-model="form.dateFin" :label="$t('common.messages.end')" />
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
          :label="$t('formationsAdmin.dialog.fields.capacity')"
          :hint="$t('formationsAdmin.dialog.fields.capacityHint')"
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
          :label="$t('common.fields.status')"
          :disable="!!formation"
        />
      </div>
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import ChampDate from './ChampDate.vue';
import DialogueFormulaire from './DialogueFormulaire.vue';
import { LIBELLE_STATUT_FORMATION } from '../utils/libelles';
import type { Formation, StatutFormation } from '../types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ formation?: Formation | null }>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const optionsStatuts = computed(() =>
  Object.keys(LIBELLE_STATUT_FORMATION).map((value) => ({
    value: value as StatutFormation,
    label: t(`libelles.statut_formation.${value}`),
  })),
);

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

watch(ouvert, (o) => {
  if (!o) return;
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
  // Entrée dans un champ soumet le q-form, même bouton désactivé.
  if (form.value.titre.trim().length < 3) return;
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
      $q.notify({ type: 'positive', message: t('formationsAdmin.dialog.messages.updated') });
    } else {
      await api.post('/formations', payload);
      $q.notify({ type: 'positive', message: t('formationsAdmin.dialog.messages.created') });
    }
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>
