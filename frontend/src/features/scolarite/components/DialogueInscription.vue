<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="$t('inscriptions.createDialog.title')"
    :envoi="enregistrement"
    :libelle-valider="$t('inscriptions.createDialog.save')"
    :desactive="!form.etudiantId || !form.promotionId || form.montantFrais === null"
    @valider="enregistrer"
  >
    <span class="section-titre">{{ $t('common.fields.student') }}</span>
    <champ-recherche
      v-model="form.etudiantId"
      endpoint="/etudiants"
      :label-fn="
        (e) => `${e.matricule} — ${e.nom} ${e.prenom}${e.actif ? '' : ` (${$t('inscriptions.createDialog.inactive')})`}`
      "
      :label="$t('common.fields.studentRequired')"
      :placeholder="$t('inscriptions.createDialog.studentPlaceholder')"
    />

    <span class="section-titre">{{ $t('common.fields.track') }}</span>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6">
        <champ-recherche
          v-model="form.anneeId"
          endpoint="/annees"
          :label-fn="(a) => a.libelle"
          :label="$t('common.fields.academicYearRequired')"
          @update:model-value="onAnneeChange"
        />
      </div>
      <div class="col-12 col-sm-6">
        <champ-recherche
          v-model="form.promotionId"
          endpoint="/promotions"
          :label-fn="(p) => p.nom"
          :label="$t('common.fields.promotionRequired')"
          :disable="!form.anneeId"
          @update:model-value="chargerTarif"
        />
      </div>
    </div>

    <span class="section-titre">{{ $t('common.fields.fees') }}</span>
    <div v-if="tarifOfficiel !== null" class="plaque acces-tarif q-mb-sm">
      <div class="text-caption acces-tarif__libelle">{{ $t('inscriptions.createDialog.officialFee') }}</div>
      <div class="lettrage chiffres acces-tarif__montant">
        {{ montantLisible(tarifOfficiel) }} {{ $t('common.units.gnf') }}
      </div>
    </div>
    <q-input
      v-if="tarifOfficiel === null"
      v-model.number="form.montantFrais"
      type="number"
      outlined
      dense
      :label="$t('inscriptions.createDialog.amount')"
      :hint="$t('inscriptions.createDialog.noFee')"
    />
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useReferentielsStore } from '@/stores/referentiels';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { montantLisible } from '@/shared/utils/libelles';
import { fraisScolariteService } from '../services/frais';
import { inscriptionsService } from '../services/inscriptions';

const ouvert = defineModel<boolean>({ required: true });
const emit = defineEmits<{ enregistre: [] }>();

const $q = useQuasar();
const referentiels = useReferentielsStore();
const { t } = useI18n();
const enregistrement = ref(false);
const tarifOfficiel = ref<number | null>(null);

const form = ref({
  etudiantId: '',
  anneeId: '',
  promotionId: '',
  montantFrais: null as number | null,
});

watch(ouvert, (o) => {
  if (!o) return;
  form.value = { etudiantId: '', anneeId: '', promotionId: '', montantFrais: null };
  tarifOfficiel.value = null;
  void chargerAnneeDefaut();
});

async function chargerAnneeDefaut() {
  try {
    const liste = await referentiels.annees();
    form.value.anneeId = referentiels.anneeCourante?.id ?? liste[0]?.id ?? '';
  } catch {
    form.value.anneeId = '';
  }
}

function onAnneeChange() {
  form.value.promotionId = '';
  tarifOfficiel.value = null;
  form.value.montantFrais = null;
}

async function chargerTarif() {
  tarifOfficiel.value = null;
  if (!form.value.promotionId) return;
  try {
    const liste = await fraisScolariteService.liste({
      all: '1',
      promotionId: form.value.promotionId,
      anneeId: form.value.anneeId || undefined,
    });
    if (liste.length) {
      tarifOfficiel.value = liste[0].montant;
      form.value.montantFrais = liste[0].montant;
    } else {
      form.value.montantFrais = null;
    }
  } catch {
    form.value.montantFrais = null;
  }
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    await inscriptionsService.creer({
      etudiantId: form.value.etudiantId,
      anneeId: form.value.anneeId || undefined,
      promotionId: form.value.promotionId,
      montantFrais: form.value.montantFrais === null ? undefined : form.value.montantFrais,
    });
    $q.notify({ type: 'positive', message: t('inscriptions.createDialog.created') });
    emit('enregistre');
    ouvert.value = false;
  } catch {
    /* l'intercepteur axios affiche le motif */
  } finally {
    enregistrement.value = false;
  }
}
</script>

<style scoped lang="scss">
.acces-tarif {
  padding: var(--up-3) var(--up-4);
  display: grid;
  gap: var(--up-1);
}
.acces-tarif__libelle {
  color: var(--up-encre-douce);
  letter-spacing: -0.01em;
}
.acces-tarif__montant {
  font-size: 1.3rem;
  color: $vert;
}
</style>
