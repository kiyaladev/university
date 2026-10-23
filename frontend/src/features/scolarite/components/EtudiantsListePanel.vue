<template>
  <q-table
    v-if="mode === 'tableau'"
    flat
    bordered
    class="carte"
    :rows="rows"
    :columns="colonnes"
    row-key="id"
    :loading="chargement"
    :pagination="{ rowsPerPage: 0 }"
    :hide-bottom="chargement || rows.length > 0"
  >
    <template #no-data>
      <etat-vide icone="groups" :titre="messageVide">
        <template #action>
          <div class="q-gutter-sm">
            <q-btn
              v-if="filtresActifs"
              outline
              no-caps
              icon="refresh"
              :label="$t('common.actions.reset_filters')"
              @click="emit('reinitialiser')"
            />
            <q-btn
              v-if="peutGerer && !filtresActifs"
              unelevated
              color="primary"
              no-caps
              icon="add"
              :label="$t('etudiants.actions.new')"
              @click="emit('creer')"
            />
          </div>
        </template>
      </etat-vide>
    </template>

    <template #body-cell-nom="p">
      <q-td :props="p">
        <div>{{ p.row.nom }} {{ p.row.prenom }}</div>
        <div class="text-caption text-grey-7">{{ p.row.matricule }}</div>
      </q-td>
    </template>

    <template #body-cell-sexe="p">
      <q-td :props="p">
        <q-chip v-if="p.row.sexe" dense outline color="primary">
          {{ $t(p.row.sexe === 'F' ? 'etudiants.options.genderShort.F' : 'etudiants.options.genderShort.M') }}
        </q-chip>
        <span v-else class="text-grey-7">{{ $t('common.format.emptyValue') }}</span>
      </q-td>
    </template>

    <template #body-cell-promotion="p">
      <q-td :props="p">
        <q-chip v-if="dernierePromo(p.row)" dense outline color="primary">
          {{ dernierePromo(p.row) }}
        </q-chip>
        <span v-else class="text-grey-7">{{ $t('common.format.emptyValue') }}</span>
      </q-td>
    </template>

    <template #body-cell-comptes="p">
      <q-td :props="p" class="text-center">
        <q-icon
          :name="p.row.user ? 'check_circle' : 'remove_circle_outline'"
          :color="p.row.user ? 'positive' : 'grey-5'"
        />
        <q-tooltip>
          {{
            p.row.user
              ? $t('etudiants.table.accountTooltip', { email: p.row.user.email })
              : $t('etudiants.table.noAccountTooltip')
          }}
        </q-tooltip>
      </q-td>
    </template>

    <template #body-cell-inscriptions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          v-if="peutValiderVoir && (p.row._count?.inscriptions ?? 0) > 0"
          flat
          dense
          no-caps
          class="chiffres"
          :label="String(p.row._count?.inscriptions ?? 0)"
          :aria-label="
            $t('etudiants.table.viewInscriptionsAria', {
              count: p.row._count?.inscriptions,
              name: `${p.row.prenom} ${p.row.nom}`,
            })
          "
          @click="emit('voirInscriptions', p.row)"
        >
          <q-tooltip>{{ $t('etudiants.table.viewInscriptionsTooltip') }}</q-tooltip>
        </q-btn>
        <span v-else class="chiffres text-grey-7">
          {{ p.row._count?.inscriptions ?? 0 }}
        </span>
      </q-td>
    </template>

    <template #body-cell-actif="p">
      <q-td :props="p">
        <q-toggle
          :model-value="p.row.actif"
          color="secondary"
          :disable="!peutGererCompte(p.row)"
          :aria-label="$t('etudiants.table.activeToggleAria', { name: `${p.row.prenom} ${p.row.nom}` })"
          @update:model-value="(v) => emit('basculerActif', p.row, v)"
        />
      </q-td>
    </template>

    <template #body-cell-actions="p">
      <q-td :props="p" class="text-right">
        <q-btn
          v-if="peutValiderVoir"
          flat
          dense
          no-caps
          color="primary"
          icon="how_to_reg"
          :aria-label="$t('etudiants.actions.inscriptionsAria')"
          :label="$t('etudiants.actions.inscriptionsAria')"
          @click="emit('allerAuxInscriptions', p.row)"
        >
          <q-tooltip>{{ $t('etudiants.actions.inscriptionsTooltip') }}</q-tooltip>
        </q-btn>
        <actions-secondaires>
          <q-btn
            v-close-popup
            v-if="peutGerer"
            flat
            dense
            no-caps
            icon="edit"
            :aria-label="$t('etudiants.actions.editAria')"
            :label="$t('etudiants.actions.editAria')"
            @click="emit('ouvrir', p.row)"
          >
            <q-tooltip>{{ $t('etudiants.actions.editTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="peutVoirPaiements"
            flat
            dense
            no-caps
            color="primary"
            icon="payments"
            :aria-label="$t('etudiants.actions.paiementsAria')"
            :label="$t('etudiants.actions.paiementsAria')"
            @click="emit('allerAuxPaiements', p.row)"
          >
            <q-tooltip>{{ $t('etudiants.actions.paiementsTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="peutValiderVoir"
            flat
            dense
            no-caps
            color="primary"
            icon="fact_check"
            :aria-label="$t('etudiants.actions.evaluationsAria')"
            :label="$t('etudiants.actions.evaluationsAria')"
            @click="emit('allerAuxEvaluations', p.row)"
          >
            <q-tooltip>{{ $t('etudiants.actions.evaluationsTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-close-popup
            v-if="peutGerer"
            flat
            dense
            no-caps
            color="primary"
            icon="print"
            :aria-label="$t('etudiants.actions.printAria')"
            :label="$t('etudiants.actions.printAria')"
            @click="emit('imprimerAttestation', p.row)"
          >
            <q-tooltip>
              {{
                aDossier(p.row) ? $t('etudiants.table.certificateTooltip') : $t('etudiants.table.noCertificateTooltip')
              }}
            </q-tooltip>
          </q-btn>
        </actions-secondaires>
      </q-td>
    </template>
  </q-table>

  <q-linear-progress v-if="mode === 'cartes' && chargement" indeterminate color="primary" class="q-mb-sm" />

  <div v-else-if="mode === 'cartes'" class="etudiants-cartes">
    <q-card v-for="e in rows" :key="e.id" flat bordered class="carte etudiants-cartes__carte">
      <q-card-section>
        <div class="row items-center q-mb-xs">
          <q-chip
            :outline="e.actif"
            :color="e.actif ? 'positive' : 'grey-7'"
            :icon="e.actif ? 'check_circle' : 'remove_circle'"
            dense
            :label="e.actif ? $t('common.fields.active') : $t('etudiants.cards.inactive')"
          />
          <q-chip v-if="e.sexe" dense outline color="primary">
            {{ e.sexe === 'F' ? $t('etudiants.options.gender.female') : $t('etudiants.options.gender.male') }}
          </q-chip>
          <q-space />
          <div class="text-caption text-grey-7">{{ e.matricule }}</div>
        </div>
        <div class="text-subtitle1 text-weight-medium">{{ e.nom }} {{ e.prenom }}</div>
        <div class="text-caption text-grey-7">
          <span v-if="e.telephone">{{ e.telephone }}</span>
          <span v-else>{{ $t('common.format.emptyValue') }}</span>
        </div>
        <div class="q-mt-sm">
          <q-chip v-if="dernierePromo(e)" outline color="primary" dense :label="dernierePromo(e)" icon="school" />
          <span v-else class="text-caption text-grey-7">{{ $t('etudiants.cards.noInscription') }}</span>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-gutter-xs">
        <q-btn
          v-if="peutValiderVoir"
          flat
          dense
          color="primary"
          icon="how_to_reg"
          no-caps
          :label="$t('common.fields.enrollments')"
          @click="emit('allerAuxInscriptions', e)"
        />
        <actions-secondaires>
          <q-btn
            v-close-popup
            v-if="peutGerer"
            flat
            dense
            icon="edit"
            no-caps
            :label="$t('common.actions.edit')"
            @click="emit('ouvrir', e)"
          />
          <q-btn
            v-close-popup
            v-if="peutVoirPaiements"
            flat
            dense
            color="primary"
            icon="payments"
            no-caps
            :label="$t('common.fields.payments')"
            @click="emit('allerAuxPaiements', e)"
          />
          <q-btn
            v-close-popup
            v-if="peutValiderVoir"
            flat
            dense
            color="primary"
            icon="fact_check"
            no-caps
            :label="$t('etudiants.actions.evaluations')"
            @click="emit('allerAuxEvaluations', e)"
          />
          <q-btn
            v-close-popup
            v-if="peutGerer"
            flat
            dense
            color="primary"
            icon="print"
            no-caps
            :label="$t('etudiants.actions.print')"
            @click="emit('imprimerAttestation', e)"
          />
        </actions-secondaires>
      </q-card-actions>
    </q-card>
    <etat-vide v-if="!rows.length" icone="groups" :titre="messageVide">
      <template #action>
        <div class="q-gutter-sm">
          <q-btn
            v-if="filtresActifs"
            outline
            no-caps
            icon="refresh"
            :label="$t('common.actions.reset_filters')"
            @click="emit('reinitialiser')"
          />
          <q-btn
            v-if="peutGerer && !filtresActifs"
            unelevated
            color="primary"
            no-caps
            icon="add"
            :label="$t('etudiants.actions.new')"
            @click="emit('creer')"
          />
        </div>
      </template>
    </etat-vide>
  </div>
</template>

<script setup lang="ts">
/**
 * Registre des étudiants : la lecture en tableau et la lecture en cartes.
 *
 * Le composant ne fait aucune requête : la page détient la liste et les
 * filtres, le panneau ne fait que les afficher et remonter les intentions
 * (édition, bascule d'activation, inscriptions, paiements, évaluations,
 * impression).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type QTableColumn } from 'quasar';
import ActionsSecondaires from '@/shared/components/ActionsSecondaires.vue';
import EtatVide from '@/shared/components/EtatVide.vue';
import type { EtudiantRegistre } from '../types';

const props = defineProps<{
  /** Présentation retenue : le tableau ou les cartes. */
  mode: 'tableau' | 'cartes';
  rows: EtudiantRegistre[];
  chargement: boolean;
  messageVide: string;
  filtresActifs: boolean;
  /** Droit d'ouvrir et de modifier une fiche. */
  peutGerer: boolean;
  /** Droit de consulter les inscriptions et les évaluations. */
  peutValiderVoir: boolean;
  /** Droit de consulter le suivi financier. */
  peutVoirPaiements: boolean;
  /** L'administrateur peut tout activer ; sinon, seuls les comptes sans accès. */
  estAdmin: boolean;
}>();

const emit = defineEmits<{
  ouvrir: [etudiant: EtudiantRegistre];
  basculerActif: [etudiant: EtudiantRegistre, valeur: unknown];
  voirInscriptions: [etudiant: EtudiantRegistre];
  allerAuxInscriptions: [etudiant: EtudiantRegistre];
  allerAuxPaiements: [etudiant: EtudiantRegistre];
  allerAuxEvaluations: [etudiant: EtudiantRegistre];
  imprimerAttestation: [etudiant: EtudiantRegistre];
  reinitialiser: [];
  creer: [];
}>();

const { t } = useI18n();

const colonnes = computed<QTableColumn[]>(() => [
  { name: 'nom', label: t('etudiants.table.columns.name'), field: 'nom', align: 'left', sortable: true },
  { name: 'sexe', label: t('etudiants.table.columns.gender'), field: 'sexe', align: 'left' },
  { name: 'promotion', label: t('etudiants.table.columns.promotion'), field: 'promotion', align: 'left' },
  { name: 'telephone', label: t('common.fields.phone'), field: 'telephone', align: 'left' },
  { name: 'email', label: t('common.fields.emailShort'), field: 'email', align: 'left' },
  { name: 'comptes', label: t('etudiants.table.columns.account'), field: 'comptes', align: 'center' },
  {
    name: 'inscriptions',
    label: t('common.fields.enrollments'),
    field: 'inscriptions',
    align: 'right',
    sortable: true,
  },
  { name: 'actif', label: t('common.fields.active'), field: 'actif', align: 'center' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]);

const peutGererCompte = (e: EtudiantRegistre) => props.estAdmin || !e.user;

/** Promotion portée par le dernier dossier de l'étudiant. */
const dernierePromo = (e: EtudiantRegistre) => e.inscriptions?.[0]?.promotion?.nom ?? null;

/** L'étudiant a-t-il au moins un dossier d'inscription ? */
const aDossier = (e: EtudiantRegistre) => !!e.inscriptions?.[0];
</script>

<style scoped lang="scss">
.etudiants-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--up-3);
}
.etudiants-cartes__carte {
  background: var(--up-plaque);
}
</style>
