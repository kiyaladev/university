<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">{{ $t('seances.tournee.title') }}</div>
        <div class="text-caption text-grey-7">{{ $t('seances.tournee.help') }}</div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-6">
            <champ-date
              v-model="tournee.dateDebut"
              :label="$t('common.actions.from')"
              @update:model-value="apercu = null"
            />
          </div>
          <div class="col-6">
            <champ-date
              v-model="tournee.dateFin"
              :label="$t('common.actions.to')"
              @update:model-value="apercu = null"
            />
          </div>
        </div>
        <q-select
          v-model="tournee.departementId"
          :options="optionsDepartements"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('seances.tournee.departmentOptional')"
          @update:model-value="apercu = null"
        />
        <q-select
          v-model="tournee.controleurId"
          :options="optionsControleurs"
          outlined
          dense
          emit-value
          map-options
          :label="$t('seances.detail.assignedController')"
          @update:model-value="apercu = null"
          class="q-mt-md"
        />
        <q-banner v-if="apercu" rounded class="bg-blue-1 text-blue-10 q-mt-md">
          {{
            $t('seances.tournee.preview', {
              affectables: apercu.seancesAffectables,
              closed: apercu.ignoreesAnneeCloturee,
            })
          }}
        </q-banner>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          flat
          no-caps
          :label="$t('common.actions.cancel')"
          :disable="chargement || sauvegarde"
          @click="emit('update:modelValue', false)"
        />
        <q-btn
          v-if="!apercu"
          outline
          color="primary"
          no-caps
          icon="manage_search"
          :loading="chargement"
          :label="$t('common.actions.preview')"
          @click="previsualiser"
        />
        <q-btn
          v-else
          color="primary"
          unelevated
          no-caps
          icon="assignment_ind"
          :loading="sauvegarde"
          :disable="apercu.seancesAffectables === 0"
          :label="$t('seances.tournee.assignAction', { count: apercu.seancesAffectables })"
          @click="affecter"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import ChampDate from '@/shared/components/ChampDate.vue';
import { seancesService, type ApercuTournee } from '../services/seances';
import { useReferentielsStore } from '@/stores/referentiels';

/**
 * Affectation groupée d'une tournée : toutes les séances sans contrôleur
 * d'une période, pour un contrôleur donné.
 *
 * Le dialogue porte sa propre logique : il charge les contrôleurs, les
 * départements, prévisualise puis affecte, et prévient la page pour qu'elle
 * recharge le registre.
 */
const props = defineProps<{ modelValue: boolean; dateDebut: string; dateFin: string }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const referentiels = useReferentielsStore();

const optionsControleurs = ref<{ label: string; value: string }[]>([]);
const optionsDepartements = ref<{ label: string; value: string }[]>([]);
const chargement = ref(false);
const sauvegarde = ref(false);
const apercu = ref<ApercuTournee | null>(null);
const tournee = ref({
  dateDebut: props.dateDebut,
  dateFin: props.dateFin,
  departementId: null as string | null,
  controleurId: '',
});

watch(
  () => props.modelValue,
  async (ouvert) => {
    if (!ouvert) return;
    tournee.value = {
      dateDebut: props.dateDebut,
      dateFin: props.dateFin,
      departementId: null,
      controleurId: '',
    };
    apercu.value = null;
    chargement.value = true;
    try {
      const [controleurs, departements] = await Promise.all([
        seancesService.controleurs(),
        referentiels.departements(),
      ]);
      optionsControleurs.value = controleurs.map((u) => ({
        value: u.id,
        label: `${u.prenom} ${u.nom}`,
      }));
      optionsDepartements.value = departements.map((d) => ({ value: d.id, label: d.nom }));
      if (!tournee.value.controleurId) tournee.value.controleurId = optionsControleurs.value[0]?.value ?? '';
    } catch {
      /* notifié par l'intercepteur */
    } finally {
      chargement.value = false;
    }
  },
);

async function previsualiser() {
  if (!tournee.value.controleurId) {
    $q.notify({ type: 'warning', message: t('seances.tournee.controllerRequired') });
    return;
  }
  chargement.value = true;
  try {
    apercu.value = await seancesService.apercuTournee({
      dateDebut: tournee.value.dateDebut,
      dateFin: tournee.value.dateFin,
      controleurId: tournee.value.controleurId,
      departementId: tournee.value.departementId || undefined,
    });
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargement.value = false;
  }
}

async function affecter() {
  if (!apercu.value || !tournee.value.controleurId) return;
  sauvegarde.value = true;
  try {
    const resultat = await seancesService.affecterTournee({
      dateDebut: tournee.value.dateDebut,
      dateFin: tournee.value.dateFin,
      controleurId: tournee.value.controleurId,
      departementId: tournee.value.departementId || undefined,
    });
    emit('update:modelValue', false);
    emit('enregistre');
    $q.notify({ type: 'positive', message: t('seances.tournee.assigned', { count: resultat.seancesAffectees }) });
  } catch {
    apercu.value = null;
  } finally {
    sauvegarde.value = false;
  }
}
</script>
