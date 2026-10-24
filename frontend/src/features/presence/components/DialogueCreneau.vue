<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="t(creneau ? 'emploiDuTemps.slotDialog.titleEdit' : 'emploiDuTemps.slotDialog.titleNew')"
    taille="s"
    :envoi="enregistrement"
    @valider="enregistrer"
  >
    <span class="section-titre">{{ t('emploiDuTemps.slotDialog.courseSection') }}</span>
    <q-select
      v-model="form.affectationId"
      :options="optionsAffectations"
      outlined
      dense
      emit-value
      map-options
      use-input
      input-debounce="200"
      :label="t('emploiDuTemps.slotDialog.assignmentLabel')"
      :hint="t('emploiDuTemps.slotDialog.assignmentHint')"
      @filter="filtrer"
    />

    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <q-select
          v-model="form.jourSemaine"
          :options="optionsJours"
          outlined
          dense
          emit-value
          map-options
          :label="t('emploiDuTemps.slotDialog.dayLabel')"
        />
      </div>
      <div class="col-12 col-sm-6">
        <q-select v-model="form.type" :options="TYPES_COURS" outlined dense :label="$t('common.fields.type')" />
      </div>
    </div>

    <span class="section-titre">{{ t('emploiDuTemps.slotDialog.scheduleSection') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-6">
        <q-input v-model="form.heureDebut" outlined dense mask="##:##" :label="$t('common.fields.start')" />
      </div>
      <div class="col-6">
        <q-input v-model="form.heureFin" outlined dense mask="##:##" :label="$t('common.fields.end')" />
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

    <span class="section-titre">{{ $t('common.fields.period') }}</span>
    <p class="periode__aide">
      {{
        t('emploiDuTemps.slotDialog.periodHint', {
          day: t(`common.days.${form.jourSemaine}`).toLowerCase(),
          from: t('common.pagination.from'),
          start: form.heureDebut,
          to: t('common.pagination.to'),
          end: form.heureFin,
        })
      }}
    </p>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <champ-date v-model="form.dateDebut" :label="t('emploiDuTemps.slotDialog.dateFrom')" />
      </div>
      <div class="col-12 col-sm-6">
        <champ-date v-model="form.dateFin" :label="t('emploiDuTemps.slotDialog.dateUntil')" />
      </div>
    </div>
    <div v-if="form.dateDebut || form.dateFin" class="row q-gutter-xs q-mb-sm">
      <button
        v-for="r in raccourcisPeriode"
        :key="r.label"
        type="button"
        class="pochoir raccourci-periode"
        @click="appliquerPeriode(r)"
      >
        {{ r.label }}
      </button>
      <button type="button" class="pochoir raccourci-periode" @click="viderPeriode">
        {{ t('emploiDuTemps.slotDialog.allYear') }}
      </button>
    </div>

    <q-toggle v-model="form.actif" :label="t('emploiDuTemps.slotDialog.active')" />

    <q-banner v-if="erreur" dense class="note--erreur">
      <template #avatar><q-icon name="warning" /></template>
      {{ erreur }}
    </q-banner>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { affectationsService, libelleAffectation } from '../services/affectations';
import { creneauxService } from '../services/creneaux';
import { TYPES_COURS } from '@/shared/utils/libelles';
import ChampDate from '@/shared/components/ChampDate.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import type { Affectation, Creneau, Salle } from '@/types';
import { messageErreurApi } from '@/shared/utils/erreur-http';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ creneau?: Creneau | null; salles: Salle[] }>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);
const erreur = ref('');
const affectations = ref<Affectation[]>([]);
const optionsAffectations = ref<{ label: string; value: string }[]>([]);

const optionsJours = computed(() =>
  Array.from({ length: 7 }, (_, i) => ({
    label: t(`common.days.${i + 1}`),
    value: i + 1,
  })),
);

const form = ref({
  affectationId: '',
  jourSemaine: 1,
  heureDebut: '08:00',
  heureFin: '10:00',
  type: 'CM',
  salleId: null as string | null,
  actif: true,
  dateDebut: '' as string,
  dateFin: '' as string,
});

/** Les découpages courants d'une année : semestre, mois en cours, un mois. */
const raccourcisPeriode = computed(() => [
  { label: t('emploiDuTemps.slotDialog.thisMonth'), mois: 0 },
  { label: t('emploiDuTemps.slotDialog.nextMonth'), mois: 1 },
  { label: t('emploiDuTemps.slotDialog.threeMonths'), mois: 3 },
]);

function appliquerPeriode(r: { mois: number }) {
  const base = form.value.dateDebut ? new Date(form.value.dateDebut) : new Date();
  const debut =
    r.mois === 0
      ? new Date(base.getFullYear(), base.getMonth(), 1)
      : new Date(base.getFullYear(), base.getMonth() + (r.mois === 1 ? 1 : 0), 1);
  const fin = new Date(debut.getFullYear(), debut.getMonth() + (r.mois === 3 ? 3 : 1), 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  form.value.dateDebut = iso(debut);
  form.value.dateFin = iso(fin);
}

function viderPeriode() {
  form.value.dateDebut = '';
  form.value.dateFin = '';
}

const optionsSalles = computed(() => props.salles.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })));

const libelle = (a: Affectation) => libelleAffectation(a);

async function filtrer(saisie: string, maj: (fn: () => void) => void) {
  if (!affectations.value.length) {
    const page = await affectationsService.toutes();
    affectations.value = page.data;
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
  erreur.value = '';
  const c = props.creneau;
  form.value = {
    affectationId: c?.affectationId ?? '',
    jourSemaine: c?.jourSemaine ?? 1,
    heureDebut: c?.heureDebut ?? '08:00',
    heureFin: c?.heureFin ?? '10:00',
    type: c?.type ?? 'CM',
    salleId: c?.salleId ?? null,
    actif: c?.actif ?? true,
    dateDebut: c?.dateDebut ? c.dateDebut.slice(0, 10) : '',
    dateFin: c?.dateFin ? c.dateFin.slice(0, 10) : '',
  };
});

async function enregistrer() {
  enregistrement.value = true;
  erreur.value = '';
  try {
    // Une période vide vaut « toute l'année » : on envoie null, pas ''.
    const charge = {
      ...form.value,
      dateDebut: form.value.dateDebut || null,
      dateFin: form.value.dateFin || null,
    };
    // Silencieux : le motif (conflit d'emploi du temps…) s'affiche dans le bandeau.
    if (props.creneau) await creneauxService.modifier(props.creneau.id, charge);
    else await creneauxService.creer(charge);
    $q.notify({ type: 'positive', message: t('emploiDuTemps.slotDialog.saved') });
    emit('enregistre');
    ouvert.value = false;
  } catch (e: unknown) {
    // Les conflits d'emploi du temps sont renvoyés en 400 par l'API.
    erreur.value = messageErreurApi(e) ?? t('emploiDuTemps.slotDialog.saveFailed');
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.periode__aide {
  color: var(--up-encre-douce);
  font-size: 0.82rem;
  margin: 0 0 var(--up-2);
}

.raccourci-periode {
  border: var(--up-filet);
  background: transparent;
  color: var(--up-encre);
  padding: 3px var(--up-2);
  cursor: pointer;

  &:hover {
    background: var(--up-gris-inerte);
    color: var(--up-encre);
  }
}
</style>
