<template>
  <q-dialog :model-value="!!ticket" @update:model-value="emit('update:modelValue', null)">
    <q-card style="width: 560px; max-width: 95vw">
      <q-card-section v-if="ticket" class="text-h6">
        {{ $t('helpdesk.ticketDetailDialog.title', { numero: ticket.numero }) }}
      </q-card-section>
      <q-card-section v-if="ticket" class="q-gutter-md">
        <div class="row q-gutter-x-md items-center">
          <PastilleStatut domaine="ticket" :statut="ticket.statut" />
          <span class="ticket-champ" :class="`prio-champ--${ticket.priorite}`">
            <span class="pochoir">{{ libellePriorite(ticket.priorite) }}</span>
          </span>
          <span class="text-caption text-grey-7">{{ dateHeureLisible(ticket.createdAt) }}</span>
        </div>

        <div>
          <span class="section-titre">{{ $t('helpdesk.ticketDetailDialog.signalement') }}</span>
          <div class="text-body1">{{ libelleCategorie(ticket.categorie) }}</div>
          <div class="q-mt-sm" style="white-space: pre-wrap">{{ ticket.description }}</div>
        </div>

        <div class="row q-col-gutter-md">
          <div class="col-6">
            <span class="section-titre">{{ $t('helpdesk.ticketDetailDialog.equipment') }}</span>
            <div>{{ ticket.equipement?.libelle ?? '—' }}</div>
            <div class="text-caption text-grey-7">{{ ticket.equipement?.emplacement ?? '' }}</div>
          </div>
          <div class="col-6">
            <span class="section-titre">{{ $t('helpdesk.ticketDetailDialog.declarant') }}</span>
            <div>
              {{
                ticket.utilisateur
                  ? `${ticket.utilisateur.prenom} ${ticket.utilisateur.nom}`
                  : (ticket.declarantNom ?? '—')
              }}
            </div>
          </div>
        </div>

        <div>
          <span class="section-titre">{{ $t('helpdesk.ticketDetailDialog.history') }}</span>
          <q-list dense>
            <q-item>
              <q-item-section avatar><q-icon name="radio_button_unchecked" size="18px" /></q-item-section>
              <q-item-section>
                <q-item-label class="pochoir">{{ $t('helpdesk.ticketDetailDialog.opened') }}</q-item-label>
                <q-item-label caption>{{ dateHeureLisible(ticket.createdAt) }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="ticket.traiteLe">
              <q-item-section avatar>
                <q-icon name="handyman" size="18px" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="pochoir">
                  {{
                    ticket.statut === 'EN_COURS'
                      ? $t('helpdesk.ticketDetailDialog.inProgress')
                      : $t('helpdesk.ticketDetailDialog.resolved')
                  }}
                </q-item-label>
                <q-item-label caption>
                  {{ dateHeureLisible(ticket.traiteLe) }} · {{ nomCourt(ticket.traitePar) }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="ticket.clicheLe">
              <q-item-section avatar><q-icon name="archive" size="18px" /></q-item-section>
              <q-item-section>
                <q-item-label class="pochoir">{{ $t('helpdesk.ticketDetailDialog.closed') }}</q-item-label>
                <q-item-label caption>{{ dateHeureLisible(ticket.clicheLe) }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$t('common.actions.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
/**
 * Fiche d'un ticket d'incident : signalement, équipement, déclarant et
 * historique de traitement.
 */
import PastilleStatut from '@/shared/components/PastilleStatut.vue';
import { dateHeureLisible } from '@/shared/utils/format';
import { LIBELLE_CATEGORIE_INCIDENT, LIBELLE_PRIORITE_TICKET } from '@/shared/utils/libelles';
import type { TicketSupport } from '@/types';

defineProps<{
  /** Le ticket affiché ; `null` ferme le dialogue. */
  ticket: TicketSupport | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [ticket: TicketSupport | null] }>();

const libellePriorite = (p: string) => LIBELLE_PRIORITE_TICKET[p] ?? p;
const libelleCategorie = (c: string) => LIBELLE_CATEGORIE_INCIDENT[c] ?? c;
const nomCourt = (u: { nom?: string; prenom?: string } | null | undefined) =>
  `${u?.prenom ?? ''} ${u?.nom ?? ''}`.trim() || '—';
</script>

<style scoped lang="scss">
.ticket-champ {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  min-height: 24px;
  color: var(--up-encre);
  border-radius: var(--up-rayon-sm);

  &.prio-champ--BASSE {
    background: var(--up-gris-inerte);
    color: var(--up-encre);
    border: var(--up-filet);
    box-shadow: none;
  }
  &.prio-champ--NORMALE {
    background: $jaune-fond;
    color: $jaune-texte;
  }
  &.prio-champ--HAUTE {
    background: $rouge-fond;
    color: #{$rouge};
  }
}
</style>
