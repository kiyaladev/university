<template>
  <!--
    Demande d'inscription à une formation de la vitrine : le participant
    renseigne son identité, vérifie le récapitulatif, puis dépose sa demande.
    La demande est sans compte : le dépôt ne demande qu'un nom et un numéro.
  -->
  <q-dialog v-model="ouvert" persistent>
    <q-card style="width: 560px; max-width: 95vw">
      <!-- Étape 1 : identité -->
      <q-card-section v-if="etape === 1">
        <div class="text-h6">{{ $t('formationsPubliques.dialog.step1.title') }}</div>
        <div class="text-caption text-grey-7 q-mt-xs">
          <strong>{{ formation?.titre }}</strong> {{ $t('common.format.emptyValue') }}
          {{ montantLisible(formation?.prix ?? 0) }} {{ formation?.devise ?? DEVISE }}
        </div>
      </q-card-section>
      <q-card-section v-if="etape === 1">
        <span class="section-titre">{{ $t('common.fields.identity') }}</span>
        <q-input
          v-model="form.nomComplet"
          outlined
          dense
          :label="$t('formationsPubliques.dialog.step1.nomComplet.label')"
          :hint="$t('formationsPubliques.dialog.step1.nomComplet.hint')"
          autofocus
        />
        <q-input
          v-model="form.telephone"
          outlined
          dense
          :label="$t('formationsPubliques.dialog.step1.telephone.label')"
          :hint="$t('formationsPubliques.dialog.step1.telephone.hint')"
        />
        <q-input
          v-model="form.email"
          outlined
          dense
          type="email"
          :label="$t('formationsPubliques.dialog.step1.email.label')"
        />
        <q-input
          v-model="form.matricule"
          outlined
          dense
          :label="$t('formationsPubliques.dialog.step1.matricule.label')"
          :hint="$t('formationsPubliques.dialog.step1.matricule.hint')"
        />
      </q-card-section>

      <!-- Étape 2 : récapitulatif -->
      <q-card-section v-if="etape === 2">
        <div class="text-h6">{{ $t('formationsPubliques.dialog.step2.title') }}</div>
        <div class="plaque recapitulatif">
          <div class="recapitulatif__ligne">
            <span class="pochoir">{{ $t('formationsPubliques.dialog.step2.formation') }}</span>
            <span class="recapitulatif__valeur">{{ formation?.titre }}</span>
          </div>
          <div class="recapitulatif__ligne">
            <span class="pochoir">{{ $t('formationsPubliques.dialog.step2.participant') }}</span>
            <span class="recapitulatif__valeur">{{ form.nomComplet }}</span>
          </div>
          <div class="recapitulatif__ligne">
            <span class="pochoir">{{ $t('common.fields.phone') }}</span>
            <span class="recapitulatif__valeur chiffres">{{ form.telephone }}</span>
          </div>
          <div class="recapitulatif__ligne">
            <span class="pochoir">{{ $t('formationsPubliques.dialog.step2.montantARegler') }}</span>
            <span class="lettrage chiffres recapitulatif__montant">
              {{ montantLisible(formation?.prix ?? 0) }} {{ formation?.devise ?? DEVISE }}
            </span>
          </div>
        </div>
        <p class="recapitulatif__note">
          {{ $t('formationsPubliques.dialog.step2.note') }}
        </p>
        <q-banner v-if="messageErreur" class="note--erreur">
          <template #avatar><q-icon name="error" /></template>
          {{ messageErreur }}
        </q-banner>
      </q-card-section>

      <!-- Étape 3 : demande déposée -->
      <q-card-section v-if="etape === 3 && resultat">
        <div class="recapitulatif__succes">
          <div class="recapitulatif__tampon" aria-hidden="true">
            <span class="pochoir">{{ $t('formationsPubliques.dialog.step3.demande') }}</span>
            <span class="lettrage">{{ $t('formationsPubliques.dialog.step3.deposee') }}</span>
          </div>
          <p class="pochoir recapitulatif__ref">{{ $t('formationsPubliques.dialog.step3.numeroDossier') }}</p>
          <p class="lettrage chiffres recapitulatif__numero">{{ resultat.numero }}</p>
        </div>

        <div class="plaque recapitulatif__paiement">
          <div class="text-caption">{{ $t('formationsPubliques.dialog.step3.aReglerMobileMoney') }}</div>
          <div class="lettrage chiffres recapitulatif__somme">
            {{ montantLisible(resultat.montant) }} {{ resultat.devise }}
          </div>
          <p class="recapitulatif__paiement-texte">
            <i18n-t keypath="formationsPubliques.dialog.step3.paiementTexte" tag="span">
              <template #numero>{{ resultat.numero }}</template>
              <template #confirmee
                ><strong>{{ $t('formationsPubliques.dialog.step3.confirmee') }}</strong></template
              >
            </i18n-t>
          </p>
        </div>

        <q-banner class="note--info">
          <template #avatar><q-icon name="hourglass_top" /></template>
          <i18n-t keypath="formationsPubliques.dialog.step3.statutInfo" tag="span">
            <template #statut
              ><strong>{{ $t('formationsPubliques.dialog.step3.enAttentePaiement') }}</strong></template
            >
          </i18n-t>
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <template v-if="etape === 1">
          <q-btn flat no-caps :label="$t('common.actions.close')" v-close-popup />
          <q-btn
            color="primary"
            unelevated
            no-caps
            :label="$t('formationsPubliques.dialog.step1.voirRecap')"
            :disable="!identiteValide"
            @click="etape = 2"
          >
            <q-tooltip v-if="!identiteValide">
              {{ $t('formationsPubliques.dialog.step1.renseignerAbord') }}
            </q-tooltip>
          </q-btn>
        </template>
        <template v-else-if="etape === 2">
          <q-btn flat no-caps :label="$t('formationsPubliques.dialog.step2.retour')" @click="etape = 1" />
          <q-btn
            color="primary"
            unelevated
            no-caps
            :label="$t('formationsPubliques.dialog.step2.deposer')"
            :loading="depotEnCours"
            @click="deposer"
          />
        </template>
        <template v-else>
          <q-btn flat no-caps :label="$t('common.actions.close')" v-close-popup @click="fermer" />
          <q-btn
            color="primary"
            unelevated
            no-caps
            :label="$t('formationsPubliques.dialog.step3.inscrireAutre')"
            @click="inscrireUnAutre"
          />
        </template>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { formationsService, type FormationVitrine, type ResultatDepotInscription } from '@/shared/services/formations';
import { DEVISE, montantLisible } from '@/shared/utils/libelles';

const props = defineProps<{ formation: FormationVitrine | null }>();

const ouvert = defineModel<boolean>({ required: true });

const { t } = useI18n();

const etape = ref(1);
const depotEnCours = ref(false);
const messageErreur = ref('');
const resultat = ref<ResultatDepotInscription | null>(null);

const form = ref({ nomComplet: '', telephone: '', email: '', matricule: '' });

/** Les deux champs obligatoires du dépôt : contrôlés dès l'étape 1. */
const identiteValide = computed(
  () => form.value.nomComplet.trim().length >= 2 && form.value.telephone.trim().length >= 6,
);

/** Chaque ouverture repart d'une demande vierge. */
watch(ouvert, (visible) => {
  if (visible) reinitialiserFormulaire();
});

function reinitialiserFormulaire() {
  form.value = { nomComplet: '', telephone: '', email: '', matricule: '' };
  messageErreur.value = '';
  resultat.value = null;
  etape.value = 1;
}

function fermer() {
  ouvert.value = false;
}

/** Enchaîner un second participant sur la même formation, sans ressortir. */
function inscrireUnAutre() {
  reinitialiserFormulaire();
}

async function deposer() {
  messageErreur.value = '';
  if (!identiteValide.value) {
    messageErreur.value = t('formationsPubliques.messages.identiteObligatoire');
    return;
  }
  depotEnCours.value = true;
  try {
    const { data } = await formationsService.inscriptionPublique(props.formation!.id, {
      nomComplet: form.value.nomComplet.trim(),
      telephone: form.value.telephone.trim(),
      email: form.value.email.trim() || undefined,
      matricule: form.value.matricule.trim() || undefined,
    });
    resultat.value = data;
    etape.value = 3;
  } catch (e: unknown) {
    const corps = (e as { response?: { data?: { message?: string } } } | null)?.response?.data;
    messageErreur.value = corps?.message ?? t('formationsPubliques.messages.depotImpossible');
  } finally {
    depotEnCours.value = false;
  }
}
</script>

<style scoped lang="scss">
@use '@/css/quasar.variables' as *;

.recapitulatif {
  padding: var(--up-3);
  display: grid;
  gap: var(--up-2);
}

.recapitulatif__ligne {
  display: flex;
  justify-content: space-between;
  gap: var(--up-3);
  align-items: baseline;

  .pochoir {
    color: var(--up-encre-douce);
  }
}

.recapitulatif__valeur {
  text-align: right;
  font-weight: 600;
}

.recapitulatif__montant {
  color: $vert;
  font-size: 1.3rem;
}

.recapitulatif__note {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--up-encre-douce);
  margin: var(--up-3) 0 0;
}

.recapitulatif__succes {
  display: grid;
  gap: var(--up-2);
  justify-items: start;
}

.recapitulatif__tampon {
  display: inline-flex;
  align-items: center;
  gap: var(--up-2);
  background: $vert-fond;
  color: #{$vert};
  border-radius: var(--up-pilule);
  padding: var(--up-2) var(--up-3);
}

.recapitulatif__ref {
  color: var(--up-encre-douce);
  margin: var(--up-2) 0 0;
}

.recapitulatif__numero {
  font-size: clamp(1.7rem, 1.2rem + 2vw, 2.4rem);
  margin: 0;
}

.recapitulatif__paiement {
  padding: var(--up-4);
  display: grid;
  gap: var(--up-2);
  margin-top: var(--up-3);
}

.recapitulatif__somme {
  font-size: clamp(1.5rem, 1rem + 1.8vw, 2.2rem);
  color: $vert;
}

.recapitulatif__paiement-texte {
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
  max-width: 46ch;
}
</style>
