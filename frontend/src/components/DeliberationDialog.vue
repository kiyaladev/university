<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 640px; max-width: 95vw">
      <q-card-section class="text-h6">Nouvelle délibération</q-card-section>

      <q-card-section>
        <q-select
          v-model="form.anneeId"
          :options="optionsAnnees"
          outlined
          dense
          emit-value
          map-options
          label="Année académique *"
          @update:model-value="resetPromotion"
        />
        <q-select
          v-model="form.promotionId"
          :options="optionsPromotions"
          outlined
          dense
          emit-value
          map-options
          label="Promotion *"
          class="q-mt-sm"
        />
        <semestre-select
          v-model="form.session"
          type="session"
          label="Session *"
          class="q-mt-sm"
          hint="Rattrapage : seuls les AJOURNÉ de la session normale sont repositionnés"
        />

        <q-banner class="note--valide q-mt-md" dense>
          <template #avatar><q-icon name="gavel" /></template>
          La délibération est créée en brouillon : les moyennes sont calculées
          automatiquement, puis le jury (direction) les valide.
        </q-banner>

        <q-separator class="q-my-md" />

        <span class="section-titre">Aperçu du bulletin type</span>
        <q-card flat bordered class="apercu-bulletin">
          <q-card-section class="apercu-bulletin__entete">
            <div>
              <div class="apercu-bulletin__nom">
                {{ apercu.etudiant.prenom }} {{ apercu.etudiant.nom }}
              </div>
              <div class="apercu-bulletin__meta">
                Matricule {{ apercu.etudiant.matricule }} ·
                {{ apercu.promotion }} · {{ apercu.annee }}
              </div>
            </div>
            <q-badge color="grey-6" label="ADMIS / AJOURNÉ" />
          </q-card-section>
          <q-card-section class="apercu-bulletin__corps">
            <div class="apercu-bulletin__ligne" v-for="m in apercu.lignes" :key="m.code">
              <div class="apercu-bulletin__matiere">
                <div class="text-weight-medium">{{ m.intitule }}</div>
                <div class="text-caption text-grey-7">{{ m.code }} · {{ m.credits }} cr.</div>
              </div>
              <div class="apercu-bulletin__moyenne chiffres">—</div>
            </div>
          </q-card-section>
          <q-card-section class="apercu-bulletin__pied">
            <span class="text-caption text-grey-7">
              Les notes et la décision sont renseignées après calcul.
            </span>
          </q-card-section>
        </q-card>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat no-caps label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          label="Créer"
          :loading="enregistrement"
          :disable="!form.anneeId || !form.promotionId"
          @click="creer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import SemestreSelect from './SemestreSelect.vue';
import type {
  AnneeAcademique,
  Matiere,
  Promotion,
  SessionDeliberation,
} from '../types';

const props = defineProps<{
  modelValue: boolean;
  annees: AnneeAcademique[];
  promotions: Promotion[];
  matieres?: Matiere[];
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
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

const promotionSelectionnee = computed(() =>
  props.promotions.find((p) => p.id === form.value.promotionId) ?? null,
);
const anneeSelectionnee = computed(() =>
  props.annees.find((a) => a.id === form.value.anneeId) ?? null,
);

const apercu = computed(() => {
  const p = promotionSelectionnee.value;
  const a = anneeSelectionnee.value;
  const lignes = (props.matieres ?? [])
    .slice(0, 4)
    .map((m) => ({
      intitule: m.intitule,
      code: m.code,
      credits: m.credits,
    }));
  if (!lignes.length) {
    lignes.push(
      { intitule: 'Matière 1', code: 'MAT1', credits: 3 },
      { intitule: 'Matière 2', code: 'MAT2', credits: 4 },
      { intitule: 'Matière 3', code: 'MAT3', credits: 3 },
    );
  }
  return {
    etudiant: { matricule: '———', nom: 'Étudiant', prenom: 'Exemple' },
    promotion: p?.nom ?? 'Promotion sélectionnée',
    annee: a?.libelle ?? 'Année sélectionnée',
    lignes,
  };
});

function resetPromotion() {
  form.value.promotionId = null;
}

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    form.value = {
      anneeId: props.annees.find((a) => a.active)?.id ?? null,
      promotionId: null,
      session: 'NORMALE',
    };
  },
);

async function creer() {
  enregistrement.value = true;
  try {
    await api.post('/deliberations', {
      anneeId: form.value.anneeId,
      promotionId: form.value.promotionId,
      session: form.value.session,
    });
    $q.notify({ type: 'positive', message: 'Délibération créée, moyennes calculées' });
    emit('enregistre');
    emit('update:modelValue', false);
  } catch (e: any) {
    $q.notify({
      type: 'negative',
      message: e?.response?.data?.message ?? 'Création impossible — une délibération existe peut-être déjà pour cette promotion et cette session.',
    });
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
  font-weight: 700;
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
  font-weight: 700;
  font-size: 16px;
  color: var(--up-encre-douce);
}
</style>