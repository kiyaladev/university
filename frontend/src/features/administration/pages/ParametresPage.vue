<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('parametres.title')" :subtitle="$t('parametres.subtitle')" />

    <section aria-labelledby="regles-presence">
      <h2 id="regles-presence" class="text-h6">{{ $t('parametres.attendanceRules') }}</h2>

      <div class="col-auto q-gutter-sm">
        <q-btn
          flat
          no-caps
          icon="undo"
          :label="$t('parametres.actions.discard')"
          :disable="!modifie || chargement"
          @click="charger"
        />
        <q-btn
          color="primary"
          unelevated
          no-caps
          icon="save"
          :label="$t('parametres.actions.save')"
          :disable="!modifie"
          :loading="enregistrement"
          @click="enregistrer"
        />
      </div>

      <q-banner v-if="modifie" class="note--alerte q-mb-md" style="max-width: 820px">
        <template #avatar><q-icon name="edit_note" /></template>
        {{ $t('parametres.banner.unsavedChanges') }}
      </q-banner>

      <q-linear-progress v-if="chargement" indeterminate color="primary" class="q-mb-sm" />

      <q-card
        v-for="groupe in groupes"
        :key="groupe.titre"
        flat
        bordered
        class="carte q-mb-md"
        style="max-width: 820px"
      >
        <q-card-section class="q-pb-none">
          <span class="section-titre">{{ groupe.titre }}</span>
          <div class="text-caption text-grey-7">{{ groupe.aide }}</div>
        </q-card-section>
        <q-list separator>
          <q-item v-for="p in groupe.parametres" :key="p.cle" class="parametre-row">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ etiquette(p.cle) }}</q-item-label>
              <q-item-label caption>{{ p.description }}</q-item-label>
            </q-item-section>
            <q-item-section side style="min-width: 220px">
              <q-toggle
                v-if="estBooleen(p.valeur)"
                :model-value="p.valeur === 'true'"
                :aria-label="etiquette(p.cle)"
                @update:model-value="(v) => (p.valeur = String(v))"
              />
              <q-input
                v-else
                v-model="p.valeur"
                outlined
                dense
                :type="estNombre(p.valeur) ? 'number' : 'text'"
                :aria-label="etiquette(p.cle)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <etat-vide v-if="!chargement && !parametres.length" icone="settings" :titre="$t('parametres.emptyState.title')">
        <template #action>
          <q-btn flat no-caps icon="refresh" :label="$t('common.actions.reload')" @click="charger" />
        </template>
      </etat-vide>
    </section>
    <services-actifs />
    <q-btn
      to="/demandes-docs/tarifs"
      flat
      no-caps
      icon="price_change"
      :label="$t('nav.tarifs-demandes')"
      class="q-mb-md"
    />

    <q-btn to="/audit" outline no-caps icon="history" :label="$t('audit.title')" />
  </q-page>
</template>

<script setup lang="ts">
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { api } from '@/boot/axios';
import ServicesActifs from '../components/ServicesActifs.vue';

const $q = useQuasar();
const { t } = useI18n();

interface Parametre {
  cle: string;
  valeur: string;
  description?: string | null;
}

const parametres = ref<Parametre[]>([]);
/** Copie de référence : sert à détecter les modifications non enregistrées. */
const reference = ref<Record<string, string>>({});
const chargement = ref(false);
const enregistrement = ref(false);

const ETIQUETTES = computed<Record<string, string>>(() => ({
  NOM_ETABLISSEMENT: t('parametres.fields.NOM_ETABLISSEMENT'),
  TOLERANCE_RETARD_MIN: t('parametres.fields.TOLERANCE_RETARD_MIN'),
  ABSENCE_APRES_MIN: t('parametres.fields.ABSENCE_APRES_MIN'),
  DUREE_MIN_VALIDE: t('parametres.fields.DUREE_MIN_VALIDE'),
  QR_OBLIGATOIRE: t('parametres.fields.QR_OBLIGATOIRE'),
  GEOLOC_OBLIGATOIRE: t('parametres.fields.GEOLOC_OBLIGATOIRE'),
  ATTESTATION_OBLIGATOIRE: t('parametres.fields.ATTESTATION_OBLIGATOIRE'),
  SIGNATURE_OBLIGATOIRE: t('parametres.fields.SIGNATURE_OBLIGATOIRE'),
  EMPREINTE_SCORE_MIN: t('parametres.fields.EMPREINTE_SCORE_MIN'),
  EFFECTIF_OBLIGATOIRE: t('parametres.fields.EFFECTIF_OBLIGATOIRE'),
}));

/** Regroupement lisible : l'établissement, le temps, puis les preuves. */
const GROUPES = computed<Array<{ titre: string; aide: string; cles: string[] }>>(() => [
  {
    titre: t('parametres.groups.etablissement.title'),
    aide: t('parametres.groups.etablissement.hint'),
    cles: ['NOM_ETABLISSEMENT'],
  },
  {
    titre: t('parametres.groups.tolerances.title'),
    aide: t('parametres.groups.tolerances.hint'),
    cles: ['TOLERANCE_RETARD_MIN', 'ABSENCE_APRES_MIN', 'DUREE_MIN_VALIDE'],
  },
  {
    titre: t('parametres.groups.preuves.title'),
    aide: t('parametres.groups.preuves.hint'),
    cles: [
      'QR_OBLIGATOIRE',
      'GEOLOC_OBLIGATOIRE',
      'ATTESTATION_OBLIGATOIRE',
      'SIGNATURE_OBLIGATOIRE',
      'EMPREINTE_SCORE_MIN',
      'EFFECTIF_OBLIGATOIRE',
    ],
  },
]);

const etiquette = (cle: string) => ETIQUETTES.value[cle] ?? cle;
const estBooleen = (v: string) => v === 'true' || v === 'false';
const estNombre = (v: string) => /^\d+$/.test(v);

const groupes = computed(() => {
  const classees = new Set(GROUPES.value.flatMap((g) => g.cles));
  const blocs = GROUPES.value
    .map((g) => ({
      titre: g.titre,
      aide: g.aide,
      parametres: g.cles.map((c) => parametres.value.find((p) => p.cle === c)).filter((p): p is Parametre => !!p),
    }))
    .filter((g) => g.parametres.length);

  // Une clé ajoutée côté serveur reste visible même sans étiquette dédiée.
  const autres = parametres.value.filter((p) => !classees.has(p.cle));
  if (autres.length) {
    blocs.push({
      titre: t('parametres.groups.autres.title'),
      aide: t('parametres.groups.autres.hint'),
      parametres: autres,
    });
  }
  return blocs;
});

const modifie = computed(() => parametres.value.some((p) => reference.value[p.cle] !== p.valeur));

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/parametres');
    parametres.value = data;
    reference.value = Object.fromEntries((data as Parametre[]).map((p) => [p.cle, p.valeur]));
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    chargement.value = false;
  }
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    const { data } = await api.put('/parametres', { parametres: parametres.value });
    parametres.value = data;
    reference.value = Object.fromEntries((data as Parametre[]).map((p) => [p.cle, p.valeur]));
    $q.notify({ type: 'positive', message: t('parametres.messages.saved') });
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}

onMounted(async () => {
  await charger();
});
</script>

<style scoped lang="scss">
@media (max-width: 599px) {
  .parametre-row {
    flex-direction: column;
    align-items: stretch;
  }
  .parametre-row :deep(.q-item__section--side) {
    min-width: 0 !important;
    width: 100%;
    padding: 12px 0 0;
  }
}
</style>
