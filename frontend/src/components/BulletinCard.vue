<script setup lang="ts">
import PastilleStatut from './PastilleStatut.vue';
/**
 * Aperçu d'un bulletin semestriel d'étudiant : moyenne par UE pondérée par
 * les crédits, décision du jury (ADMIS/AJOURNÉ/DÉFAILLANT), rang dans la
 * promotion. Bouton « Imprimer » qui ouvre la version A4 officielle.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LIBELLE_DECISION_JURY, dateLisible } from '../utils/libelles';
import { ouvrirImpression } from '../services/impression';

interface Ligne {
  matiere: string;
  code?: string;
  credits: number;
  moyenne: number; // /20
  decision?: string;
}

interface Bulletin {
  etudiant: { matricule: string; nom: string; prenom: string };
  promotion: string;
  annee: string;
  session: string; // libellé déjà résolu : « Session normale » / « Rattrapage »
  dateDeliberation?: string;
  lignes: Ligne[];
  moyenneGenerale: number;
  decision: 'ADMIS' | 'AJOURNE' | 'DEFAILLANT' | null;
  mention?: string;
  rang?: number;
  effectif?: number;
}

const props = defineProps<{
  bulletin: Bulletin;
  /** Chemin d'impression du relevé ; l'onglet est ouvert avec l'en-tête d'auth. */
  cheminImpression?: string;
}>();
const { t } = useI18n();

const totalCredits = computed(() => props.bulletin.lignes.reduce((acc, l) => acc + l.credits, 0));
const libelleDecision = computed(() =>
  props.bulletin.decision
    ? (LIBELLE_DECISION_JURY[props.bulletin.decision] ?? props.bulletin.decision)
    : t('bulletins.table.nonDelibere'),
);

function imprimer() {
  if (!props.cheminImpression) return;
  void ouvrirImpression(props.cheminImpression);
}
</script>

<template>
  <q-card flat bordered class="bulletin">
    <q-card-section class="bulletin__entete">
      <div>
        <div class="bulletin__nom">{{ bulletin.etudiant.prenom }} {{ bulletin.etudiant.nom }}</div>
        <div class="bulletin__meta">{{ $t('common.fields.matricule') }} {{ bulletin.etudiant.matricule }} · {{ bulletin.promotion }} · {{ bulletin.annee }}</div>
      </div>
      <PastilleStatut domaine="decision" :statut="bulletin.decision" :libelle="libelleDecision" />
    </q-card-section>

    <q-separator />

    <q-card-section class="bulletin__corps">
      <!--
        Le détail par UE n'est calculé que par la route d'impression officielle :
        tant qu'il n'est pas fourni, on annonce où le lire plutôt que d'afficher
        un tableau vide sur un document qui fait foi.
      -->
      <div v-if="!bulletin.lignes.length" class="bulletin__sans-detail">
        <q-icon name="description" size="24px" class="bulletin__icone-detail" />
        <div class="q-mt-xs">
          {{ $t('bulletins.cards.detailOnOfficial') }}
        </div>
      </div>
      <q-table
        v-else
        flat
        :columns="[
          { name: 'matiere', label: $t('common.fields.subject'), field: 'matiere', align: 'left' },
          { name: 'code', label: $t('common.fields.code'), field: 'code', align: 'left', style: 'width: 100px' },
          { name: 'credits', label: $t('common.fields.credits'), field: 'credits', align: 'right', style: 'width: 80px' },
          { name: 'moyenne', label: $t('bulletins.cards.columns.average'), field: 'moyenne', align: 'right', style: 'width: 110px' },
        ]"
        :rows="bulletin.lignes"
        row-key="matiere"
        :rows-per-page-options="[0]"
        hide-bottom
        dense
      >
        <template #body-cell-moyenne="props">
          <q-td :props="props">
            <span :class="{ 'text-negative': props.row.moyenne < 5, 'text-warning': props.row.moyenne >= 5 && props.row.moyenne < 10 }">
              {{ props.row.moyenne.toFixed(2) }}
            </span>
          </q-td>
        </template>
      </q-table>
    </q-card-section>

    <q-card-section class="bulletin__pied">
      <div>
        <div v-if="totalCredits" class="bulletin__total">{{ $t('bulletins.cards.totalCredits') }} {{ totalCredits }}</div>
        <div v-if="bulletin.dateDeliberation" class="bulletin__total">
          {{ $t('bulletins.cards.deliberatedOn') }} {{ dateLisible(bulletin.dateDeliberation) }} · {{ bulletin.session }}
        </div>
        <div class="bulletin__moyenne">
          {{ $t('bulletins.cards.overallAverage') }} <strong>{{ bulletin.moyenneGenerale.toFixed(2) }}</strong>{{ $t('common.units.outOf20') }}
        </div>
        <div v-if="bulletin.mention" class="bulletin__mention">{{ $t('bulletins.cards.honors') }} {{ bulletin.mention }}</div>
      </div>
      <div class="bulletin__rang" v-if="bulletin.rang">
        {{ $t('bulletins.table.columns.rang') }} {{ bulletin.rang }}{{ bulletin.effectif ? ` / ${bulletin.effectif}` : '' }}
      </div>
      <q-btn
        v-if="cheminImpression"
        flat
        icon="picture_as_pdf"
        :label="$t('bulletins.table.ariaLabels.imprimerBulletin')"
        no-caps
        color="primary"
        @click="imprimer"
      />
    </q-card-section>
  </q-card>
</template>

<style scoped>
.bulletin {
  background: var(--up-plaque);
}
.bulletin__entete {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bulletin__nom {
  font-weight: 590;
  font-size: 18px;
}
.bulletin__meta {
  font-size: 12px;
  color: var(--up-encre-douce);
}
.bulletin__pied {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--up-chaux);
}
.bulletin__total {
  font-size: 12px;
  color: var(--up-encre-douce);
}
.bulletin__sans-detail {
  padding: 20px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--up-encre-douce);
  background: var(--up-chaux);
}
.bulletin__icone-detail {
  color: var(--up-encre-tertiaire);
}
.bulletin__moyenne {
  font-size: 14px;
  margin-top: 4px;
}
.bulletin__rang {
  margin-left: auto;
  font-weight: 590;
  font-size: 16px;
  color: var(--up-encre);
}
.bulletin__mention {
  font-size: 12px;
  color: var(--up-secondary, #007A4D);
  font-weight: 600;
  margin-top: 4px;
}
</style>
