<template>
  <q-dialog :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <q-card style="width: 620px; max-width: 95vw">
      <q-card-section class="text-h6">Nouvelle inscription (guichet)</q-card-section>

      <q-card-section>
        <span class="section-titre">Étudiant</span>
        <autocomplete-async
          v-model="form.etudiantId"
          endpoint="/etudiants"
          :label-fn="(e) => `${e.matricule} — ${e.nom} ${e.prenom}${e.actif ? '' : ' (inactif)'}`"
          label="Étudiant *"
          placeholder="Tapez nom, prénom ou matricule…"
        />

        <span class="section-titre">Parcours</span>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.anneeId"
              endpoint="/annees"
              :label-fn="(a) => a.libelle"
              label="Année académique *"
              @update:model-value="onAnneeChange"
            />
          </div>
          <div class="col-12 col-sm-6">
            <autocomplete-async
              v-model="form.promotionId"
              endpoint="/promotions"
              :label-fn="(p) => p.nom"
              label="Promotion *"
              :disable="!form.anneeId"
              @update:model-value="chargerTarif"
            />
          </div>
        </div>

        <span class="section-titre">Frais</span>
        <div v-if="tarifOfficiel !== null" class="plaque acces-tarif q-mb-sm">
          <div class="text-caption acces-tarif__libelle">Tarif officiel</div>
          <div class="lettrage chiffres acces-tarif__montant">
            {{ montantLisible(tarifOfficiel) }} GNF
          </div>
        </div>
        <q-input
          v-model.number="form.montantFrais"
          type="number"
          outlined
          dense
          label="Montant des frais (GNF)"
          :disable="tarifOfficiel !== null"
          :hint="tarifOfficiel !== null ? 'Tarif officiel appliqué automatiquement' : 'Aucun tarif paramétré : saisissez le montant'"
        >
          <template #append>
            <q-icon
              v-if="tarifOfficiel !== null"
              name="verified"
              color="positive"
            >
              <q-tooltip>Tarif officiel appliqué automatiquement</q-tooltip>
            </q-icon>
          </template>
        </q-input>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          color="primary"
          unelevated
          no-caps
          label="Enregistrer l’inscription"
          :loading="enregistrement"
          :disable="!form.etudiantId || !form.promotionId || form.montantFrais === null"
          @click="enregistrer"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import AutocompleteAsync from './AutocompleteAsync.vue';
import { montantLisible } from '../utils/libelles';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const enregistrement = ref(false);
const tarifOfficiel = ref<number | null>(null);

const form = ref({
  etudiantId: '',
  anneeId: '',
  promotionId: '',
  montantFrais: null as number | null,
});

watch(
  () => props.modelValue,
  (ouvert) => {
    if (!ouvert) return;
    form.value = { etudiantId: '', anneeId: '', promotionId: '', montantFrais: null };
    tarifOfficiel.value = null;
    void chargerAnneeDefaut();
  },
);

async function chargerAnneeDefaut() {
  try {
    const { data } = await api.get('/annees', { params: { all: '1' } });
    const liste = Array.isArray(data) ? data : data.data ?? [];
    form.value.anneeId = liste.find((a: any) => a.active)?.id ?? liste[0]?.id ?? '';
  } catch {
    form.value.anneeId = '';
  }
}

async function onAnneeChange() {
  form.value.promotionId = '';
  tarifOfficiel.value = null;
  form.value.montantFrais = null;
}

async function chargerTarif() {
  tarifOfficiel.value = null;
  if (!form.value.promotionId) return;
  try {
    const { data } = await api.get('/frais', {
      params: {
        all: '1',
        promotionId: form.value.promotionId,
        anneeId: form.value.anneeId || undefined,
      },
    });
    const liste = Array.isArray(data) ? data : data.data ?? [];
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
    await api.post('/inscriptions', {
      etudiantId: form.value.etudiantId,
      anneeId: form.value.anneeId || undefined,
      promotionId: form.value.promotionId,
      montantFrais: form.value.montantFrais === null ? undefined : form.value.montantFrais,
    });
    $q.notify({ type: 'positive', message: 'Inscription créée — en attente de paiement' });
    emit('enregistre');
    emit('update:modelValue', false);
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
  text-transform: uppercase;
  color: var(--up-encre-douce);
  letter-spacing: 0.06em;
}
.acces-tarif__montant {
  font-size: 1.3rem;
  color: $vert;
}
</style>
