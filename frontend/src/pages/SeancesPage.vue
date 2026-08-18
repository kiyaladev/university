<template>
  <q-page class="registre">
    <header class="registre__entete">
      <div>
        <h1 class="page-titre">Séances</h1>
        <p class="page-sous-titre">
          Le registre des séances programmées et de ce qui y a été constaté
        </p>
      </div>

      <div class="registre__actions">
        <q-btn
          v-if="auth.peutPlanifier"
          outline
          no-caps
          icon="auto_awesome_motion"
          label="Générer depuis l’emploi du temps"
          @click="dialogGeneration = true"
        />
        <q-btn
          v-if="auth.peutPointer || auth.peutPlanifier"
          unelevated
          color="primary"
          no-caps
          icon="add_box"
          :label="auth.peutPointer ? 'Séance non programmée' : 'Séance ponctuelle'"
          @click="ouvrirSeance(null)"
        />
        <q-btn outline no-caps icon="print" label="Imprimer" @click="imprimer" />
      </div>
    </header>

    <!-- Période : les trois lectures courantes en un geste -->
    <div class="registre__periode">
      <div class="registre__raccourcis">
        <button
          v-for="r in raccourcis"
          :key="r.label"
          type="button"
          class="pochoir raccourci"
          :class="{ 'raccourci--actif': raccourciActif === r.label }"
          @click="appliquer(r)"
        >
          {{ r.label }}
        </button>
      </div>

      <champ-date v-model="filtres.dateDebut" label="Du" style="width: 148px" />
      <champ-date v-model="filtres.dateFin" label="Au" style="width: 148px" />

      <q-btn
        flat
        dense
        no-caps
        :icon="filtresOuverts ? 'expand_less' : 'tune'"
        :label="etiquetteFiltres"
        @click="filtresOuverts = !filtresOuverts"
      />
      <bascule-vue v-model="vue" />
      <q-btn
        round
        color="primary"
        icon="refresh"
        aria-label="Recharger le registre"
        :loading="chargement"
        @click="charger"
      >
        <q-tooltip>Recharger</q-tooltip>
      </q-btn>
    </div>

    <div v-if="filtresOuverts" class="registre__filtres">
      <q-input v-model="recherche" outlined dense clearable label="Rechercher">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <q-select
        v-model="filtres.enseignantId"
        :options="optionsEnseignants"
        outlined
        dense
        clearable
        emit-value
        map-options
        use-input
        label="Enseignant"
        @filter="filtrerEnseignants"
      />
      <q-select
        v-model="filtres.salleId"
        :options="optionsSalles"
        outlined
        dense
        clearable
        emit-value
        map-options
        label="Salle"
      />
      <q-select
        v-model="filtres.statut"
        :options="optionsStatuts"
        outlined
        dense
        clearable
        emit-value
        map-options
        label="État de la séance"
      />
      <q-toggle v-model="seulementAPointer" label="Uniquement les séances non contrôlées" />
    </div>

    <!-- Relevé de la période affichée -->
    <section class="plaque registre__releve">
      <div class="registre__releve-cellule">
        <p class="pochoir">Séances</p>
        <p class="lettrage chiffres registre__releve-valeur">{{ seancesFiltrees.length }}</p>
      </div>
      <div class="registre__releve-cellule">
        <p class="pochoir">Contrôlées</p>
        <p class="lettrage chiffres registre__releve-valeur text-positive">{{ compte.controlees }}</p>
      </div>
      <div class="registre__releve-cellule">
        <p class="pochoir">Absences</p>
        <p class="lettrage chiffres registre__releve-valeur text-negative">{{ compte.absences }}</p>
      </div>
      <div class="registre__releve-cellule">
        <p class="pochoir">Sans contrôle</p>
        <p class="lettrage chiffres registre__releve-valeur">{{ compte.sansControle }}</p>
      </div>
    </section>

    <q-inner-loading :showing="chargement" />

    <div v-if="!chargement && !seancesFiltrees.length" class="registre__vide">
      <q-icon name="event_busy" size="42px" />
      <span class="lettrage registre__vide-titre">Aucune séance</span>
      <span class="pochoir">
        {{
          filtresActifs
            ? 'Aucune séance ne correspond aux filtres posés sur cette période.'
            : 'Aucune séance n’est programmée sur cette période.'
        }}
      </span>
      <div class="registre__vide-actions">
        <q-btn
          v-if="filtresActifs"
          outline
          no-caps
          icon="filter_alt_off"
          label="Retirer les filtres"
          @click="reinitialiserFiltres"
        />
        <q-btn
          v-else
          outline
          no-caps
          icon="date_range"
          label="Élargir à 30 jours"
          @click="elargirA30Jours"
        />
        <q-btn
          v-if="auth.peutPlanifier"
          unelevated
          color="primary"
          no-caps
          icon="auto_awesome_motion"
          label="Générer depuis l’emploi du temps"
          @click="dialogGeneration = true"
        />
      </div>
    </div>

    <!-- Vue tableau : pour comparer et trier, quand la lecture par jour ne
         suffit plus (recherche d'une salle, d'un enseignant, tri par état). -->
    <q-table
      v-if="vue === 'tableau' && seancesFiltrees.length"
      flat
      bordered
      class="carte registre__tableau"
      :rows="seancesFiltrees"
      :columns="colonnes"
      row-key="id"
      :loading="chargement"
      :pagination="{ rowsPerPage: 50 }"
      :visible-columns="colonnesVisibles"
      :dense="$q.screen.lt.md"
      @row-click="(_, ligne) => $q.screen.lt.md && (detail = ligne)"
    >
      <template #body-cell-etat="p">
        <q-td :props="p">
          <champ-statut :statut="p.row.controle?.statut ?? 'NON_CONTROLE'" />
        </q-td>
      </template>

      <template #body-cell-actions="p">
        <q-td :props="p" class="text-right">
          <q-btn
            flat
            dense
            round
            icon="visibility"
            aria-label="Voir le détail de la séance"
            @click="detail = p.row"
          >
            <q-tooltip>Détail</q-tooltip>
          </q-btn>
          <q-btn
            v-if="auth.peutPointer && p.row.statut !== 'ANNULEE'"
            dense
            unelevated
            no-caps
            color="primary"
            :icon="p.row.controle ? 'edit' : 'how_to_reg'"
            :label="p.row.controle ? 'Corriger' : 'Pointer'"
            @click="ouvrirPointage(p.row)"
          />
        </q-td>
      </template>
    </q-table>

    <!-- Une journée, un bloc : le registre se lit par jour, pas ligne à ligne -->
    <section v-for="jour in (vue === 'cartes' ? journees : [])" :key="jour.date" class="journee">
      <header class="journee__tete">
        <h2 class="lettrage journee__date">{{ jour.libelle }}</h2>
        <span class="pochoir pochoir--brut journee__compte chiffres">
          {{ jour.seances.length }} séance{{ jour.seances.length > 1 ? 's' : '' }} ·
          {{ jour.controlees }} contrôlée{{ jour.controlees > 1 ? 's' : '' }}
        </span>
      </header>

      <ol class="journee__liste">
        <li v-for="s in jour.seances" :key="s.id">
          <article class="plaque ligne" :class="{ 'ligne--annulee': s.statut === 'ANNULEE' }">
            <div class="champ ligne__heure">
              <span class="lettrage chiffres">{{ s.heureDebut }}</span>
              <span class="pochoir chiffres">{{ s.heureFin }}</span>
            </div>

            <div class="ligne__corps">
              <h3 class="lettrage ligne__enseignant">
                {{ s.affectation?.enseignant?.nom }} {{ s.affectation?.enseignant?.prenom }}
              </h3>
              <p class="ligne__matiere">
                {{ s.affectation?.matiere?.intitule }}
                <span class="pochoir ligne__type" :title="LIBELLE_TYPE_COURS[s.type]">{{ s.type }}</span>
              </p>
              <p class="pochoir ligne__lieu">
                {{ s.affectation?.promotion?.nom }}
                <span v-if="s.salle" class="plaque-salle">{{ s.salle.code }}</span>
              </p>
              <p v-if="s.controle" class="pochoir pochoir--brut ligne__constat chiffres">
                {{ s.controle.heureArrivee ?? '—' }} → {{ s.controle.heureFinReelle ?? '—' }}
                · {{ dureeLisible(s.controle.dureeMinutes) }}
                <span v-if="s.controle.effectifPresent"> · {{ s.controle.effectifPresent }} étud.</span>
                · {{ s.controle.controleur?.prenom }} {{ s.controle.controleur?.nom }}
              </p>
            </div>

            <div class="ligne__etat">
              <champ-statut :statut="s.controle?.statut ?? 'NON_CONTROLE'" />
              <q-badge v-if="s.statut === 'ANNULEE'" color="grey-7" class="q-mt-xs">annulée</q-badge>

              <div class="ligne__boutons">
                <q-btn
                  flat
                  dense
                  round
                  icon="visibility"
                  aria-label="Voir le détail de la séance"
                  @click="detail = s"
                >
                  <q-tooltip>Détail</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="auth.peutPointer && s.statut !== 'ANNULEE'"
                  dense
                  unelevated
                  no-caps
                  color="primary"
                  :icon="s.controle ? 'edit' : 'how_to_reg'"
                  :label="s.controle ? 'Corriger' : 'Pointer'"
                  @click="ouvrirPointage(s)"
                />
                <q-btn
                  v-if="auth.peutPlanifier && !s.controle && s.statut !== 'ANNULEE'"
                  flat
                  dense
                  round
                  color="negative"
                  icon="event_busy"
                  aria-label="Annuler la séance"
                  @click="annuler(s)"
                >
                  <q-tooltip>Annuler la séance</q-tooltip>
                </q-btn>
              </div>
            </div>
          </article>
        </li>
      </ol>
    </section>

    <seance-dialog
      v-model="dialogSeance"
      :seance="seanceEditee"
      :salles="salles"
      @enregistre="apresCreation"
    />
    <generation-dialog v-model="dialogGeneration" @genere="charger" />
    <pointage-dialog v-model="dialogPointage" :seance="seanceSelectionnee" @enregistre="charger" />

    <!-- Détail du contrôle consigné -->
    <q-dialog :model-value="!!detail" @update:model-value="detail = null">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section class="text-h6">Détail de la séance</q-card-section>
        <q-card-section v-if="detail">
          <!-- Fiche à deux colonnes : le libellé tient sa colonne, la valeur la
               sienne. En dessous de 600 px les deux se superposent proprement
               au lieu de se marcher dessus. -->
          <dl class="fiche-detail">
            <dt class="pochoir">Enseignant</dt>
            <dd>
              {{ detail.affectation?.enseignant?.nom }} {{ detail.affectation?.enseignant?.prenom }}
            </dd>

            <dt class="pochoir">Matière · promotion</dt>
            <dd>
              {{ detail.affectation?.matiere?.intitule }} — {{ detail.affectation?.promotion?.nom }}
            </dd>

            <dt class="pochoir">Type de cours</dt>
            <dd>{{ LIBELLE_TYPE_COURS[detail.type] ?? detail.type }}</dd>

            <dt class="pochoir">Horaire prévu</dt>
            <dd class="chiffres">{{ detail.heureDebut }} – {{ detail.heureFin }}</dd>

            <dt class="pochoir">Salle</dt>
            <dd>
              <span v-if="detail.salle" class="plaque-salle">{{ detail.salle.code }}</span>
              <span v-else>—</span>
            </dd>

            <template v-if="detail.justificatif">
              <dt class="pochoir">Justificatif d’absence</dt>
              <dd>
                {{ LIBELLE_STATUT_JUSTIFICATIF[detail.justificatif.statut] ?? detail.justificatif.statut }}
                <q-btn
                  flat
                  dense
                  no-caps
                  size="sm"
                  icon="open_in_new"
                  label="Ouvrir le dossier"
                  :to="{ name: 'justificatifs', query: { statut: detail.justificatif.statut } }"
                />
              </dd>
            </template>

            <template v-if="detail.controle">
              <dt class="pochoir fiche-detail__coupure">Constat</dt>
              <dd class="fiche-detail__coupure">
                <champ-statut :statut="detail.controle.statut" dense />
              </dd>

              <dt class="pochoir">Déroulement réel</dt>
              <dd class="chiffres">
                {{ detail.controle.heureArrivee ?? '—' }} → {{ detail.controle.heureFinReelle ?? '—' }}
                ({{ dureeLisible(detail.controle.dureeMinutes) }})
              </dd>

              <dt class="pochoir">Étudiants présents</dt>
              <dd class="chiffres">{{ detail.controle.effectifPresent ?? '—' }}</dd>

              <dt class="pochoir">Thème déroulé</dt>
              <dd>{{ detail.controle.thematiqueTraitee ?? '—' }}</dd>

              <dt class="pochoir">Observation</dt>
              <dd>{{ detail.controle.observation ?? '—' }}</dd>

              <dt class="pochoir">Contrôlé par</dt>
              <dd>
                {{ detail.controle.controleur?.prenom }} {{ detail.controle.controleur?.nom }}
                · <span class="chiffres">{{ dateHeureLisible(detail.controle.horodatage) }}</span>
              </dd>

              <dt class="pochoir">Attestation</dt>
              <dd>
                {{ LIBELLE_ATTESTATION[detail.controle.attestation ?? 'AUCUNE'] }}
                <span v-if="detail.controle.empreinteScore" class="chiffres">
                  ({{ detail.controle.empreinteScore }}/100)
                </span>
              </dd>

              <template v-if="detail.controle.signatureBase64">
                <dt class="pochoir">Signature</dt>
                <dd><img :src="detail.controle.signatureBase64" class="signature-detail" /></dd>
              </template>
            </template>
          </dl>
        </q-card-section>
        <!-- Depuis une séance, on rejoint les deux lectures voisines : tout ce
             que cet enseignant a fait, et tout ce qui s'est tenu dans cette salle. -->
        <q-card-actions align="left" class="fiche-detail__liens">
          <q-btn
            v-if="detail?.affectation?.enseignantId"
            flat
            dense
            no-caps
            icon="person_pin"
            label="Ses autres séances"
            @click="filtrerDepuisDetail('enseignantId', detail.affectation.enseignantId)"
          />
          <q-btn
            v-if="detail?.salle"
            flat
            dense
            no-caps
            icon="meeting_room"
            :label="`Séances en ${detail.salle.code}`"
            @click="filtrerDepuisDetail('salleId', detail.salle.id)"
          />
        </q-card-actions>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Fermer" v-close-popup />
          <q-btn
            v-if="auth.peutPointer && detail && detail.statut !== 'ANNULEE'"
            unelevated
            color="primary"
            no-caps
            :label="detail?.controle ? 'Corriger le pointage' : 'Pointer cette séance'"
            @click="depuisDetail()"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar, type QTableColumn } from 'quasar';
import { api, API_URL } from '../boot/axios';
import { useAuthStore } from '../stores/auth';
import SeanceDialog from '../components/SeanceDialog.vue';
import GenerationDialog from '../components/GenerationDialog.vue';
import PointageDialog from '../components/PointageDialog.vue';
import ChampStatut from '../components/ChampStatut.vue';
import ChampDate from '../components/ChampDate.vue';
import BasculeVue from '../components/BasculeVue.vue';
import { useVuePreferee } from '../composables/vuePreferee';
import {
  LIBELLE_ATTESTATION,
  LIBELLE_STATUT_JUSTIFICATIF,
  LIBELLE_STATUT_SEANCE,
  LIBELLE_TYPE_COURS,
  aujourdhui,
  dateHeureLisible,
  dateLisible,
  decalerJours,
  dureeLisible,
} from '../utils/libelles';
import type { Enseignant, Salle, Seance } from '../types';

const $q = useQuasar();
const route = useRoute();
const auth = useAuthStore();
const vue = useVuePreferee('seances');

/** Les mêmes séances, mises en colonnes : c'est la vue qui compare et qui trie. */
const colonnes: QTableColumn[] = [
  {
    name: 'date',
    label: 'Date',
    field: (r: Seance) => r.date,
    format: (v: string) => dateLisible(v),
    align: 'left',
    sortable: true,
  },
  {
    name: 'heure',
    label: 'Horaire',
    field: (r: Seance) => `${r.heureDebut}–${r.heureFin}`,
    align: 'left',
    sortable: true,
  },
  {
    name: 'enseignant',
    label: 'Enseignant',
    field: (r: Seance) =>
      `${r.affectation?.enseignant?.nom ?? ''} ${r.affectation?.enseignant?.prenom ?? ''}`.trim(),
    align: 'left',
    sortable: true,
  },
  {
    name: 'matiere',
    label: 'Matière',
    field: (r: Seance) => r.affectation?.matiere?.intitule ?? '—',
    align: 'left',
    sortable: true,
  },
  {
    name: 'promotion',
    label: 'Promotion',
    field: (r: Seance) => r.affectation?.promotion?.nom ?? '—',
    align: 'left',
  },
  { name: 'salle', label: 'Salle', field: (r: Seance) => r.salle?.code ?? '—', align: 'left' },
  { name: 'type', label: 'Type', field: 'type', align: 'left' },
  {
    name: 'duree',
    label: 'Durée constatée',
    field: (r: Seance) => (r.controle ? dureeLisible(r.controle.dureeMinutes) : '—'),
    align: 'right',
  },
  { name: 'etat', label: 'État', field: (r: Seance) => r.controle?.statut ?? '', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

// Sur téléphone le tableau reste consultable : trois colonnes tiennent dans
// 390 px sans déborder, et la ligne entière ouvre le détail — d'où l'on peut
// pointer. Garder la colonne d'actions poussait l'état hors de l'écran.
const colonnesVisibles = computed(() =>
  $q.screen.lt.md
    ? ['heure', 'enseignant', 'etat']
    : colonnes.map((c) => String(c.name)),
);

const seances = ref<Seance[]>([]);
const salles = ref<Salle[]>([]);
const enseignants = ref<Enseignant[]>([]);
const optionsEnseignants = ref<{ label: string; value: string }[]>([]);
const chargement = ref(false);
const recherche = ref('');
const filtresOuverts = ref(false);
const seulementAPointer = ref(false);
const detail = ref<Seance | null>(null);
const dialogSeance = ref(false);
const dialogGeneration = ref(false);
const dialogPointage = ref(false);
const seanceEditee = ref<Seance | null>(null);
const seanceSelectionnee = ref<Seance | null>(null);
const raccourciActif = ref('7 jours');

const filtres = ref({
  dateDebut: decalerJours(aujourdhui(), -6),
  dateFin: aujourdhui(),
  enseignantId: null as string | null,
  statut: null as string | null,
  salleId: null as string | null,
});

const raccourcis = [
  { label: "Aujourd'hui", debut: 0, fin: 0 },
  { label: '7 jours', debut: -6, fin: 0 },
  { label: '30 jours', debut: -29, fin: 0 },
  { label: 'À venir', debut: 1, fin: 14 },
];

/** Les états de séance viennent du référentiel partagé, jamais d'une liste locale. */
const optionsStatuts = Object.entries(LIBELLE_STATUT_SEANCE).map(([value, label]) => ({
  label,
  value,
}));

const optionsSalles = computed(() =>
  salles.value.map((s) => ({ label: `${s.code} — ${s.nom}`, value: s.id })),
);

const etiquetteFiltres = computed(() => {
  const actifs = [
    filtres.value.enseignantId && 'enseignant',
    filtres.value.salleId && 'salle',
    filtres.value.statut && 'état',
    recherche.value && 'recherche',
    seulementAPointer.value && 'non contrôlées',
  ].filter(Boolean);
  return actifs.length ? `Filtres : ${actifs.join(', ')}` : 'Filtrer';
});

const filtresActifs = computed(
  () =>
    !!filtres.value.enseignantId ||
    !!filtres.value.salleId ||
    !!filtres.value.statut ||
    !!recherche.value ||
    seulementAPointer.value,
);

/** Le vide le plus courant vient d'une fenêtre trop courte : on l'élargit. */
function elargirA30Jours() {
  const trente = raccourcis.find((r) => r.label === '30 jours');
  if (trente) appliquer(trente);
}

function reinitialiserFiltres() {
  recherche.value = '';
  seulementAPointer.value = false;
  filtres.value = { ...filtres.value, enseignantId: null, salleId: null, statut: null };
}

const seancesFiltrees = computed(() => {
  const q = (recherche.value ?? '').toLowerCase();
  return seances.value.filter((s) => {
    if (seulementAPointer.value && s.controle) return false;
    if (!q) return true;
    return [
      s.affectation?.enseignant?.nom,
      s.affectation?.enseignant?.prenom,
      s.affectation?.matiere?.intitule,
      s.affectation?.promotion?.nom,
      s.salle?.code,
      s.thematique,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
});

const compte = computed(() => {
  const tenues = seancesFiltrees.value.filter((s) => s.statut !== 'ANNULEE');
  return {
    controlees: tenues.filter((s) => s.controle).length,
    absences: tenues.filter((s) => s.controle?.statut === 'ABSENT').length,
    sansControle: tenues.filter((s) => !s.controle).length,
  };
});

/** Le registre se lit par journée : une en-tête, puis ses séances à l'heure. */
const journees = computed(() => {
  const groupes = new Map<string, Seance[]>();
  for (const s of seancesFiltrees.value) {
    const jour = s.date.slice(0, 10);
    if (!groupes.has(jour)) groupes.set(jour, []);
    groupes.get(jour)!.push(s);
  }

  return [...groupes.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, liste]) => ({
      date,
      libelle: new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      controlees: liste.filter((s) => s.controle).length,
      seances: [...liste].sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)),
    }));
});

function appliquer(r: (typeof raccourcis)[number]) {
  raccourciActif.value = r.label;
  filtres.value = {
    ...filtres.value,
    dateDebut: decalerJours(aujourdhui(), r.debut),
    dateFin: decalerJours(aujourdhui(), r.fin),
  };
}

function ouvrirSeance(s: Seance | null) {
  seanceEditee.value = s;
  dialogSeance.value = true;
}

function ouvrirPointage(s: Seance) {
  seanceSelectionnee.value = s;
  dialogPointage.value = true;
}

/** Rebondir depuis une séance vers la même lecture, élargie à un enseignant
 *  ou à une salle : la fiche se ferme, le registre se recadre. */
function filtrerDepuisDetail(cle: 'enseignantId' | 'salleId', valeur: string) {
  detail.value = null;
  filtresOuverts.value = true;
  filtres.value = { ...filtres.value, [cle]: valeur };
}

function depuisDetail() {
  const s = detail.value;
  detail.value = null;
  if (s) ouvrirPointage(s);
}

/** Une séance ouverte à la main enchaîne sur son pointage. */
async function apresCreation(creee: Seance) {
  await charger();
  const complete = seances.value.find((s) => s.id === creee?.id);
  if (complete) ouvrirPointage(complete);
}

function annuler(s: Seance) {
  $q.dialog({
    title: 'Annuler la séance',
    message:
      `Séance du ${dateLisible(s.date)} à ${s.heureDebut}. ` +
      'Motif de l’annulation (grève, jour férié, indisponibilité…)',
    prompt: { model: '', type: 'text' },
    ok: { label: 'Annuler la séance', color: 'negative', unelevated: true, noCaps: true },
    cancel: { label: 'Ne rien faire', flat: true, noCaps: true },
  }).onOk(async (motif: string) => {
    await api.post(`/seances/${s.id}/annuler`, { motif });
    $q.notify({ type: 'positive', message: 'Séance annulée' });
    await charger();
  });
}

function imprimer() {
  window.open(
    `${API_URL}/impression/registre?dateDebut=${filtres.value.dateDebut}` +
      `&dateFin=${filtres.value.dateFin}&token=${auth.token}`,
    '_blank',
  );
}

function filtrerEnseignants(saisie: string, maj: (fn: () => void) => void) {
  maj(() => {
    const q = saisie.toLowerCase();
    optionsEnseignants.value = enseignants.value
      .filter((e) => `${e.nom} ${e.prenom}`.toLowerCase().includes(q))
      .map((e) => ({ label: `${e.nom} ${e.prenom}`, value: e.id }));
  });
}

async function charger() {
  chargement.value = true;
  try {
    const { data } = await api.get('/seances', {
      params: {
        dateDebut: filtres.value.dateDebut,
        dateFin: filtres.value.dateFin,
        enseignantId: filtres.value.enseignantId || undefined,
        statut: filtres.value.statut || undefined,
        salleId: filtres.value.salleId || undefined,
        pageSize: 500,
        sort: 'date',
        order: 'desc',
      },
    });
    seances.value = data.data;
  } finally {
    chargement.value = false;
  }
}

/**
 * Le registre est la destination des liens du tableau de bord et des relevés :
 * il accepte donc la même période et les mêmes clés de filtre en paramètres.
 */
function appliquerParametresUrl() {
  const q = route.query;
  const lire = (cle: string) => (q[cle] ? String(q[cle]) : null);
  const debut = lire('dateDebut');
  const fin = lire('dateFin');
  const enseignantId = lire('enseignantId');
  const salleId = lire('salleId');
  const statut = lire('statut');

  if (!debut && !fin && !enseignantId && !salleId && !statut) return;

  raccourciActif.value = '';
  filtres.value = {
    dateDebut: debut ?? filtres.value.dateDebut,
    dateFin: fin ?? filtres.value.dateFin,
    enseignantId,
    salleId,
    statut,
  };
  // Les filtres arrivés par l'URL doivent se voir : sinon on lit un registre
  // restreint sans savoir pourquoi.
  filtresOuverts.value = !!(enseignantId || salleId || statut);
}

// Appliqué avant l'observateur : l'arrivée par lien ne déclenche qu'un chargement.
appliquerParametresUrl();
watch(filtres, charger, { deep: true });

onMounted(async () => {
  await charger();
  // Les référentiels n'alimentent que des listes déroulantes : ils ne doivent
  // pas retarder l'affichage du registre.
  const [s, e] = await Promise.all([
    api.get('/salles', { params: { all: '1' } }),
    api.get('/enseignants', { params: { all: '1' } }),
  ]);
  salles.value = s.data.data;
  enseignants.value = e.data.data;
});
</script>

<style scoped lang="scss">
// --------------------------------------------------------- fiche de détail

.fiche-detail {
  display: grid;
  grid-template-columns: minmax(112px, 33%) 1fr;
  gap: var(--up-2) var(--up-3);
  margin: 0;
  align-items: baseline;

  dt {
    color: var(--up-encre-douce);
    padding-top: 2px;
  }

  dd {
    margin: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .fiche-detail__coupure {
    border-top: var(--up-filet-fin);
    padding-top: var(--up-3);
  }
}

.fiche-detail__liens {
  border-top: var(--up-filet-fin);
  flex-wrap: wrap;
  gap: var(--up-2);
}

@media (max-width: 599px) {
  .fiche-detail {
    grid-template-columns: 1fr;
    gap: 2px;

    dd {
      text-align: left;
      margin-bottom: var(--up-2);
    }
  }
}

.registre {
  padding: var(--up-4) var(--up-3) var(--up-6);
}

.registre__entete {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--up-3);
  flex-wrap: wrap;
  margin-bottom: var(--up-3);
}

.registre__actions {
  display: flex;
  gap: var(--up-2);
  flex-wrap: wrap;
}

.registre__periode {
  display: flex;
  align-items: center;
  gap: var(--up-2);
  flex-wrap: wrap;
  padding-bottom: var(--up-3);
  border-bottom: var(--up-filet);
}

.registre__raccourcis { display: flex; }

.raccourci {
  appearance: none;
  background: var(--up-plaque);
  color: var(--up-encre);
  border: 2px solid var(--up-encre);
  padding: 8px 12px;
  min-height: 44px;
  cursor: pointer;

  & + & { border-left-width: 0; }

  &--actif {
    background: var(--up-encre);
    color: var(--up-craie);
  }
}

.registre__filtres {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: var(--up-3);
  align-items: center;
  padding: var(--up-3) 0;
  border-bottom: var(--up-filet);
}

.registre__releve {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: var(--up-3) 0;
}

.registre__releve-cellule {
  padding: var(--up-3);

  & + & { border-left: var(--up-filet); }
}

.registre__releve-valeur {
  font-size: clamp(1.4rem, 1rem + 1.6vw, 2rem);
  margin: var(--up-1) 0 0;
}

// ----------------------------------------------------------------- journée
.journee + .journee { margin-top: var(--up-5); }

.journee__tete {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--up-3);
  padding-bottom: var(--up-2);
  margin-bottom: var(--up-2);
  border-bottom: 3px solid var(--up-encre);
  flex-wrap: wrap;
}

.journee__date {
  font-size: 1.15rem;
  margin: 0;
  &::first-letter { text-transform: uppercase; }
}

.journee__compte { color: var(--up-encre-douce); }

.journee__liste {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--up-2);
}

.ligne {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) auto;
  align-items: stretch;
  overflow: hidden;
}

.ligne--annulee { opacity: 0.6; }

.ligne__heure {
  flex-direction: column;
  background: var(--up-encre);
  color: #fff;
  gap: 2px;
  padding: var(--up-2);
}

.ligne__corps {
  padding: var(--up-3);
  min-width: 0;
}

.ligne__enseignant { font-size: 1.02rem; margin: 0; }

.ligne__matiere { margin: 3px 0 0; font-size: 0.92rem; }

.ligne__type {
  border: 1px solid var(--up-encre);
  padding: 1px 4px;
  margin-left: 4px;
}

.ligne__lieu,
.ligne__constat {
  margin: 6px 0 0;
  color: var(--up-encre-douce);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ligne__etat {
  padding: var(--up-3);
  border-left: var(--up-filet-fin);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--up-2);
}

.ligne__boutons {
  display: flex;
  align-items: center;
  gap: var(--up-1);
}

.signature-detail { max-height: 90px; }

.registre__vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--up-2);
  padding: var(--up-6) var(--up-3);
  color: var(--up-encre-douce);
  text-align: center;
}

.registre__vide-titre { font-size: 1.3rem; color: var(--up-encre); }

.registre__vide-actions {
  display: flex;
  gap: var(--up-2);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--up-3);
}

@media (max-width: 767px) {
  .registre__releve { grid-template-columns: repeat(2, 1fr); }
  .registre__releve-cellule:nth-child(2n + 1) { border-left: 0; }
  .registre__releve-cellule:nth-child(n + 3) { border-top: var(--up-filet); }
}

@media (max-width: 599px) {
  .ligne {
    grid-template-columns: 74px minmax(0, 1fr);
    grid-template-rows: auto auto;
  }

  .ligne__heure { grid-row: 1 / span 2; }

  .ligne__etat {
    grid-column: 2;
    border-left: 0;
    border-top: var(--up-filet);
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: var(--up-2) var(--up-3);
  }
}
</style>
