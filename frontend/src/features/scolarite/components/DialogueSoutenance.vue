<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t(mode === 'jury' ? 'stages.dialogs.defense.juryTitle' : 'stages.dialogs.defense.scheduleTitle')"
    :sous-titre="mode === 'jury' ? $t('stages.dialogs.defense.juryHint', { title: travail?.intitule }) : undefined"
    :libelle-valider="$t(mode === 'jury' ? 'stages.dialogs.defense.saveJury' : 'stages.dialogs.defense.saveDefense')"
    :envoi="enregistrement"
    @valider="enregistrer"
  >
    <div v-if="mode !== 'jury'" class="q-gutter-md">
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-7">
          <champ-date v-model="form.date" :label="$t('stages.dialogs.defense.date')" />
        </div>
        <div class="col-12 col-sm-5">
          <q-input v-model="form.heure" type="time" outlined dense :label="$t('stages.dialogs.defense.time')" />
        </div>
      </div>

      <q-select
        v-model="form.salleId"
        :options="optionsSalles"
        outlined
        dense
        emit-value
        map-options
        clearable
        :label="$t('common.fields.classroom')"
        @filter="filtrerSalles"
      />

      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6">
          <q-select
            v-model="form.presidentId"
            :options="optionsEncadrants"
            outlined
            dense
            emit-value
            map-options
            use-input
            input-debounce="300"
            clearable
            :label="$t('stages.dialogs.defense.chair')"
            @filter="filtrerEncadrants"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
            v-model="form.assesseurs"
            outlined
            dense
            :label="$t('stages.dialogs.defense.assessors')"
            :hint="$t('stages.dialogs.defense.assessorsHint')"
          />
        </div>
      </div>
    </div>

    <div v-else class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model.number="form.note"
          type="number"
          min="0"
          max="20"
          step="0.5"
          outlined
          dense
          :label="$t('stages.dialogs.defense.grade')"
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-input
          v-model="form.mention"
          outlined
          dense
          :label="$t('bulletins.table.columns.mention')"
          :hint="$t('stages.dialogs.defense.mentionHint')"
        />
      </div>
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useReferentielsStore } from '@/stores/referentiels';
import ChampDate from '@/shared/components/ChampDate.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { soutenancesService } from '../services/soutenances';
import type { Enseignant, Soutenance, TravailEncadre } from '@/types';

/**
 * Deux usages :
 * - planifier (mode création) : POST /soutenances — date, salle, jury ;
 * - constat du jury : PUT /soutenances/:id/hota — note et mention.
 */
const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  travail: TravailEncadre;
  mode: 'planifier' | 'jury';
}>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const referentiels = useReferentielsStore();
const enregistrement = ref(false);

const form = ref({
  date: '',
  heure: '09:00',
  salleId: null as string | null,
  presidentId: null as string | null,
  assesseurs: '',
  note: null as number | null,
  mention: '',
});

const optionsSalles = ref<{ label: string; value: string }[]>([]);
const optionsEncadrants = ref<{ label: string; value: string }[]>([]);
const encadrantsTous = ref<Enseignant[]>([]);

const libelleEncadrant = (e: Enseignant) => ({ label: `${e.nom} ${e.prenom} (${e.matricule})`, value: e.id });

watch(ouvert, (o) => {
  if (!o) return;
  const s: Soutenance | null = props.travail.soutenance ?? null;
  form.value = {
    date: s ? s.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    heure: s ? s.date.slice(11, 16) : '09:00',
    salleId: s?.salleId ?? null,
    presidentId: s?.presidentId ?? null,
    assesseurs: s?.assesseurs ?? '',
    note: s?.note ?? null,
    mention: s?.mention ?? '',
  };
  void referentiels
    .salles()
    .then((salles) => {
      optionsSalles.value = salles.map((x) => ({ label: `${x.nom} (${x.code})`, value: x.id }));
    })
    .catch(() => undefined);
  if (!encadrantsTous.value.length) {
    void referentiels
      .enseignants()
      .then((enseignants) => {
        encadrantsTous.value = enseignants;
        optionsEncadrants.value = encadrantsTous.value.map(libelleEncadrant);
      })
      .catch(() => undefined);
  }
});

function filtrerSalles(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsSalles.value = optionsSalles.value.filter((o) => o.label.toLowerCase().includes(q));
  });
}

function filtrerEncadrants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEncadrants.value = encadrantsTous.value
      .filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q))
      .map(libelleEncadrant);
  });
}

async function enregistrer() {
  if (props.mode !== 'jury' && !form.value.date) {
    $q.notify({ type: 'warning', message: t('stages.dialogs.defense.dateRequired') });
    return;
  }
  enregistrement.value = true;
  try {
    if (props.mode === 'jury') {
      await soutenancesService.hota(props.travail.soutenance!.id, {
        note: form.value.note ?? undefined,
        mention: form.value.mention || undefined,
      });
      $q.notify({ type: 'positive', message: t('stages.dialogs.defense.jurySaved') });
    } else {
      await soutenancesService.creer({
        travailEncadreId: props.travail.id,
        date: `${form.value.date}T${form.value.heure || '09:00'}`,
        salleId: form.value.salleId || undefined,
        presidentId: form.value.presidentId || undefined,
        assesseurs: form.value.assesseurs || undefined,
      });
      $q.notify({ type: 'positive', message: t('stages.dialogs.defense.saved') });
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
