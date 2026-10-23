<template>
  <dialogue-formulaire
    v-model="ouvert"
    taille="l"
    :titre="$t('courrier.actions.register')"
    :sous-titre="$t('courrier.registrationDialog.subtitle')"
    :libelle-valider="$t('common.actions.register')"
    :envoi="envoi"
    @valider="enregistrer"
  >
    <div class="q-gutter-md">
      <div class="row q-col-gutter-md">
        <div class="col-6">
          <q-input
            v-model="form.numero"
            outlined
            dense
            hide-bottom-space
            :label="$t('courrier.registrationDialog.number')"
            :rules="[requis]"
          />
        </div>
        <div class="col-6">
          <q-select
            v-model="form.type"
            :options="optionsTypes"
            outlined
            dense
            emit-value
            map-options
            :label="$t('common.fields.type')"
          />
        </div>
      </div>
      <q-input
        v-model="form.objet"
        outlined
        dense
        hide-bottom-space
        :label="$t('courrier.table.columns.objet')"
        :rules="[requis]"
      />
      <champ-recherche
        v-if="auth.utilisateur?.role !== 'CHEF_DEPARTEMENT'"
        v-model="form.departementId"
        endpoint="/departements"
        :label="$t('courrier.registrationDialog.department')"
        :label-fn="(d: any) => `${d.code} — ${d.nom}`"
      />
      <div class="text-caption text-grey-7">{{ $t(auth.utilisateur?.role === 'CHEF_DEPARTEMENT' ? 'courrier.registrationDialog.ownDepartment' : 'courrier.registrationDialog.departmentHint') }}</div>
      <div class="row q-col-gutter-md">
        <div v-if="form.type === 'ENTRANT'" class="col-6">
          <q-input v-model="form.expediteur" outlined dense :label="$t('courrier.registrationDialog.sender')" />
        </div>
        <div v-else class="col-6">
          <q-input v-model="form.destinataire" outlined dense :label="$t('common.fields.recipient')" />
        </div>
        <div class="col-6">
          <champ-date v-if="form.type === 'ENTRANT'" v-model="form.dateReception" :label="$t('courrier.registrationDialog.receivedOn')" />
          <champ-date v-else v-model="form.dateEnvoi" :label="$t('courrier.registrationDialog.sentOn')" />
        </div>
      </div>
      <q-input v-model="form.numeroReference" outlined dense :label="$t('courrier.registrationDialog.archiveReference')" />
      <q-file v-model="fichier" outlined dense :label="$t('courrier.registrationDialog.attachment')" accept="image/*,.pdf" @update:model-value="lireFichier">
        <template #prepend><q-icon name="attach_file" /></template>
      </q-file>
      <q-input v-model="form.notes" outlined dense type="textarea" rows="2" :label="$t('common.fields.notes')" />

      <div>
        <div class="text-subtitle2 q-mb-sm">{{ $t('courrier.registrationDialog.routing') }}</div>
        <q-list bordered separator dense>
          <q-item v-for="(e, i) in form.circuit" :key="i">
            <q-item-section>
              <div class="row q-col-gutter-sm items-center">
                <div class="col-2">
                  <q-input v-model.number="e.ordre" type="number" min="1" outlined dense label="#" />
                </div>
                <div class="col">
                  <q-input v-model="e.roleValideur" outlined dense :label="$t('courrier.registrationDialog.approverRole')" />
                </div>
                <div class="col-auto">
                  <q-btn flat round dense icon="delete" color="negative" :aria-label="$t('common.actions.delete')" @click="form.circuit.splice(i, 1)" />
                </div>
              </div>
            </q-item-section>
          </q-item>
          <q-item v-if="!form.circuit.length">
            <q-item-section class="text-grey-7 text-caption">
              {{ $t('courrier.registrationDialog.noRouting') }}
            </q-item-section>
          </q-item>
        </q-list>
        <q-btn flat dense icon="add" no-caps :label="$t('courrier.registrationDialog.addStep')" class="q-mt-sm" @click="ajouterEtape" />
      </div>
    </div>
  </dialogue-formulaire>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { api } from '@/boot/axios';
import ChampDate from '@/shared/components/ChampDate.vue';
import ChampRecherche from '@/shared/components/ChampRecherche.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { useAuthStore } from '@/stores/auth';

const ouvert = defineModel<boolean>({ required: true });
const emit = defineEmits<{ enregistre: [] }>();

const auth = useAuthStore();
const $q = useQuasar();
const { t: $t } = useI18n();
const requis = (v: string) => !!(v ?? '').trim() || $t('common.messages.errors.required');

const optionsTypes = computed(() => [
  { label: $t('courrier.registrationDialog.incoming'), value: 'ENTRANT' },
  { label: $t('courrier.registrationDialog.outgoing'), value: 'SORTANT' },
]);

const fichier = ref<File | null>(null);
const envoi = ref(false);

interface EtapeForm {
  ordre: number;
  roleValideur: string;
}

function formVide() {
  return {
    numero: '',
    type: 'ENTRANT' as 'ENTRANT' | 'SORTANT',
    objet: '',
    departementId: null as string | null,
    expediteur: '',
    destinataire: '',
    dateReception: '',
    dateEnvoi: '',
    numeroReference: '',
    notes: '',
    fichier: undefined as string | undefined,
    circuit: [] as EtapeForm[],
  };
}

const form = ref(formVide());

function ajouterEtape() {
  form.value.circuit.push({
    ordre: (form.value.circuit.at(-1)?.ordre ?? 0) + 1,
    roleValideur: '',
  });
}

function lireFichier(f: File | null) {
  if (!f) {
    form.value.fichier = undefined;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => (form.value.fichier = String(reader.result));
  reader.readAsDataURL(f);
}

async function enregistrer() {
  envoi.value = true;
  try {
    await api.post('/courrier', {
      ...form.value,
      departementId: form.value.departementId || undefined,
      dateReception: form.value.dateReception || undefined,
      dateEnvoi: form.value.dateEnvoi || undefined,
    });
    $q.notify({ type: 'positive', message: $t('courrier.registrationDialog.saved') });
    emit('enregistre');
    ouvert.value = false;
    form.value = formVide();
    fichier.value = null;
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    envoi.value = false;
  }
}
</script>
