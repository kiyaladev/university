<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t(travail ? 'stages.workDialog.editTitle' : 'stages.workDialog.newTitle')"
    taille="l"
    :envoi="enregistrement"
    @valider="enregistrer"
  >
    <div class="q-gutter-md">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-4">
          <q-select
            v-model="form.type"
            :options="optionsTypes"
            outlined
            dense
            emit-value
            map-options
            :label="$t('stages.workDialog.type')"
          />
        </div>
        <div class="col-12 col-sm-8">
          <q-input v-model="form.intitule" outlined dense :label="$t('stages.workDialog.title')" :rules="[requis]" />
        </div>
      </div>

      <q-input
        v-model="form.description"
        outlined
        dense
        type="textarea"
        rows="2"
        :label="$t('common.fields.description')"
      />

      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6">
          <q-select
            v-model="form.etudiantId"
            :options="optionsEtudiants"
            outlined
            dense
            emit-value
            map-options
            use-input
            input-debounce="300"
            :label="$t('stages.workDialog.student')"
            :disable="!peutChoisirEtudiant"
            :rules="[requis]"
            @filter="filtrerEtudiants"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-select
            v-model="form.encadrantId"
            :options="optionsEncadrants"
            outlined
            dense
            emit-value
            map-options
            use-input
            input-debounce="300"
            clearable
            :label="$t('stages.detail.fields.supervisor')"
            :hint="$t('stages.workDialog.supervisorHint')"
            @filter="filtrerEncadrants"
          />
        </div>
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6">
          <q-input v-model="form.entreprise" outlined dense :label="$t('stages.detail.fields.company')" />
        </div>
        <div class="col-12 col-sm-6">
          <q-input v-model="form.tuteurEntreprise" outlined dense :label="$t('stages.workDialog.companyTutor')" />
        </div>
      </div>

      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-4">
          <q-input v-model="form.lieu" outlined dense :label="$t('common.fields.location')" />
        </div>
        <div class="col-12 col-sm-4">
          <champ-date v-model="form.dateDebut" :label="$t('structure.dialogs.annee.debut')" />
        </div>
        <div class="col-12 col-sm-4">
          <champ-date v-model="form.dateFin" :label="$t('common.messages.end')" />
        </div>
      </div>

      <q-select
        v-if="!travail"
        v-model="form.statut"
        :options="optionsStatutsInitiaux"
        outlined
        dense
        emit-value
        map-options
        :label="$t('stages.workDialog.initialStatus')"
        :hint="$t('stages.workDialog.initialStatusHint')"
      />
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import ChampDate from './ChampDate.vue';
import DialogueFormulaire from './DialogueFormulaire.vue';
import type { Enseignant, Etudiant, TravailEncadre } from '../types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ travail?: TravailEncadre | null }>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const auth = useAuthStore();
const enregistrement = ref(false);
/** Intitulé et étudiant : sans eux le serveur refuse, le formulaire le dit avant. */
const requis = (v: string | null) => !!(v ?? '').trim() || t('stages.workDialog.required');

const form = ref({
  type: 'MEMOIRE',
  intitule: '',
  description: '',
  etudiantId: '',
  encadrantId: null as string | null,
  entreprise: '',
  tuteurEntreprise: '',
  lieu: '',
  dateDebut: '',
  dateFin: '',
  statut: 'PROPOSE',
});

const optionsTypes = computed(() => [
  { label: t('stages.types.memoire'), value: 'MEMOIRE' },
  { label: t('stages.types.stage'), value: 'STAGE' },
  { label: t('stages.types.rapport'), value: 'RAPPORT' },
]);
const optionsStatutsInitiaux = computed(() => [
  { label: t('stages.kanban.columns.proposed'), value: 'PROPOSE' },
  { label: t('stages.kanban.columns.validated'), value: 'VALIDE' },
]);

const optionsEtudiants = ref<{ label: string; value: string }[]>([]);
const optionsEncadrants = ref<{ label: string; value: string }[]>([]);
const encadrantsTous = ref<Enseignant[]>([]);

const optionEncadrant = (e: Enseignant) => ({ label: `${e.nom} ${e.prenom} (${e.matricule})`, value: e.id });

/** Un étudiant connecté est toujours le porteur : le champ se verrouille. */
/**
 * L'étudiant ne se choisit pas (il devient d'office le porteur) et le porteur
 * ne change plus après la création : la `PUT` le refuse. Sans compte chargé,
 * rien n'est autorisé (l'ancien `role !== 'ETUDIANT'` laissait passer `null`).
 */
const peutChoisirEtudiant = computed(() => auth.peut('travaux.choisirEtudiant') && !props.travail);

watch(ouvert, (o) => {
  if (!o) return;
  const tr = props.travail;
  form.value = {
    type: tr?.type ?? (auth.role === 'ETUDIANT' ? 'RAPPORT' : 'MEMOIRE'),
    intitule: tr?.intitule ?? '',
    description: tr?.description ?? '',
    etudiantId: tr?.etudiantId ?? '',
    encadrantId: tr?.encadrantId ?? null,
    entreprise: tr?.entreprise ?? '',
    tuteurEntreprise: tr?.tuteurEntreprise ?? '',
    lieu: tr?.lieu ?? '',
    dateDebut: tr?.dateDebut?.slice(0, 10) ?? '',
    dateFin: tr?.dateFin?.slice(0, 10) ?? '',
    statut: tr?.statut ?? 'PROPOSE',
  };
  if (!encadrantsTous.value.length) {
    void api.get('/enseignants', { params: { all: '1' } }).then(({ data }) => {
      encadrantsTous.value = data.data;
      optionsEncadrants.value = encadrantsTous.value.map(optionEncadrant);
    }).catch(() => undefined);
  }
});

async function filtrerEtudiants(saisie: string, maj: (fn: () => void) => void) {
  const { data } = await api.get('/etudiants', {
    params: { search: saisie || undefined, all: '1', pageSize: 30 },
  });
  maj(() => {
    optionsEtudiants.value = data.data.map((e: Etudiant) => ({
      label: `${e.nom} ${e.prenom} (${e.matricule})`,
      value: e.id,
    }));
  });
}

function filtrerEncadrants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEncadrants.value = encadrantsTous.value
      .filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q))
      .map(optionEncadrant);
  });
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload: Record<string, unknown> = {
      type: form.value.type,
      intitule: form.value.intitule.trim(),
      description: form.value.description || undefined,
      etudiantId: form.value.etudiantId,
      encadrantId: form.value.encadrantId || undefined,
      entreprise: form.value.entreprise || undefined,
      tuteurEntreprise: form.value.tuteurEntreprise || undefined,
      lieu: form.value.lieu || undefined,
      dateDebut: form.value.dateDebut || undefined,
      dateFin: form.value.dateFin || undefined,
    };
    if (!props.travail) payload.statut = form.value.statut;

    if (props.travail) await api.put(`/travaux-encadres/${props.travail.id}`, payload);
    else await api.post('/travaux-encadres', payload);

    $q.notify({ type: 'positive', message: t(props.travail ? 'stages.workDialog.updated' : 'stages.workDialog.created') });
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>
