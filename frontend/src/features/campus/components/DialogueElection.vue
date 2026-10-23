<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { api } from '@/boot/axios';
import { OPTIONS_TYPE_ELECTION } from '../services/elections';
import type { Departement, Election, Promotion, TypeElection } from '@/types';

const $q = useQuasar();
const { t } = useI18n();

const ouvert = defineModel<boolean>({ required: true });
const props = defineProps<{
  election?: Election | null;
}>();

const emit = defineEmits<{ enregistre: [e: Election] }>();

const OPTIONS_TYPE = OPTIONS_TYPE_ELECTION;

const formulaire = ref({
  titre: '',
  type: 'DELEGUE_PROMOTION' as TypeElection,
  promotionId: null as string | null,
  departementId: null as string | null,
  description: '',
  dateOuverture: null as string | null,
  dateCloture: null as string | null,
  nbSieges: 1,
  bulletin: '',
});

const enregistrement = ref(false);

watch(
  ouvert,
  (visible) => {
    if (visible) {
      const e = props.election;
      formulaire.value = {
        titre: e?.titre ?? '',
        type: (e?.type as TypeElection) ?? 'DELEGUE_PROMOTION',
        promotionId: e?.promotionId ?? null,
        departementId: e?.departementId ?? null,
        description: e?.description ?? '',
        dateOuverture: e?.dateOuverture ? e.dateOuverture.slice(0, 16) : null,
        dateCloture: e?.dateCloture ? e.dateCloture.slice(0, 16) : null,
        nbSieges: e?.nbSieges ?? 1,
        bulletin: e?.bulletin ?? '',
      };
    }
  },
);

const enEdition = computed(() => Boolean(props.election?.id));
const titre = computed(() => (enEdition.value ? t('elections.dialogs.electionForm.titleEdit') : t('elections.dialogs.electionForm.titleNew')));

async function soumettre() {
  if (!formulaire.value.titre || !formulaire.value.dateOuverture || !formulaire.value.dateCloture) {
    $q.notify({ type: 'warning', message: t('elections.dialogs.electionForm.required') });
    return;
  }
  enregistrement.value = true;
  try {
    const url = enEdition.value ? `/elections/${props.election!.id}` : '/elections';
    const methode = enEdition.value ? 'put' : 'post';
    const payload: Record<string, unknown> = {
      titre: formulaire.value.titre,
      type: formulaire.value.type,
      dateOuverture: new Date(formulaire.value.dateOuverture).toISOString(),
      dateCloture: new Date(formulaire.value.dateCloture).toISOString(),
      nbSieges: formulaire.value.nbSieges,
    };
    if (formulaire.value.promotionId) payload.promotionId = formulaire.value.promotionId;
    if (formulaire.value.departementId) payload.departementId = formulaire.value.departementId;
    if (formulaire.value.description) payload.description = formulaire.value.description;
    if (formulaire.value.bulletin) payload.bulletin = formulaire.value.bulletin;
    const { data } = await api[methode](url, payload);
    $q.notify({ type: 'positive', message: enEdition.value ? t('elections.dialogs.electionForm.saved') : t('elections.dialogs.electionForm.created') });
    emit('enregistre', data);
    ouvert.value = false;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}
</script>

<template>
  <dialogue-formulaire
    v-model="ouvert"
    :titre="titre"
    taille="m"
    :envoi="enregistrement"
    :libelle-valider="enEdition ? $t('common.actions.save') : $t('elections.dialogs.electionForm.create')"
    @valider="soumettre"
  >
    <div class="q-gutter-md">
      <q-input v-model="formulaire.titre" :label="$t('common.fields.title')" outlined dense />
      <q-select
        v-model="formulaire.type"
        :options="OPTIONS_TYPE"
        emit-value
        map-options
        :label="$t('common.fields.type')"
        outlined
        dense
      />
      <div class="row q-col-gutter-md">
        <champ-recherche
          v-model="formulaire.promotionId"
          endpoint="/promotions"
          :label-fn="(p: Promotion) => `${p.nom} (${p.filiere?.code ?? ''})`"
          :label="$t('elections.dialogs.electionForm.promotion')"
          class="col"
        />
        <champ-recherche
          v-model="formulaire.departementId"
          endpoint="/departements"
          :label-fn="(d: Departement) => `${d.code} — ${d.nom}`"
          :label="$t('elections.dialogs.electionForm.department')"
          class="col"
        />
      </div>
      <div class="row q-col-gutter-md">
        <q-input
          v-model="formulaire.dateOuverture"
          type="datetime-local"
          :label="$t('elections.dialogs.electionForm.opening')"
          outlined
          dense
          class="col"
        />
        <q-input
          v-model="formulaire.dateCloture"
          type="datetime-local"
          :label="$t('elections.dialogs.electionForm.closing')"
          outlined
          dense
          class="col"
        />
      </div>
      <q-input
        v-model.number="formulaire.nbSieges"
        type="number"
        :label="$t('elections.dialogs.electionForm.seats')"
        outlined
        dense
      />
      <q-input
        v-model="formulaire.description"
        :label="$t('common.fields.description')"
        outlined
        dense
        type="textarea"
        autogrow
      />
    </div>
  </dialogue-formulaire>
</template>
