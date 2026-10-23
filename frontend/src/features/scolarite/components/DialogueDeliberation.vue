<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t('deliberations.actions.newDeliberation')"
    :envoi="enregistrement"
    :libelle-valider="$t('common.actions.create')"
    :desactive="!form.anneeId || !form.promotionId"
    @valider="creer"
  >
    <q-select
      v-model="form.anneeId"
      :options="optionsAnnees"
      outlined
      dense
      emit-value
      map-options
      :label="$t('common.fields.academicYearRequired')"
      @update:model-value="resetPromotion"
    />
    <q-select
      v-model="form.promotionId"
      :options="optionsPromotions"
      outlined
      dense
      emit-value
      map-options
      :label="$t('common.fields.promotionRequired')"
      class="q-mt-sm"
    />
    <choix-semestre
      v-model="form.session"
      type="session"
      :label="$t('deliberations.createDialog.session')"
      class="q-mt-sm"
      :hint="$t('deliberations.createDialog.sessionHint')"
    />

    <q-banner class="note--valide q-mt-md" dense>
      <template #avatar><q-icon name="gavel" /></template>
      {{ $t('deliberations.createDialog.draftHint') }}
    </q-banner>

    <q-separator class="q-my-md" />

    <span class="section-titre">{{ $t('deliberations.createDialog.previewTitle') }}</span>
    <q-card flat bordered class="apercu-bulletin">
      <q-card-section class="apercu-bulletin__entete">
        <div>
          <div class="apercu-bulletin__nom">{{ apercu.etudiant.prenom }} {{ apercu.etudiant.nom }}</div>
          <div class="apercu-bulletin__meta">
            {{ $t('common.fields.matricule') }} {{ apercu.etudiant.matricule }} · {{ apercu.promotion }} ·
            {{ apercu.annee }}
          </div>
        </div>
        <q-badge color="grey-6" :label="$t('deliberations.createDialog.previewDecision')" />
      </q-card-section>
      <q-card-section class="apercu-bulletin__corps">
        <div class="apercu-bulletin__ligne" v-for="m in apercu.lignes" :key="m.code">
          <div class="apercu-bulletin__matiere">
            <div class="text-weight-medium">{{ m.intitule }}</div>
            <div class="text-caption text-grey-7">
              {{ m.code }} · {{ $t('common.units.credits', { n: m.credits }) }}
            </div>
          </div>
          <div class="apercu-bulletin__moyenne chiffres">—</div>
        </div>
      </q-card-section>
      <q-card-section class="apercu-bulletin__pied">
        <span class="text-caption text-grey-7">
          {{ $t('deliberations.createDialog.previewHint') }}
        </span>
      </q-card-section>
    </q-card>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import { useReferentielsStore } from '@/stores/referentiels';
import ChoixSemestre from './ChoixSemestre.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import type { AnneeAcademique, Matiere, Promotion, SessionDeliberation } from '@/types';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  annees: AnneeAcademique[];
  promotions: Promotion[];
  matieres?: Matiere[];
}>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const referentiels = useReferentielsStore();
const { t } = useI18n();
const enregistrement = ref(false);

const form = ref({
  anneeId: null as string | null,
  promotionId: null as string | null,
  session: 'NORMALE' as SessionDeliberation,
});

const optionsAnnees = computed(() => props.annees.map((a) => ({ label: a.libelle, value: a.id })));
const optionsPromotions = computed(() =>
  props.promotions
    .filter((p) => !form.value.anneeId || p.anneeId === form.value.anneeId)
    .map((p) => ({ label: p.nom, value: p.id })),
);

const promotionSelectionnee = computed(() => props.promotions.find((p) => p.id === form.value.promotionId) ?? null);
const anneeSelectionnee = computed(() => props.annees.find((a) => a.id === form.value.anneeId) ?? null);

const apercu = computed(() => {
  const p = promotionSelectionnee.value;
  const a = anneeSelectionnee.value;
  const lignes = (props.matieres ?? []).slice(0, 4).map((m) => ({
    intitule: m.intitule,
    code: m.code,
    credits: m.credits,
  }));
  if (!lignes.length) {
    lignes.push(
      { intitule: t('deliberations.createDialog.sampleSubject', { number: 1 }), code: 'MAT1', credits: 3 },
      { intitule: t('deliberations.createDialog.sampleSubject', { number: 2 }), code: 'MAT2', credits: 4 },
      { intitule: t('deliberations.createDialog.sampleSubject', { number: 3 }), code: 'MAT3', credits: 3 },
    );
  }
  return {
    etudiant: { matricule: '———', nom: t('common.fields.student'), prenom: t('deliberations.createDialog.sampleName') },
    promotion: p?.nom ?? t('deliberations.createDialog.selectedPromotion'),
    annee: a?.libelle ?? t('deliberations.createDialog.selectedYear'),
    lignes,
  };
});

function resetPromotion() {
  form.value.promotionId = null;
}

watch(ouvert, (o) => {
  if (!o) return;
  form.value = {
    anneeId: referentiels.anneeCourante?.id ?? null,
    promotionId: null,
    session: 'NORMALE',
  };
});

async function creer() {
  enregistrement.value = true;
  try {
    await api.post('/deliberations', {
      anneeId: form.value.anneeId,
      promotionId: form.value.promotionId,
      session: form.value.session,
    });
    $q.notify({ type: 'positive', message: t('deliberations.createDialog.created') });
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.apercu-bulletin {
  background: var(--up-craie);
}
.apercu-bulletin__entete {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.apercu-bulletin__nom {
  font-weight: 590;
}
.apercu-bulletin__meta {
  font-size: 12px;
  color: var(--up-encre-douce);
}
.apercu-bulletin__ligne {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: var(--up-filet-fin);
  &:last-child {
    border-bottom: 0;
  }
}
.apercu-bulletin__moyenne {
  font-weight: 590;
  font-size: 16px;
  color: var(--up-encre-douce);
}
</style>
