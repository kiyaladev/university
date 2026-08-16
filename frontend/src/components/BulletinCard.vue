<script setup lang="ts">
/**
 * Aperçu d'un bulletin semestriel d'étudiant : moyenne par UE pondérée par
 * les crédits, décision du jury (ADMIS/AJOURNÉ/DÉFAILLANT), rang dans la
 * promotion. Bouton « Imprimer » qui ouvre la version A4 officielle.
 */
import { computed } from 'vue';

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
  session: string; // 'Session 1' / 'Session 2 (rattrapage)'
  dateDeliberation?: string;
  lignes: Ligne[];
  moyenneGenerale: number;
  decision: 'ADMIS' | 'AJOURNE' | 'DEFAILLANT';
  mention?: string;
  rang?: number;
  effectif?: number;
}

const props = defineProps<{
  bulletin: Bulletin;
  /** URL d'impression (ouvre un nouvel onglet) */
  urlImpression?: string;
}>();

const COULEUR: Record<string, string> = {
  ADMIS: 'positive',
  AJOURNE: 'negative',
  DEFAILLANT: 'dark',
};

const totalCredits = computed(() => props.bulletin.lignes.reduce((acc, l) => acc + l.credits, 0));
const couleur = computed(() => COULEUR[props.bulletin.decision] ?? 'primary');

function imprimer() {
  if (!props.urlImpression) return;
  window.open(props.urlImpression, '_blank');
}
</script>

<template>
  <q-card flat bordered class="bulletin">
    <q-card-section class="bulletin__entete">
      <div>
        <div class="bulletin__nom">{{ bulletin.etudiant.prenom }} {{ bulletin.etudiant.nom }}</div>
        <div class="bulletin__meta">Matricule {{ bulletin.etudiant.matricule }} · {{ bulletin.promotion }} · {{ bulletin.annee }}</div>
      </div>
      <q-badge :color="couleur" :label="bulletin.decision" />
    </q-card-section>

    <q-separator />

    <q-card-section class="bulletin__corps">
      <q-table
        flat
        :columns="[
          { name: 'matiere', label: 'Matière', field: 'matiere', align: 'left' },
          { name: 'code', label: 'Code', field: 'code', align: 'left', style: 'width: 100px' },
          { name: 'credits', label: 'Crédits', field: 'credits', align: 'right', style: 'width: 80px' },
          { name: 'moyenne', label: 'Moyenne /20', field: 'moyenne', align: 'right', style: 'width: 110px' },
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
        <div class="bulletin__total">Total crédits : {{ totalCredits }}</div>
        <div class="bulletin__moyenne">
          Moyenne générale : <strong>{{ bulletin.moyenneGenerale.toFixed(2) }}</strong>/20
        </div>
        <div v-if="bulletin.mention" class="bulletin__mention">Mention : {{ bulletin.mention }}</div>
      </div>
      <div class="bulletin__rang" v-if="bulletin.rang">
        Rang {{ bulletin.rang }}{{ bulletin.effectif ? ` / ${bulletin.effectif}` : '' }}
      </div>
      <q-btn
        v-if="urlImpression"
        flat
        icon="picture_as_pdf"
        label="Imprimer le bulletin"
        no-caps
        color="primary"
        @click="imprimer"
      />
    </q-card-section>
  </q-card>
</template>

<style scoped>
.bulletin {
  background: white;
}
.bulletin__entete {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bulletin__nom {
  font-weight: 700;
  font-size: 18px;
}
.bulletin__meta {
  font-size: 12px;
  color: #666;
}
.bulletin__pied {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(0, 0, 0, 0.02);
}
.bulletin__total {
  font-size: 12px;
  color: #555;
}
.bulletin__moyenne {
  font-size: 14px;
  margin-top: 4px;
}
.bulletin__rang {
  margin-left: auto;
  font-weight: 700;
  font-size: 16px;
  color: var(--up-encre);
}
.bulletin__mention {
  font-size: 12px;
  color: var(--up-secondary, #0F7A45);
  font-weight: 600;
  margin-top: 4px;
}
</style>
