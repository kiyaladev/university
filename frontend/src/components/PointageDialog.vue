<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    :maximized="$q.screen.lt.md"
    @update:model-value="fermer"
  >
    <q-card class="fiche" style="width: 660px; max-width: 96vw">
      <header class="bandeau fiche__entete">
        <p class="lettrage fiche__matiere">{{ seance?.affectation?.matiere?.intitule }}</p>
        <p class="fiche__enseignant">{{ enseignantNom }}</p>
        <p class="pochoir fiche__meta chiffres">
          {{ seance?.heureDebut }} – {{ seance?.heureFin }} ·
          {{ seance?.affectation?.promotion?.nom }} ·
          {{ seance?.salle?.code ?? t('pointage.noRoom') }} · {{ seance?.type }}
        </p>
      </header>

      <section class="fiche__section">
        <h3 class="pochoir fiche__legende">{{ t('pointage.finding') }}</h3>
        <div class="constats">
          <button
            v-for="s in statuts"
            :key="s.value"
            type="button"
            class="constat"
            :class="[`constat--${s.champ}`, { 'constat--choisi': form.statut === s.value }]"
            :aria-pressed="form.statut === s.value"
            @click="choisirStatut(s.value)"
          >
            <q-icon :name="s.icone" size="20px" />
            <span class="pochoir">{{ s.label }}</span>
          </button>
        </div>
      </section>

      <q-card-section class="fiche__section q-gutter-md">
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-input
              v-model="form.heureArrivee"
              outlined
              dense
              mask="##:##"
              :label="t('pointage.arrival')"
              :disable="absent"
            >
              <template #append>
                <q-btn flat dense round icon="schedule" :aria-label="t('pointage.now')" @click="form.heureArrivee = maintenantHHmm()">
                  <q-tooltip>{{ t('pointage.now') }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </div>
          <div class="col-6">
            <q-input
              v-model="form.heureFinReelle"
              outlined
              dense
              mask="##:##"
              :label="t('pointage.end')"
              :disable="absent"
            >
              <template #append>
                <q-btn flat dense round icon="schedule" :aria-label="t('pointage.now')" @click="form.heureFinReelle = maintenantHHmm()">
                  <q-tooltip>{{ t('pointage.now') }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </div>
        </div>

        <q-banner v-if="!absent" dense class="note--info">
          <template #avatar><q-icon name="timer" /></template>
          {{ t('pointage.duration') }} <strong>{{ dureeLisible(dureeCalculee) }}</strong>
          <span v-if="ecartRetard > 0"> · {{ t('pointage.late', { n: ecartRetard }) }}</span>
        </q-banner>

        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-input
              v-model.number="form.effectifPresent"
              type="number"
              outlined
              dense
              :label="t('pointage.students')"
              :hint="t('pointage.classSize', { n: seance?.affectation?.promotion?.effectif ?? '—' })"
              :disable="absent"
            />
          </div>
          <div class="col-6">
            <q-select
              v-if="form.statut === 'REMPLACE'"
              v-model="form.enseignantRemplacantId"
              :options="optionsEnseignants"
              outlined
              dense
              emit-value
              map-options
              use-input
              :label="t('pointage.substitute')"
              @filter="filtrerEnseignants"
            />
          </div>
        </div>

        <q-input
          v-model="form.thematiqueTraitee"
          outlined
          dense
          :label="t('pointage.topic')"
          :hint="seance?.thematique ? t('pointage.planned', { topic: seance.thematique }) : ''"
          :disable="absent"
        />

        <!-- Les observations restent facultatives ; les constats et leur envoi
             conservent le comportement métier du pointage existant. -->
        <q-expansion-item :label="t('pointage.addObservation')" :default-opened="!!form.observation">
        <q-input
          v-model="form.observation"
          outlined
          dense
          type="textarea"
          rows="2"
          :label="t('pointage.observation')"
        />
        </q-expansion-item>

        <!-- L'enseignant atteste lui-même sa présence : c'est la pièce
             maîtresse du contrôle, elle reste dépliée. -->
        <attestation-enseignant
          v-if="!absent"
          :model-value="form"
          :seance="seance"
          @update:model-value="(v) => Object.assign(form, v)"
        />

        <q-expansion-item
          icon="verified_user"
          :label="t('pointage.proofs')"
          :caption="resumePreuves"
        >
          <div class="q-pt-md q-gutter-md">
            <qr-scanner v-model="form.qrToken" />

            <div class="row items-center q-col-gutter-sm">
              <div class="col">
                <q-btn
                  outline
                  color="secondary"
                  icon="my_location"
                  no-caps
                  :loading="geolocEnCours"
                  :label="t('pointage.location')"
                  @click="capterPosition"
                />
              </div>
              <div class="col text-caption">
                <span v-if="form.latitude">
                  {{ form.latitude.toFixed(5) }}, {{ form.longitude?.toFixed(5) }}
                </span>
                <span v-else class="text-grey-6">{{ t('pointage.noLocation') }}</span>
              </div>
            </div>
          </div>
        </q-expansion-item>
      </q-card-section>

      <footer class="fiche__pied">
        <p v-if="attestationManquante" class="pochoir--brut fiche__blocage">
          <q-icon name="info" size="18px" />
          <span v-if="seance?.controle">
            {{ t('pointage.correctionProof') }}
          </span>
          <span v-else>
            {{ t('pointage.initialProof') }}
          </span>
        </p>
        <div class="fiche__actions">
          <q-btn flat no-caps :label="t('pointage.cancel')" @click="fermer(false)" />
          <q-btn
            unelevated
            color="primary"
            no-caps
            icon="how_to_reg"
            class="fiche__valider"
            :disable="attestationManquante"
            :label="t(seance?.controle ? 'pointage.correct' : 'pointage.validate')"
            :loading="enregistrement"
            @click="enregistrer"
          />
        </div>
      </footer>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { api } from '../boot/axios';
import { useReferentielsStore } from '../stores/referentiels';
import { usePointagesStore } from '../stores/pointages';
import { dureeLisible, maintenantHHmm, LIBELLE_STATUT_PRESENCE } from '../utils/libelles';
import type { Enseignant, Pointage, Seance, StatutPresence } from '../types';
import QrScanner from './QrScanner.vue';
import AttestationEnseignant from './AttestationEnseignant.vue';

const props = defineProps<{ modelValue: boolean; seance: Seance | null }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; enregistre: [] }>();

const $q = useQuasar();
const referentiels = useReferentielsStore();
const { t } = useI18n();
const pointages = usePointagesStore();

const statuts = computed(() => [
  { value: 'PRESENT', icone: 'check_circle', champ: 'present' },
  { value: 'RETARD', icone: 'schedule', champ: 'retard' },
  { value: 'ABSENT', icone: 'cancel', champ: 'absent' },
  { value: 'REMPLACE', icone: 'swap_horiz', champ: 'remplace' },
  { value: 'DEPART_ANTICIPE', icone: 'logout', champ: 'depart' },
].map(statut => ({ ...statut, label: LIBELLE_STATUT_PRESENCE[statut.value] })));

const vide = (): Pointage & { statut: StatutPresence } => ({
  seanceId: '',
  statut: 'PRESENT',
  heureArrivee: '',
  heureFinReelle: '',
  effectifPresent: undefined,
  thematiqueTraitee: '',
  observation: '',
  qrToken: '',
  latitude: undefined,
  longitude: undefined,
  enseignantRemplacantId: undefined,
  // attestation de l'enseignant
  signatureBase64: undefined,
  codePinEnseignant: undefined,
  empreinte: undefined,
});

const form = ref(vide());
const enregistrement = ref(false);
const geolocEnCours = ref(false);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const attestationObligatoire = ref(true);

const absent = computed(() => form.value.statut === 'ABSENT');

const enseignantNom = computed(() => {
  const e = props.seance?.affectation?.enseignant;
  return e ? `${e.nom} ${e.prenom}` : '';
});

const minutes = (h?: string) =>
  h && /^\d{2}:\d{2}$/.test(h) ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null;

const dureeCalculee = computed(() => {
  const d = minutes(form.value.heureArrivee);
  const f = minutes(form.value.heureFinReelle);
  if (d !== null && f !== null && f > d) return f - d;
  const dp = minutes(props.seance?.heureDebut);
  const fp = minutes(props.seance?.heureFin);
  return dp !== null && fp !== null ? fp - dp : 0;
});

const ecartRetard = computed(() => {
  const prevu = minutes(props.seance?.heureDebut);
  const reel = minutes(form.value.heureArrivee);
  return prevu !== null && reel !== null ? reel - prevu : 0;
});

const resumePreuves = computed(() => {
  const p: string[] = [];
  if (form.value.qrToken) p.push(t('pointage.roomQr'));
  if (form.value.latitude) p.push(t('pointage.gps'));
  return p.length ? p.join(' · ') : t('pointage.noProof');
});

/** Une attestation est fournie dès qu'un des quatre moyens est renseigné. */
const attestationFournie = computed(
  () =>
    !!form.value.empreinte ||
    !!form.value.codePinEnseignant ||
    !!form.value.signatureBase64,
);

const attestationManquante = computed(
  () => attestationObligatoire.value && !absent.value && !attestationFournie.value,
);

/** Pré-remplit le formulaire à l'ouverture (ou reprend le contrôle existant). */
/** Heure proposée par défaut : l'heure courante si le contrôle se fait pendant
 *  la séance, sinon l'heure de début prévue (saisie a posteriori). */
function heureArriveeProposee(): string {
  const maintenant = maintenantHHmm();
  const debut = props.seance?.heureDebut ?? '';
  const fin = props.seance?.heureFin ?? '';
  return maintenant >= debut && maintenant <= fin ? maintenant : debut;
}

watch(
  () => [props.modelValue, props.seance?.id],
  async ([ouvert]) => {
    if (!ouvert || !props.seance) return;

    // Règle de l'établissement : l'attestation peut être exigée ou facultative.
    try {
      const { data } = await api.get('/parametres/pointage');
      attestationObligatoire.value =
        data.find((p: any) => p.cle === 'ATTESTATION_OBLIGATOIRE')?.valeur !== 'false';
    } catch {
      attestationObligatoire.value = true;
    }
    const c = props.seance.controle;
    form.value = {
      ...vide(),
      seanceId: props.seance.id,
      statut: (c?.statut as StatutPresence) ?? 'PRESENT',
      heureArrivee: c?.heureArrivee ?? heureArriveeProposee(),
      heureFinReelle: c?.heureFinReelle ?? props.seance.heureFin,
      effectifPresent: c?.effectifPresent ?? undefined,
      thematiqueTraitee: c?.thematiqueTraitee ?? props.seance.thematique ?? '',
      observation: c?.observation ?? '',
      // Une correction exige une nouvelle attestation, pas la réutilisation de la preuve précédente.
      signatureBase64: undefined,
      enseignantRemplacantId: c?.enseignantRemplacant?.id,
    };
  },
  { immediate: true },
);

function choisirStatut(statut: string) {
  form.value.statut = statut as StatutPresence;
  if (statut === 'ABSENT') {
    form.value.heureArrivee = '';
    form.value.heureFinReelle = '';
    form.value.effectifPresent = undefined;
  } else if (!form.value.heureArrivee) {
    form.value.heureArrivee = maintenantHHmm();
  }
}

function capterPosition() {
  if (!navigator.geolocation) {
    $q.notify({ type: 'warning', message: t('pointage.gpsUnavailable') });
    return;
  }
  geolocEnCours.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.value.latitude = pos.coords.latitude;
      form.value.longitude = pos.coords.longitude;
      geolocEnCours.value = false;
      $q.notify({ type: 'positive', message: t('pointage.gpsSaved'), icon: 'my_location' });
    },
    () => {
      geolocEnCours.value = false;
      $q.notify({ type: 'negative', message: t('pointage.gpsDenied') });
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

async function filtrerEnseignants(saisie: string, maj: (fn: () => void) => void) {
  if (!enseignants.value.length) {
    enseignants.value = await referentiels.enseignants();
  }
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEnseignants.value = enseignants.value
      .filter((e) => `${e.nom} ${e.prenom}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom} (${e.matricule})`, value: e.id }));
  });
}

async function enregistrer() {
  enregistrement.value = true;
  try {
    const payload: Pointage = {
      ...form.value,
      heureArrivee: form.value.heureArrivee || undefined,
      heureFinReelle: form.value.heureFinReelle || undefined,
      thematiqueTraitee: form.value.thematiqueTraitee || undefined,
      observation: form.value.observation || undefined,
      qrToken: form.value.qrToken || undefined,
    };
    const enligne = await pointages.envoyer(payload);
    if (enligne) {
      $q.notify({ type: 'positive', message: t('pointage.saved'), icon: 'how_to_reg' });
    }
    emit('enregistre');
    fermer(false);
  } catch (e: any) {
    // Requête silencieuse : l'erreur métier (4xx) relancée par le store, ou
    // l'échec local de mise en file, n'est notifiée qu'ici.
    const motif = e?.response?.data?.message;
    $q.notify({
      type: 'negative',
      message: (Array.isArray(motif) ? motif.join(' · ') : motif) ?? e?.message ?? t('pointage.saveFailed'),
    });
  } finally {
    enregistrement.value = false;
  }
}

function fermer(v: boolean) {
  emit('update:modelValue', v);
}
</script>

<style scoped lang="scss">
.fiche {
  display: flex;
  flex-direction: column;
}

.fiche__entete {
  padding: var(--up-4) var(--up-3);
}

.fiche__matiere {
  font-size: 1.4rem;
  color: var(--up-encre);
  margin: 0;
}

.fiche__enseignant {
  margin: 4px 0 0;
  font-weight: 600;
  color: var(--up-encre);
}

.fiche__meta {
  margin: 6px 0 0;
  color: var(--up-encre-douce);
}

.fiche__section {
  padding: var(--up-3);
  border-bottom: var(--up-filet);
}

.fiche__legende {
  color: var(--up-encre-douce);
  margin: 0 0 var(--up-2);
}

// Constats : cinq champs peints, un seul reste allumé.
// Cinq constats, deux rangées pleines : trois puis deux, sans case orpheline.
.constats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1px;
  background: #{$gris-filet};
  border: var(--up-filet);
  border-radius: var(--up-rayon);
  overflow: hidden;
}

.constat {
  grid-column: span 2;

  &:nth-child(4),
  &:nth-child(5) { grid-column: span 3; }
}

.constat {
  appearance: none;
  border: 0;
  background: var(--up-plaque);
  color: var(--up-encre);
  min-height: 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  font: inherit;
  transition: background var(--up-transition), color var(--up-transition);

  &:focus-visible { outline: 2px solid #{$vert-action}; outline-offset: -5px; }

  &--choisi {
    color: var(--up-encre);
    background-image: repeating-linear-gradient(
      92deg,
      rgba(255, 255, 255, 0.06) 0 2px,
      rgba(255, 255, 255, 0) 2px 5px
    );
  }

  &--present.constat--choisi { background-color: $vert; }
  &--retard.constat--choisi { background-color: $jaune; color: $encre; }
  &--absent.constat--choisi { background-color: $rouge; }
  &--remplace.constat--choisi,
  &--depart.constat--choisi { background-color: $vert-clair; }
}

.fiche__pied {
  padding: var(--up-3);
  background: var(--up-plaque);
  position: sticky;
  bottom: 0;
  border-top: var(--up-filet);
}

.fiche__blocage {
  color: $rouge;
  font-weight: 600;
  font-size: 0.84rem;
  line-height: 1.4;
  margin: 0 0 var(--up-2);
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.fiche__actions {
  display: flex;
  gap: var(--up-2);
  justify-content: flex-end;
}

.fiche__valider { min-height: 52px; padding-inline: var(--up-4); }

@media (max-width: 599px) {
  .fiche__actions { flex-direction: column-reverse; }
  .fiche__valider { width: 100%; }
}
</style>
