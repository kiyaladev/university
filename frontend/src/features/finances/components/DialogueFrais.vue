<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t(existant ? 'frais.formDialog.editTitle' : 'frais.formDialog.newTitle')"
    :sous-titre="$t('frais.formDialog.subtitle')"
    taille="m"
    :envoi="envoi"
    :libelle-valider="$t('common.actions.save')"
    @valider="enregistrer"
  >
    <div class="q-gutter-md">
      <q-select
        v-model="form.anneeId"
        :options="optionsAnnees"
        outlined
        dense
        emit-value
        map-options
        :label="$t('common.fields.academicYear')"
        @update:model-value="form.promotionId = null"
      />
      <q-select
        v-model="form.promotionId"
        :options="optionsPromotions"
        outlined
        dense
        emit-value
        map-options
        :label="$t('frais.formDialog.promotion')"
        :hint="$t('frais.formDialog.promotionHint')"
      />
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-8">
          <q-input
            v-model.number="form.montant"
            type="number"
            min="0"
            step="1000"
            outlined
            dense
            :label="$t('common.fields.amount')"
          />
        </div>
        <div class="col-12 col-sm-4">
          <q-input v-model="form.devise" outlined dense :label="$t('common.fields.currency')" />
        </div>
      </div>
      <q-banner v-if="existant" dense rounded class="bg-blue-1 text-blue-9">
        {{ $t('frais.formDialog.propagationHint') }}
      </q-banner>
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useReferentielsStore } from '@/stores/referentiels';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { fraisService, type FraisAvecLibelles, type FraisSaisie } from '../services/frais';
import { DEVISE } from '@/shared/utils/libelles';

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{ existant: FraisAvecLibelles | null }>();
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const referentiels = useReferentielsStore();

const annees = ref<Awaited<ReturnType<typeof referentiels.annees>>>([]);
const promotions = ref<Awaited<ReturnType<typeof referentiels.promotions>>>([]);

/**
 * Le formulaire des frais : la promotion est effacée quand l'année change,
 * d'où une promotion vide (`null`) tant que l'agent n'en a pas choisi une.
 */
interface FormulaireFrais {
  anneeId: string;
  promotionId: string | null;
  montant: number;
  devise: string;
}

const form = ref<FormulaireFrais>({ anneeId: '', promotionId: '', montant: 0, devise: DEVISE });
const envoi = ref(false);

const optionsAnnees = computed(() => annees.value.map((a) => ({ value: a.id, label: a.libelle })));

/** L'API n'accepte qu'une promotion de l'année choisie : on filtre sur elle. */
const optionsPromotions = computed(() =>
  promotions.value
    .filter((p) => !form.value.anneeId || p.anneeId === form.value.anneeId)
    .map((p) => ({ value: p.id, label: p.nom })),
);

watch(
  ouvert,
  async (v) => {
    if (!v) return;
    try {
      [annees.value, promotions.value] = await Promise.all([referentiels.annees(), referentiels.promotions()]);
    } catch {
      annees.value = [];
      promotions.value = [];
    }
    if (props.existant) {
      form.value = {
        anneeId: props.existant.anneeId,
        promotionId: props.existant.promotionId,
        montant: Number(props.existant.montant),
        devise: props.existant.devise ?? DEVISE,
      };
    } else {
      form.value = {
        anneeId: referentiels.anneeCourante?.id ?? '',
        promotionId: '',
        montant: 0,
        devise: DEVISE,
      };
    }
  },
  { immediate: true },
);

async function enregistrer() {
  const montant = Number(form.value.montant);
  if (!form.value.anneeId || !form.value.promotionId || !Number.isFinite(montant) || montant < 0) {
    $q.notify({ type: 'warning', message: t('common.messages.requiredFields') });
    return;
  }
  envoi.value = true;
  try {
    const corps: FraisSaisie = {
      anneeId: form.value.anneeId,
      promotionId: form.value.promotionId,
      montant,
      devise: form.value.devise.trim() || DEVISE,
    };
    if (props.existant) {
      await fraisService.modifier(props.existant.id, corps);
      $q.notify({ type: 'positive', message: t('frais.messages.updated') });
    } else {
      await fraisService.creer(corps);
      $q.notify({ type: 'positive', message: t('frais.messages.created') });
    }
    emit('enregistre');
    ouvert.value = false;
  } finally {
    envoi.value = false;
  }
}
</script>
