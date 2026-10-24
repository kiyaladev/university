<template>
  <div class="row q-col-gutter-md">
    <div class="col-12 col-md-7">
      <section class="plaque guichet">
        <header class="guichet__entete">
          <span class="lettrage">{{ $t('resto.guichet.header') }}</span>
          <span class="pochoir pochoir--brut">{{ $t('resto.guichet.onlineNote') }}</span>
        </header>

        <lecteur-qr
          v-model="reference"
          :label="$t('resto.guichet.studentLabel')"
          :hint="$t('resto.guichet.studentHint')"
        />

        <div class="row q-col-gutter-md q-mt-sm">
          <div class="col-12 col-sm-6">
            <q-select
              v-model="repas"
              :options="optionsRepas"
              :label="$t('resto.guichet.mealLabel')"
              outlined
              dense
              emit-value
              map-options
              @update:model-value="repasChoisi"
            />
          </div>
          <div class="col-6 col-sm-3">
            <q-input
              v-model.number="montant"
              type="number"
              min="500"
              step="500"
              outlined
              dense
              :label="$t('resto.guichet.priceLabel')"
              :suffix="DEVISE"
            />
          </div>
          <div class="col-6 col-sm-3">
            <q-input
              v-model="cantine"
              outlined
              dense
              :label="$t('resto.cantine')"
              :placeholder="$t('resto.guichet.cantinePlaceholder')"
            />
          </div>
        </div>

        <q-btn
          unelevated
          color="primary"
          size="lg"
          no-caps
          icon="check"
          :label="$t('resto.guichet.validate')"
          class="guichet__valider full-width"
          :loading="validationChargement"
          :disable="!reference.trim() || !montant || montant < 500"
          @click="validerRepas"
        />
      </section>
    </div>

    <div class="col-12 col-md-5">
      <!-- Écran vert : repas validé -->
      <section v-if="resultatOk" class="plaque guichet-resultat guichet-resultat--ok">
        <q-icon name="check_circle" size="52px" color="positive" />
        <p class="lettrage guichet-resultat__titre">{{ $t('resto.guichet.result.ok.title') }}</p>
        <p class="guichet-resultat__nom">{{ resultatOk.etudiant.prenom }} {{ resultatOk.etudiant.nom }}</p>
        <p class="pochoir chiffres">{{ resultatOk.etudiant.matricule }}</p>
        <div class="guichet-resultat__lignes">
          <div class="guichet-resultat__ligne">
            <span>{{ LIBELLE_TYPE_REPAS[resultatOk.consommation.repas] }}</span>
            <span class="chiffres"
              >{{ montantLisible(resultatOk.consommation.montant) }} {{ $t('common.units.gnf') }}</span
            >
          </div>
          <div v-if="resultatOk.consommation.cantine" class="guichet-resultat__ligne">
            <span>{{ $t('resto.cantine') }}</span>
            <span>{{ resultatOk.consommation.cantine }}</span>
          </div>
          <div class="guichet-resultat__ligne guichet-resultat__ligne--fort">
            <span>{{ $t('resto.guichet.result.ok.newBalance') }}</span>
            <span class="chiffres">{{ montantLisible(resultatOk.solde) }} {{ $t('common.units.gnf') }}</span>
          </div>
        </div>
      </section>

      <!-- Écran d'erreur -->
      <section v-else-if="resultatKo" class="plaque guichet-resultat guichet-resultat--ko">
        <q-icon name="error" size="52px" color="negative" />
        <p class="lettrage guichet-resultat__titre">{{ $t('resto.guichet.result.ko.title') }}</p>
        <p class="guichet-resultat__message">{{ resultatKo.message }}</p>
        <q-btn
          v-if="resultatKo.soldeInsuffisant"
          unelevated
          color="negative"
          no-caps
          icon="account_balance_wallet"
          :label="$t('resto.guichet.result.ko.rechargeWallet')"
          @click="rechargerDepuisGuichet"
          class="q-mt-md"
        />
      </section>

      <!-- État vide -->
      <section v-else class="plaque guichet-resultat guichet-resultat--vide">
        <q-icon name="qr_code_scanner" size="52px" color="grey-6" />
        <p class="pochoir guichet-resultat__message">
          {{ $t('resto.guichet.result.empty.message') }}
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { isAxiosError } from 'axios';
import LecteurQr from '@/shared/components/LecteurQr.vue';
import { DEVISE, LIBELLE_TYPE_REPAS, montantLisible } from '@/shared/utils/libelles';
import { restoService } from '../services/resto';
import type { ResultatGuichetKo, ResultatGuichetOk, ResultatValidationRepas } from '../types';
import type { TypeRepas } from '@/types';

const emit = defineEmits<{ recharger: [etudiantId: string | null] }>();

const { t } = useI18n();

const PRIX_REPAS: Record<TypeRepas, number> = {
  PETIT_DEJEUNER: 10_000,
  DEJEUNER: 15_000,
  DINER: 15_000,
  COLLATION: 5_000,
  AUTRE: 0,
};

const reference = ref('');
const repas = ref<TypeRepas>('DEJEUNER');
const montant = ref(PRIX_REPAS.DEJEUNER);
const cantine = ref('');
const validationChargement = ref(false);
/** Bandeau « repas validé » : il porte l'étudiant et la consommation. */
const resultatOk = ref<ResultatGuichetOk | null>(null);
/** Bandeau « repas refusé » : il porte le motif et le student à recharger. */
const resultatKo = ref<ResultatGuichetKo | null>(null);

const optionsRepas = computed(() =>
  (Object.keys(PRIX_REPAS) as TypeRepas[]).map((r) => ({
    value: r,
    label: `${LIBELLE_TYPE_REPAS[r]} — ${PRIX_REPAS[r] ? montantLisible(PRIX_REPAS[r], DEVISE) : t('resto.guichet.mealFree')}`,
  })),
);

function repasChoisi(v: TypeRepas) {
  if (PRIX_REPAS[v]) montant.value = PRIX_REPAS[v];
}

async function validerRepas() {
  resultatOk.value = null;
  resultatKo.value = null;
  validationChargement.value = true;
  try {
    const data = await restoService.validerRepas({
      reference: reference.value.trim(),
      repas: repas.value,
      montant: montant.value,
      cantine: cantine.value.trim() || undefined,
    });
    // Le serveur répond toujours l'étudiant et la consommation d'un repas validé.
    resultatOk.value = {
      etudiant: data.etudiant!,
      consommation: data.consommation!,
      solde: data.solde ?? 0,
    };
    reference.value = '';
  } catch (erreur: unknown) {
    // Le refus est traité ici : la requête est « silencieuse », l'intercepteur
    // axios ne notifie pas. Le corps de l'erreur porte le motif du refus.
    const corps = isAxiosError<Partial<ResultatValidationRepas>>(erreur) ? erreur.response?.data : undefined;
    resultatKo.value = {
      message: corps?.message ?? t('resto.guichet.result.ko.networkError'),
      soldeInsuffisant: corps?.soldeInsuffisant === true || corps?.code === 'SOLDE_INSUFFISANT',
      etudiantId: corps?.etudiantId,
    };
  } finally {
    validationChargement.value = false;
  }
}

function rechargerDepuisGuichet() {
  emit('recharger', resultatKo.value?.etudiantId ?? null);
}
</script>

<style scoped lang="scss">
.guichet {
  padding: var(--up-4);
  display: grid;
  gap: var(--up-3);
}

.guichet__entete {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-2);
  flex-wrap: wrap;

  .lettrage {
    font-size: 1.25rem;
  }
}

.guichet__valider {
  margin-top: var(--up-1);
}

.guichet-resultat {
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--up-2);
  text-align: center;
  padding: var(--up-4);

  &__titre {
    font-size: 1.5rem;
    margin: 0;
  }

  &__nom {
    margin: 0;
    font-size: 1.15rem;
  }

  &__message {
    color: var(--up-encre-douce);
    margin: 0;
    max-width: 38ch;
  }

  &__lignes {
    width: 100%;
    max-width: 320px;
    display: grid;
    gap: var(--up-1);
  }

  &__ligne {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--up-2);
    font-size: 0.95rem;
  }

  &__ligne--fort {
    border-top: var(--up-filet-fin);
    padding-top: var(--up-2);
    font-size: 1.05rem;
  }
}

.guichet-resultat--ok {
  border-color: var(--up-vert);
}

.guichet-resultat--ko {
  border-color: var(--up-rouge);
}

.guichet-resultat--vide {
  border-style: dashed;
}
</style>
