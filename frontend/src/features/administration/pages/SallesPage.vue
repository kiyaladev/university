<template>
  <q-page class="q-pa-md">
    <en-tete-page :title="$t('salles.title')" :subtitle="$t('salles.subtitle')">
      <template v-if="peutGerer" #actions>
        <q-btn
          outline
          color="primary"
          no-caps
          icon="print"
          :label="$t('salles.actions.printPosters')"
          @click="imprimerQr()"
        >
          <q-tooltip>{{ $t('salles.actions.printPostersTooltip') }}</q-tooltip>
        </q-btn>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon="add"
          :label="$t('salles.actions.newRoom')"
          @click="ouvrir(null)"
        />
      </template>
    </en-tete-page>

    <barre-filtres
      v-model="filtres"
      :chips="chips"
      :placeholder="$t('salles.filters.searchPlaceholder')"
      @reinitialiser="reinitialiser"
    >
      <template #avances>
        <q-select
          v-model="filtres.batiment"
          :options="optionsBatiments"
          outlined
          dense
          clearable
          :label="$t('common.fields.building')"
        />
        <q-select
          v-model="filtres.etat"
          :options="optionsEtat"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('common.fields.state')"
        />
        <q-select
          v-if="peutGerer"
          v-model="filtres.repere"
          :options="optionsRepere"
          outlined
          dense
          clearable
          emit-value
          map-options
          :label="$t('salles.filters.gpsMark')"
        />
      </template>
    </barre-filtres>

    <q-linear-progress v-if="sal.chargement" indeterminate color="primary" class="q-mb-sm" />

    <!-- Vue cartes : chaque plaque montre le QR tel qu'il sera affiché -->
    <cartes-salles
      v-if="modeVue === 'cartes'"
      :salles="sallesAffichees"
      :chargement="sal.chargement"
      :peut-gerer="peutGerer"
      :peut-supprimer="peutSupprimer"
      :titre-vide="messageVide"
      :filtres-actifs="filtresActifs"
      @creer="ouvrir(null)"
      @reinitialiser="reinitialiser"
      @voir-seances="voirSeances"
      @imprimer="imprimerQr"
      @regenerer="regenerer"
      @modifier="ouvrir"
      @supprimer="supprimer"
    />

    <!-- Vue tableau : pour comparer capacités, bâtiments et repères -->
    <tableau-salles
      v-else
      :salles="sallesAffichees"
      :chargement="sal.chargement"
      :peut-gerer="peutGerer"
      :peut-supprimer="peutSupprimer"
      :titre-vide="messageVide"
      :filtres-actifs="filtresActifs"
      @creer="ouvrir(null)"
      @reinitialiser="reinitialiser"
      @voir-seances="voirSeances"
      @imprimer="imprimerQr"
      @regenerer="regenerer"
      @modifier="ouvrir"
      @supprimer="supprimer"
    />

    <barre-pagination
      v-if="sallesFiltrees.length"
      :page="page"
      :page-size="pageSize"
      :total="sallesFiltrees.length"
      @update:page="(v) => (page = v)"
      @update:page-size="
        (v) => {
          pageSize = v;
          page = 1;
        }
      "
      @tous="pageSize = Math.max(sallesFiltrees.length, 1)"
    />

    <!-- Formulaire salle -->
    <dialogue-formulaire
      v-model="dialogOuvert"
      :titre="salleEditee ? $t('salles.dialog.editTitle') : $t('salles.dialog.newTitle')"
      taille="s"
      :libelle-valider="$t('common.actions.save')"
      :envoi="enregistrement"
      @valider="enregistrer"
    >
      <span class="section-titre">{{ $t('common.fields.identification') }}</span>
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-5">
          <q-input
            v-model="form.code"
            outlined
            dense
            :label="$t('common.fields.codeRequired')"
            :hint="$t('salles.dialog.codeHint')"
            :rules="[(v: string) => !!(v ?? '').trim() || $t('salles.dialog.codeRequired')]"
          />
        </div>
        <div class="col-12 col-sm-7">
          <q-input
            v-model="form.nom"
            outlined
            dense
            :label="$t('common.fields.nameRequired')"
            :rules="[(v: string) => !!(v ?? '').trim() || $t('salles.dialog.nameRequired')]"
          />
        </div>
      </div>
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-7">
          <q-input v-model="form.batiment" outlined dense :label="$t('common.fields.building')" />
        </div>
        <div class="col-5">
          <q-input
            v-model.number="form.capacite"
            type="number"
            min="0"
            outlined
            dense
            :label="$t('common.fields.capacity')"
          />
        </div>
      </div>

      <span class="section-titre">{{ $t('salles.dialog.gpsSection') }}</span>
      <p class="page-sous-titre q-mb-md">
        {{ $t('salles.dialog.gpsHelp') }}
      </p>
      <div class="row q-col-gutter-md">
        <div class="col-4">
          <q-input
            v-model.number="form.latitude"
            type="number"
            outlined
            dense
            :label="$t('salles.dialog.latitudeLabel')"
          />
        </div>
        <div class="col-4">
          <q-input
            v-model.number="form.longitude"
            type="number"
            outlined
            dense
            :label="$t('salles.dialog.longitudeLabel')"
          />
        </div>
        <div class="col-4">
          <q-input
            v-model.number="form.rayonMetres"
            type="number"
            min="10"
            outlined
            dense
            :label="$t('salles.dialog.radiusLabel')"
            :rules="[(v: number | null) => !v || v >= 10 || $t('salles.dialog.radiusError')]"
          />
        </div>
      </div>
      <q-btn
        flat
        dense
        no-caps
        icon="my_location"
        :label="$t('salles.dialog.useCurrentPosition')"
        @click="positionActuelle"
      />

      <q-toggle v-model="form.actif" :label="$t('salles.dialog.usableToggle')" />
    </dialogue-formulaire>
  </q-page>
</template>

<script setup lang="ts">
import { usePresentationListe } from '@/shared/composables/usePresentationListe';
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
import CartesSalles from '@/features/administration/components/CartesSalles.vue';
import TableauSalles from '@/features/administration/components/TableauSalles.vue';
import { sallesService, type SalleSaisie } from '@/features/administration/services/salles';
import type { Salle, ChipFiltre } from '@/types';
import { ouvrirImpression } from '@/shared/services/impression';

const $q = useQuasar();
const auth = useAuthStore();
const referentiels = useReferentielsStore();
const router = useRouter();
const { t } = useI18n();
const { confirmer, supprimerAvecConfirmation } = useConfirmation();

const modeVue = usePresentationListe();
const dialogOuvert = ref(false);
const salleEditee = ref<Salle | null>(null);
const enregistrement = ref(false);

const page = ref(1);
const pageSize = ref(20);
const filtres = ref<Record<string, any>>({ recherche: '', batiment: null, etat: null, repere: null });

/**
 * L'écran de gestion lit toujours le serveur (jetons QR, salles modifiées
 * ailleurs) et met au passage à jour la liste partagée des référentiels.
 * Toute la liste arrive d'un coup : filtres et pagination restent locaux.
 */
const sal = reactive(
  useListePaginee<Salle>({
    filtres,
    pageSize: 0,
    clesLocales: true,
    syncUrl: true,
    charger: () => referentiels.salles(true).then((data) => ({ data })),
  }),
);
const salles = computed(() => sal.lignes);

/** Créer/modifier/régénérer : ADMIN et SCOLARITE. Supprimer : ADMIN (cf. backend). */
const peutGerer = computed(() => auth.peut('salles.gerer'));
const peutSupprimer = computed(() => auth.peut('salles.supprimer'));

const form = ref({
  code: '',
  nom: '',
  batiment: '',
  capacite: 0,
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
  rayonMetres: 80,
  actif: true,
});

const optionsEtat = computed(() => [
  { label: t('salles.options.stateUsable'), value: 'actif' },
  { label: t('salles.options.stateOutOfService'), value: 'inactif' },
]);
const optionsRepere = computed(() => [
  { label: t('salles.options.withGps'), value: 'avec' },
  { label: t('salles.options.withoutGps'), value: 'sans' },
]);
const optionsBatiments = computed(() =>
  [...new Set(salles.value.map((s) => s.batiment).filter((b): b is string => !!b))].sort(),
);

const sallesFiltrees = computed(() =>
  salles.value.filter((s) => {
    const f = filtres.value;
    if (f.recherche) {
      const q = String(f.recherche).toLowerCase();
      const cible = `${s.code} ${s.nom} ${s.batiment ?? ''}`.toLowerCase();
      if (!cible.includes(q)) return false;
    }
    if (f.batiment && s.batiment !== f.batiment) return false;
    if (f.etat === 'actif' && !s.actif) return false;
    if (f.etat === 'inactif' && s.actif) return false;
    if (f.repere === 'avec' && !s.latitude) return false;
    if (f.repere === 'sans' && s.latitude) return false;
    return true;
  }),
);

/** Le listing est court : on pagine côté page, sans rappeler le serveur. */
const sallesAffichees = computed(() =>
  sallesFiltrees.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
);

const filtresActifs = computed(() =>
  Boolean(filtres.value.recherche || filtres.value.batiment || filtres.value.etat || filtres.value.repere),
);
const messageVide = computed(() =>
  filtresActifs.value ? t('salles.emptyState.noneForCriteria') : t('salles.emptyState.noneRegistered'),
);

const chips = computed(() => {
  const cs: ChipFiltre[] = [];
  if (filtres.value.recherche) {
    cs.push({
      label: t('salles.chips.search', { value: filtres.value.recherche }),
      value: filtres.value.recherche,
      icone: 'search',
      defaut: true,
    });
  }
  if (filtres.value.batiment) {
    cs.push({
      label: t('salles.chips.building', { value: filtres.value.batiment }),
      value: filtres.value.batiment,
      icone: 'apartment',
    });
  }
  if (filtres.value.etat) {
    cs.push({
      label: filtres.value.etat === 'actif' ? t('salles.chips.stateUsable') : t('salles.chips.stateOutOfService'),
      value: filtres.value.etat,
      icone: 'toggle_on',
      cle: 'etat',
    });
  }
  if (filtres.value.repere) {
    cs.push({
      label: filtres.value.repere === 'avec' ? t('salles.chips.withGps') : t('salles.chips.withoutGps'),
      value: filtres.value.repere,
      icone: 'my_location',
      cle: 'repere',
    });
  }
  return cs;
});

function ouvrir(s: Salle | null) {
  salleEditee.value = s;
  form.value = {
    code: s?.code ?? '',
    nom: s?.nom ?? '',
    batiment: s?.batiment ?? '',
    capacite: s?.capacite ?? 0,
    latitude: s?.latitude ?? undefined,
    longitude: s?.longitude ?? undefined,
    rayonMetres: s?.rayonMetres ?? 80,
    actif: s?.actif ?? true,
  };
  dialogOuvert.value = true;
}

/** La salle se lit aussi par ce qui s'y passe : on ouvre son registre. */
function voirSeances(s: Salle) {
  void router.push({ path: '/seances', query: { salleId: s.id } });
}

function positionActuelle() {
  navigator.geolocation?.getCurrentPosition(
    (p) => {
      form.value.latitude = Number(p.coords.latitude.toFixed(6));
      form.value.longitude = Number(p.coords.longitude.toFixed(6));
      $q.notify({ type: 'positive', message: t('salles.messages.positionSet') });
    },
    () => $q.notify({ type: 'negative', message: t('salles.messages.positionUnavailable') }),
  );
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload: SalleSaisie = { ...form.value, batiment: form.value.batiment || undefined };
    if (salleEditee.value) await sallesService.modifier(salleEditee.value.id, payload);
    else await sallesService.creer(payload);
    $q.notify({ type: 'positive', message: t('salles.messages.saved') });
    dialogOuvert.value = false;
    await sal.recharger();
  } catch {
    /* notifié par l'intercepteur */
  } finally {
    enregistrement.value = false;
  }
}

async function regenerer(s: Salle) {
  const ok = await confirmer({
    titre: t('salles.confirmRegenerate.title'),
    message: t('salles.confirmRegenerate.message', { code: s.code }),
    ok: t('salles.confirmRegenerate.confirm'),
  });
  if (!ok) return;
  try {
    await sallesService.regenererQr(s.id);
    $q.notify({ type: 'positive', message: t('salles.messages.regenerated') });
    await sal.recharger();
  } catch {
    /* notifié par l'intercepteur */
  }
}

function supprimer(s: Salle) {
  void supprimerAvecConfirmation(`/salles/${s.id}`, s.code, sal.recharger, {
    titre: t('salles.confirmDelete.title'),
    message: t('salles.confirmDelete.message', { code: s.code, name: s.nom }),
    ok: t('common.actions.delete'),
    succes: t('salles.messages.deleted'),
  });
}

function imprimerQr(salleId?: string) {
  void ouvrirImpression('/impression/qr-salles', { salleId });
}

function reinitialiser() {
  sal.reinitialiser([]);
  page.value = 1;
}

// Un filtre qui vide la page courante doit ramener à la première.
watch(sallesFiltrees, (liste) => {
  const max = Math.max(1, Math.ceil(liste.length / pageSize.value));
  if (page.value > max) page.value = max;
});
</script>

<style scoped lang="scss"></style>
