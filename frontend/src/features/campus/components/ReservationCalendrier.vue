<template>
  <grille-calendrier :evenements="evenements" :mois-initial="mois" :compact="false" />
</template>

<script setup lang="ts">
/**
 * Vue calendrier mensuel des réservations.
 *
 * Le composant ne fait qu'une chose : traduire les jours de la période en
 * événements affichables par `GrilleCalendrier`. Les réservations sont
 * cliquables (elles ouvrent le détail), les séances d'emploi du temps sont un
 * simple repère d'occupation, en lecture seule.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import GrilleCalendrier from '@/shared/components/GrilleCalendrier.vue';
import type { ReservationSalle, Salle } from '@/types';
import type { JourCalendrier, SeanceCalendrier } from '../types';

const props = defineProps<{
  /** Jours de la période, tels que renvoyés par le calendrier de l'API. */
  jours: JourCalendrier[];
  /** Salles de la période : servent à nommer les séances. */
  salles: Salle[];
  /** Mois affiché au départ (YYYY-MM). */
  mois: string;
}>();

const emit = defineEmits<{ selectionner: [ReservationSalle] }>();

const { t } = useI18n();

const COULEUR_STATUT: Record<string, string> = {
  EN_ATTENTE: '#FCD116',
  CONFIRME: '#007A4D',
  REFUSE: '#86868b',
  ANNULE: '#86868b',
};
/** Gris sourd : les séances ne sont là que pour le repérage, en lecture seule. */
const COULEUR_SEANCE = '#86868b';

function libelleSeance(s: SeanceCalendrier): string {
  return s.affectation?.matiere?.intitule ?? t('common.fields.session');
}

function nomSalle(salleId?: string | null): string {
  if (!salleId) return '';
  return props.salles.find((s) => s.id === salleId)?.code ?? '';
}

const evenements = computed(() => [
  ...props.jours.flatMap((j) =>
    j.reservations.map((r) => ({
      id: r.id,
      date: r.dateJour,
      titre: r.demandeurId ? `${r.heureDebut} ${r.motif}` : `${r.heureDebut} ${t('reservations.calendar.reserved')}`,
      sousTitre: `${r.salle?.code ?? ''}${r.organisme ? ` — ${r.organisme}` : ''}`,
      couleur: COULEUR_STATUT[r.statut] ?? '#86868b',
      icone: 'event',
      onClick: r.demandeurId ? () => emit('selectionner', r) : undefined,
    })),
  ),
  // Les séances de l'emploi du temps : repère d'occupation, non cliquables.
  ...props.jours.flatMap((j) =>
    j.seances.map((s) => ({
      id: `seance-${s.id}`,
      date: j.date,
      titre: `${s.heureDebut} ${libelleSeance(s)}`,
      sousTitre: [nomSalle(s.salleId), s.affectation?.promotion?.nom].filter(Boolean).join(' — '),
      couleur: COULEUR_SEANCE,
      icone: 'school',
    })),
  ),
]);
</script>
