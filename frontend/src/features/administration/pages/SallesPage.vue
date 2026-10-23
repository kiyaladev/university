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
    <div v-if="modeVue === 'cartes'" class="row q-col-gutter-md">
      <div v-for="s in sallesAffichees" :key="s.id" class="col-12 col-sm-6 col-md-4 col-lg-3">
        <q-card flat bordered class="carte full-height">
          <q-card-section class="row items-start">
            <div class="col">
              <div class="text-h6">{{ s.code }}</div>
              <div class="text-caption text-grey-7">{{ s.nom }}</div>
              <div class="text-caption text-grey-7">{{ s.batiment ?? '—' }}</div>
            </div>
            <q-badge :color="s.actif ? 'positive' : 'grey-7'">
              {{ s.actif ? $t('salles.card.active') : $t('salles.card.inactive') }}
            </q-badge>
          </q-card-section>

          <q-card-section v-if="peutGerer" class="text-center q-pt-none">
            <canvas :ref="(el) => enregistrerCanvas(el, s)" :aria-label="$t('salles.card.qrAria', { code: s.code })" />
            <div class="text-caption text-grey-6 ellipsis">{{ s.qrToken }}</div>
          </q-card-section>

          <q-card-section class="q-pt-none text-caption">
            <div><q-icon name="groups" size="14px" /> {{ s.capacite }} {{ $t('salles.card.capacitySuffix') }}</div>
            <div v-if="s.latitude">
              <q-icon name="my_location" size="14px" />
              {{ s.latitude.toFixed(4) }}, {{ s.longitude?.toFixed(4) }}
              {{ $t('common.units.radius', { n: s.rayonMetres }) }}
            </div>
            <div v-else class="text-grey-6">
              <q-icon name="location_off" size="14px" /> {{ $t('salles.card.noGpsMark') }}
            </div>
          </q-card-section>

          <q-separator />
          <q-card-actions align="right">
            <q-btn
              flat
              dense
              round
              icon="event_note"
              :aria-label="$t('salles.roomActions.viewSessionsAria')"
              @click="voirSeances(s)"
            >
              <q-tooltip>{{ $t('salles.roomActions.viewSessionsTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              round
              icon="print"
              :aria-label="$t('salles.roomActions.printPosterAria')"
              @click="imprimerQr(s.id)"
            >
              <q-tooltip>{{ $t('salles.roomActions.printPosterTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutGerer"
              flat
              dense
              round
              icon="autorenew"
              :aria-label="$t('salles.roomActions.regenerateAria')"
              @click="regenerer(s)"
            >
              <q-tooltip>{{ $t('salles.roomActions.regenerateTooltip') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutGerer"
              flat
              dense
              round
              icon="edit"
              :aria-label="$t('salles.roomActions.editAria')"
              @click="ouvrir(s)"
            >
              <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
            </q-btn>
            <q-btn
              v-if="peutSupprimer"
              flat
              dense
              round
              color="negative"
              icon="delete"
              :aria-label="$t('salles.roomActions.deleteAria')"
              @click="supprimer(s)"
            >
              <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
      <etat-vide
        v-if="!sallesAffichees.length && !sal.chargement"
        class="col-12"
        icone="meeting_room"
        :titre="messageVide"
      >
        <template #action>
          <q-btn
            v-if="peutGerer && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('salles.emptyState.createFirst')"
            @click="ouvrir(null)"
          />
          <q-btn
            v-else-if="filtresActifs"
            flat
            no-caps
            icon="refresh"
            :label="$t('common.actions.reset_filters')"
            @click="reinitialiser"
          />
        </template>
      </etat-vide>
    </div>

    <!-- Vue tableau : pour comparer capacités, bâtiments et repères -->
    <q-table
      v-else
      flat
      bordered
      class="carte"
      :rows="sallesAffichees"
      :columns="colonnes"
      row-key="id"
      :loading="sal.chargement"
      :pagination="{ rowsPerPage: 0 }"
    >
      <template #no-data>
        <etat-vide icone="meeting_room" :titre="messageVide">
          <template #action>
            <q-btn
              v-if="peutGerer && !filtresActifs"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('salles.emptyState.createFirst')"
              @click="ouvrir(null)"
            />
            <q-btn
              v-else-if="filtresActifs"
              flat
              no-caps
              icon="refresh"
              :label="$t('common.actions.reset_filters')"
              @click="reinitialiser"
            />
          </template>
        </etat-vide>
      </template>

      <template #body-cell-etat="p">
        <q-td :props="p">
          <q-badge :color="p.row.actif ? 'positive' : 'grey-7'">
            {{ p.row.actif ? $t('salles.card.active') : $t('salles.card.inactive') }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="event_note"
            :aria-label="$t('salles.roomActions.viewSessionsAria')"
            @click="voirSeances(p.row)"
          >
            <q-tooltip>{{ $t('salles.roomActions.viewSessionsTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="print"
            :aria-label="$t('salles.roomActions.printPosterAria')"
            @click="imprimerQr(p.row.id)"
          >
            <q-tooltip>{{ $t('salles.roomActions.printPosterTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="autorenew"
            :aria-label="$t('salles.roomActions.regenerateAria')"
            @click="regenerer(p.row)"
          >
            <q-tooltip>{{ $t('salles.roomActions.regenerateTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('salles.roomActions.editAria')"
            @click="ouvrir(p.row)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutSupprimer"
            flat
            dense
            round
            color="negative"
            icon="delete"
            :aria-label="$t('salles.roomActions.deleteAria')"
            @click="supprimer(p.row)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

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
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import { api } from '@/boot/axios';
import { useAuthStore } from '@/stores/auth';
import { useReferentielsStore } from '@/stores/referentiels';
import BarreFiltres from '@/shared/components/BarreFiltres.vue';
import BarrePagination from '@/shared/components/BarrePagination.vue';
import EnTetePage from '@/shared/components/EnTetePage.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import DialogueFormulaire from '@/shared/components/DialogueFormulaire.vue';
import { useListePaginee } from '@/shared/composables/useListePaginee';
import { useConfirmation } from '@/shared/composables/useConfirmation';
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

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'code', label: t('common.fields.code'), field: 'code', align: 'left', sortable: true },
  { name: 'nom', label: t('common.fields.name'), field: 'nom', align: 'left', sortable: true },
  { name: 'batiment', label: t('common.fields.building'), field: (r: Salle) => r.batiment || '—', align: 'left' },
  { name: 'capacite', label: t('common.fields.capacity'), field: 'capacite', align: 'right', sortable: true },
  {
    name: 'repere',
    label: t('salles.table.columns.gpsMark'),
    field: (r: Salle) => (r.latitude ? `± ${r.rayonMetres} m` : '—'),
    align: 'left',
  },
  { name: 'qr', label: t('salles.table.columns.qrToken'), field: 'qrToken', align: 'left' },
  { name: 'etat', label: t('common.fields.state'), field: 'actif', align: 'left' },
  { name: 'actions', label: t('common.actions.actions'), field: 'id', align: 'right' },
]);

/** Dessine le QR de la salle dans sa carte. */
const canvasParSalle = new Map<string, HTMLCanvasElement>();

function enregistrerCanvas(el: any, salle: Salle) {
  if (!el) {
    canvasParSalle.delete(salle.id);
    return;
  }
  canvasParSalle.set(salle.id, el as HTMLCanvasElement);
  void QRCode.toCanvas(el as HTMLCanvasElement, salle.qrToken, { width: 132, margin: 1 });
}

function dessinerTousLesQr() {
  for (const salle of sallesAffichees.value) {
    const el = canvasParSalle.get(salle.id);
    if (el) void QRCode.toCanvas(el, salle.qrToken, { width: 132, margin: 1 });
  }
}

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
    const payload = { ...form.value, batiment: form.value.batiment || undefined };
    if (salleEditee.value) await api.put(`/salles/${salleEditee.value.id}`, payload);
    else await api.post('/salles', payload);
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
    await api.post(`/salles/${s.id}/qr`);
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

// Les jetons changent (régénération) ou la page affichée change : on redessine.
watch(
  () => [modeVue.value, sallesAffichees.value.map((s) => `${s.id}:${s.qrToken}`).join('|')],
  () => void nextTick(dessinerTousLesQr),
);
</script>

<style scoped lang="scss"></style>
