<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t(seance ? 'seances.dialogs.dialogForm.editTitle' : 'seances.dialogs.dialogForm.unscheduledTitle')"
    :sous-titre="seance ? undefined : $t('seances.dialogs.dialogForm.unscheduledHint')"
    taille="s"
    :envoi="enregistrement"
    @valider="enregistrer"
  >
    <span class="section-titre">{{ $t('seances.dialogs.dialogForm.courseSection') }}</span>
    <q-select
      v-model="form.affectationId"
      :options="optionsAffectations"
      outlined
      dense
      emit-value
      map-options
      use-input
      input-debounce="200"
      :label="$t('seances.dialogs.dialogForm.assignment')"
      :hint="$t('seances.dialogs.dialogForm.assignmentHint')"
      @filter="filtrer"
    />
    <div class="row q-col-gutter-md">
      <div class="col-6">
        <champ-date v-model="form.date" :label="$t('common.fields.date')" />
      </div>
      <div class="col-12 col-sm-6">
        <q-select v-model="form.type" :options="TYPES_COURS" outlined dense :label="$t('common.fields.type')" />
      </div>
    </div>
    <span class="section-titre">{{ $t('seances.dialogs.dialogForm.whenWhere') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-6">
        <q-input v-model="form.heureDebut" outlined dense mask="##:##" :label="$t('common.fields.startTime')" />
      </div>
      <div class="col-6">
        <q-input v-model="form.heureFin" outlined dense mask="##:##" :label="$t('common.fields.endTime')" />
      </div>
    </div>
    <q-select
      v-model="form.salleId"
      :options="optionsSalles"
      outlined
      dense
      clearable
      emit-value
      map-options
      :label="$t('common.fields.classroom')"
    />
    <q-input v-model="form.thematique" outlined dense :label="$t('seances.dialogs.dialogForm.topic')" />
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import ChampDate from '@/shared/components/ChampDate.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import { useSeancesStore } from '@/stores/seances';
import { TYPES_COURS, aujourdhui } from '@/shared/utils/libelles';
import type { Affectation, Salle, Seance, TypeCours } from '@/types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  seance?: Seance | null;
  salles: Salle[];
  /** Date pré-remplie : la journée que le contrôleur est en train de pointer. */
  dateImposee?: string;
}>();
const emit = defineEmits<{ enregistre: [Seance] }>();

const $q = useQuasar();
const { t } = useI18n();
const seancesHorsLigne = useSeancesStore();
const enregistrement = ref(false);
const affectations = ref<Affectation[]>([]);
const optionsAffectations = ref<{ label: string; value: string }[]>([]);

const form = ref({
  affectationId: '',
  date: aujourdhui(),
  heureDebut: '08:00',
  heureFin: '10:00',
  type: 'CM',
  salleId: null as string | null,
  thematique: '',
});

const sallesDisponibles = computed(() => (props.salles.length ? props.salles : seancesHorsLigne.sallesCache));
const optionsSalles = computed(() =>
  sallesDisponibles.value.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })),
);

const libelle = (a: Affectation) =>
  `${a.enseignant?.nom} ${a.enseignant?.prenom} · ${a.matiere?.code} · ${a.promotion?.nom}`;

async function filtrer(saisie: string, maj: (fn: () => void) => void) {
  if (!affectations.value.length) {
    try {
      const { data } = await api.get('/affectations', { params: { all: '1' } });
      affectations.value = data.data;
      seancesHorsLigne.enregistrerAffectations(data.data ?? []);
    } catch {
      affectations.value = seancesHorsLigne.affectationsCache;
    }
  }
  maj(() => {
    const q = saisie.toLowerCase();
    optionsAffectations.value = affectations.value
      .filter((a) => libelle(a).toLowerCase().includes(q))
      .map((a) => ({ label: libelle(a), value: a.id }));
  });
}

watch(ouvert, (o) => {
  if (!o) return;
  const s = props.seance;
  form.value = {
    affectationId: s?.affectationId ?? '',
    date: s?.date?.slice(0, 10) ?? props.dateImposee ?? aujourdhui(),
    heureDebut: s?.heureDebut ?? '08:00',
    heureFin: s?.heureFin ?? '10:00',
    type: s?.type ?? 'CM',
    salleId: s?.salleId ?? null,
    thematique: s?.thematique ?? '',
  };
});

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload = { ...form.value, thematique: form.value.thematique || undefined };
    let data: Seance;
    if (props.seance) {
      ({ data } = await api.put(`/seances/${props.seance.id}`, payload));
    } else {
      if (!affectations.value.length) affectations.value = seancesHorsLigne.affectationsCache;
      if (!affectations.value.length && navigator.onLine) {
        try {
          const { data: chargees } = await api.get('/affectations', { params: { all: '1' } });
          affectations.value = chargees.data ?? [];
          seancesHorsLigne.enregistrerAffectations(affectations.value);
        } catch {
          /* Une saisie hors ligne continue avec le cache local. */
        }
      }
      const selection = affectations.value.find((a) => a.id === form.value.affectationId);
      // Pas d'exception ici : aucun gestionnaire global ne l'afficherait.
      if (!selection) {
        $q.notify({ type: 'warning', message: t('seances.offline.assignmentUnavailable') });
        return;
      }
      const salle = sallesDisponibles.value.find((s) => s.id === form.value.salleId) ?? null;
      const resultat = await seancesHorsLigne.creer(
        {
          ...payload,
          type: form.value.type as TypeCours,
        },
        selection,
        salle,
      );
      data = {
        id: resultat.id,
        affectationId: selection.id,
        anneeId: selection.anneeId,
        date: form.value.date,
        heureDebut: form.value.heureDebut,
        heureFin: form.value.heureFin,
        type: form.value.type as TypeCours,
        salleId: form.value.salleId,
        statut: 'PLANIFIE',
        thematique: form.value.thematique || null,
        affectation: selection,
        salle,
      };
      if (!resultat.enFile) $q.notify({ type: 'positive', message: t('seances.dialogs.dialogForm.saved') });
    }
    emit('enregistre', data);
    ouvert.value = false;
  } finally {
    enregistrement.value = false;
  }
}
</script>
