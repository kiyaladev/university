<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t('reservations.actions.reserve')"
    taille="s"
    :envoi="enregistrement"
    :libelle-valider="t('reservations.createDialog.submit')"
    @valider="enregistrer"
  >
    <q-select
      v-model="form.salleId"
      :options="optionsSalles"
      outlined
      dense
      emit-value
      map-options
      :label="t('reservations.createDialog.roomLabel')"
    />

    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <champ-date v-model="form.dateJour" :label="t('common.fields.dateRequired')" />
      </div>
      <div class="col-12 col-sm-6">
        <div class="row q-col-gutter-sm">
          <div class="col-6">
            <q-input
              v-model="form.heureDebut"
              outlined
              dense
              mask="##:##"
              :label="t('reservations.createDialog.startLabel')"
            />
          </div>
          <div class="col-6">
            <q-input
              v-model="form.heureFin"
              outlined
              dense
              mask="##:##"
              :label="t('reservations.createDialog.endLabel')"
            />
          </div>
        </div>
      </div>
    </div>

    <q-input v-model="form.motif" outlined dense :label="t('reservations.createDialog.reasonLabel')" />
    <q-input
      v-model="form.organisme"
      outlined
      dense
      :label="$t('reservations.table.columns.organization')"
      :hint="t('reservations.createDialog.organizationHint')"
    />
    <q-input v-model="form.responsable" outlined dense :label="t('reservations.createDialog.responsibleLabel')" />

    <q-banner v-if="conflits.length" dense class="note--avis q-mt-sm">
      <template #avatar><q-icon name="warning" size="22px" /></template>
      <div class="text-weight-bold">{{ t('reservations.createDialog.conflictTitle') }}</div>
      <div v-for="c in conflits" :key="c.id" class="conflit-ligne" :class="`conflit-ligne--${c.statut.toLowerCase()}`">
        {{ c.heureDebut }}–{{ c.heureFin }} · {{ c.motif }}
        <span v-if="c.organisme">({{ c.organisme }})</span>
        — {{ LIBELLE_STATUT_RESERVATION[c.statut].toLowerCase() }}
      </div>
      <div class="conflit-aide">{{ t('reservations.createDialog.conflictHint') }}</div>
    </q-banner>

    <q-banner v-if="erreur" dense class="note--erreur q-mt-sm">
      <template #avatar><q-icon name="block" /></template>
      {{ erreur }}
    </q-banner>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import ChampDate from '@/shared/components/ChampDate.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { aujourdhui } from '@/shared/utils/format';
import { LIBELLE_STATUT_RESERVATION } from '@/shared/utils/libelles';
import { reservationsService } from '../services/reservations';
import type { ReservationSalle, Salle } from '@/types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ salles: Salle[] }>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const enregistrement = ref(false);
const erreur = ref('');
const conflits = ref<ReservationSalle[]>([]);

const form = ref({
  salleId: '' as string,
  motif: '',
  organisme: '',
  dateJour: aujourdhui(),
  heureDebut: '14:00',
  heureFin: '16:00',
  responsable: '',
});

const optionsSalles = computed(() => props.salles.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })));

const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/**
 * Avertissement non bloquant : la liste des réservations du jour dans la salle
 * choisie suffit à montrer les conflits d'horaire pendant la saisie. C'est le
 * service qui garde la décision dernière au moment de l'écriture.
 */
async function verifierConflits() {
  if (!form.value.salleId || !form.value.dateJour) return;
  try {
    const resultat = await reservationsService.liste({
      salleId: form.value.salleId,
      dateJour: form.value.dateJour,
      all: '1',
    });
    const d = minutes(form.value.heureDebut);
    const f = minutes(form.value.heureFin);
    conflits.value = resultat.data.filter(
      (r) =>
        (r.statut === 'EN_ATTENTE' || r.statut === 'CONFIRME') && d < minutes(r.heureFin) && minutes(r.heureDebut) < f,
    );
  } catch {
    conflits.value = [];
  }
}

watch(() => [form.value.salleId, form.value.dateJour, form.value.heureDebut, form.value.heureFin], verifierConflits);

watch(ouvert, (o) => {
  if (!o) return;
  erreur.value = '';
  conflits.value = [];
  form.value = {
    salleId: props.salles[0]?.id ?? '',
    dateJour: aujourdhui(),
    heureDebut: '14:00',
    heureFin: '16:00',
    motif: '',
    organisme: '',
    responsable: '',
  };
  void verifierConflits();
});

async function enregistrer() {
  enregistrement.value = true;
  erreur.value = '';
  try {
    await reservationsService.creer({
      ...form.value,
      organisme: form.value.organisme || undefined,
      responsable: form.value.responsable || undefined,
    });
    $q.notify({ type: 'positive', message: t('reservations.createDialog.sent') });
    emit('enregistre');
    ouvert.value = false;
  } catch (e: any) {
    erreur.value = e.response?.data?.message ?? t('reservations.createDialog.saveFailed');
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.note--avis {
  border: 0;
  background: $jaune-fond;
  color: $jaune-texte;
  border-radius: var(--up-rayon);
  border-radius: var(--up-rayon-sm);

  :deep(.q-banner__avatar) {
    color: var(--up-jaune-fonce);
  }
}

.conflit-ligne {
  font-weight: 600;
  color: var(--up-encre);

  &--en_attente {
    color: var(--up-jaune-fonce);
  }
  &--confirmee {
    color: $vert;
  }
}

.conflit-aide {
  font-size: 0.8rem;
  color: var(--up-encre-douce);
  margin-top: 4px;
}
</style>
