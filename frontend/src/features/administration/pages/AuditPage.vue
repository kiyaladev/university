<template>
  <q-page class="q-pa-md">
    <page-header :title="t('audit.title')" :subtitle="t('audit.subtitle')" />
    <q-form class="row q-col-gutter-sm q-mb-md" @submit="rechercher">
      <q-input v-model="saisie.entite" outlined dense class="col-12 col-sm-4" :label="t('audit.entity')" />
      <q-input v-model="saisie.action" outlined dense class="col-12 col-sm-4" :label="t('audit.action')" />
      <q-input v-model="saisie.acteur" outlined dense class="col-12 col-sm-4" :label="t('audit.actor')" />
      <q-input v-model="saisie.dateDebut" type="date" stack-label outlined dense class="col-6 col-sm-2" :label="t('common.actions.from')" />
      <q-input v-model="saisie.dateFin" type="date" stack-label outlined dense class="col-6 col-sm-2" :label="t('common.actions.to')" />
      <div class="col-12 col-sm-2"><q-btn type="submit" color="primary" icon="search" :label="t('audit.search')" :loading="liste.chargement" /></div>
    </q-form>
    <q-banner v-if="erreur" class="bg-red-1 text-negative q-mb-md" role="alert">{{ erreur }}</q-banner>
    <q-table :pagination="liste.pagination" :rows="liste.lignes" :columns="colonnes" row-key="id"
      :loading="liste.chargement" :grid="$q.screen.lt.md" :rows-per-page-options="[25, 50, 100]"
      :no-data-label="t('audit.empty')" @request="(r) => (liste.pagination = { page: r.pagination.page, rowsPerPage: r.pagination.rowsPerPage, rowsNumber: liste.total })">
      <template #body-cell-details="props">
        <q-td :props="props"><q-btn flat dense icon="visibility" :label="t('common.actions.details')" @click="selection = props.row" /></q-td>
      </template>
      <template #item="props">
        <div class="col-12 q-pa-xs"><q-card flat bordered><q-card-section>
          <div class="text-weight-bold">{{ libelleAction(props.row.action) }}</div>
          <div>{{ acteur(props.row) }} · {{ date(props.row.createdAt) }}</div>
          <div>{{ props.row.entite }}</div>
          <q-btn flat dense icon="visibility" :label="t('common.actions.details')" @click="selection = props.row" />
        </q-card-section></q-card></div>
      </template>
    </q-table>
    <q-dialog :model-value="!!selection" @update:model-value="selection = null">
      <q-card class="audit-detail">
        <q-card-section><h2 class="text-h6 q-my-none">{{ t('common.actions.details') }}</h2></q-card-section>
        <q-card-section v-if="selection" class="q-pt-none">
          <dl><dt>{{ t('audit.actor') }}</dt><dd>{{ acteur(selection) }}</dd>
            <dt>{{ t('audit.date') }}</dt><dd>{{ date(selection.createdAt) }}</dd>
            <dt>{{ t('audit.entity') }}</dt><dd>{{ selection.entite }} · {{ selection.entiteId || '—' }}</dd>
            <dt>{{ t('audit.action') }}</dt><dd>{{ libelleAction(selection.action) }}</dd></dl>
          <template v-if="etats">
            <p v-if="etats.apres?.horodatage">{{ t('audit.declaredTime') }} : {{ date(etats.apres.horodatage) }}</p>
            <h3 class="text-subtitle1">{{ t('audit.before') }}</h3><pre>{{ JSON.stringify(etats.avant, null, 2) }}</pre>
            <h3 class="text-subtitle1">{{ t('audit.after') }}</h3><pre>{{ JSON.stringify(etats.apres, null, 2) }}</pre>
          </template>
          <p v-else-if="resumeSms" class="audit-texte">
            {{ t('audit.smsBatchSummary', { recipients: resumeSms.nombreDestinataires, messages: resumeSms.messagesPresents }) }}
          </p>
          <p v-else class="audit-texte">{{ selection.details || t('audit.noDetails') }}</p>
        </q-card-section>
        <q-card-actions align="right"><q-btn v-close-popup flat :label="t('common.actions.close')" color="primary" /></q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import PageHeader from '@/shared/components/PageHeader.vue';
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar, type QTableColumn } from 'quasar';
import { api } from '@/boot/axios';
import { useListePaginee } from '@/shared/composables/useListePaginee';

interface AuditRow { id: string; action: string; entite: string; entiteId?: string; createdAt: string; details?: string; user?: { nom: string; prenom: string; role: string } }
const $q = useQuasar();
const { t, locale } = useI18n();
/** Saisie du formulaire ; elle ne s'applique qu'au clic sur « Rechercher ». */
const saisie = ref({ entite: '', action: '', acteur: '', dateDebut: '', dateFin: '' });
const filtres = ref({ ...saisie.value });
const selection = ref<AuditRow | null>(null);
const erreur = ref('');
const acteur = (row: AuditRow) => row.user ? `${row.user.prenom} ${row.user.nom} (${row.user.role})` : t('audit.system');
const libelleAction = (action: string) => {
  if (action === 'SMS_DIFFUSION_DEMANDEE') return t('audit.smsBroadcastRequested');
  if (action === 'DOCUMENT_DEPOT_TELECHARGE') return t('audit.documentDownload');
  if (action === 'PAIEMENT_TRANSACTION_LIEE') return t('audit.paymentTransactionLinked');
  if (action === 'COMPTE_ETUDIANT_CREE') return t('audit.studentPortalAccountCreated');
  if (action === 'COMPTE_ETUDIANT_RATTACHE') return t('audit.studentPortalAccountLinked');
  return action;
};
const date = (value: string) => new Date(value).toLocaleString(locale.value);
const colonnes = computed<QTableColumn[]>(() => [
  { name: 'date', label: t('audit.date'), field: 'createdAt', format: date, align: 'left' },
  { name: 'actor', label: t('audit.actor'), field: acteur, align: 'left' },
  { name: 'action', label: t('audit.action'), field: (row: AuditRow) => libelleAction(row.action), align: 'left' },
  { name: 'entity', label: t('audit.entity'), field: 'entite', align: 'left' },
  { name: 'details', label: t('common.actions.details'), field: 'details', align: 'left' },
]);
const etats = computed(() => {
  try { const data = JSON.parse(selection.value?.details || ''); return 'avant' in data && 'apres' in data ? data : null; }
  catch { return null; }
});
const resumeSms = computed(() => {
  if (selection.value?.action !== 'SMS_DIFFUSION_DEMANDEE') return null;
  try {
    const details = JSON.parse(selection.value.details || '');
    if (!Number.isInteger(details.nombreDestinataires) || !Number.isInteger(details.messagesPresents)) return null;
    return details as { nombreDestinataires: number; messagesPresents: number };
  } catch { return null; }
});
const liste = reactive(
  useListePaginee<AuditRow, typeof filtres.value>({
    filtres,
    pageSize: 25,
    async charger({ page, pageSize, filtres: f }) {
      erreur.value = '';
      try {
        // Silencieux : l'échec s'affiche dans le bandeau de la page.
        const { data } = await api.get('/controles/audit', { silencieux: true, params: {
          page, pageSize,
          acteur: f.acteur || undefined,
          entite: f.entite || undefined, action: f.action || undefined,
          dateDebut: f.dateDebut ? new Date(`${f.dateDebut}T00:00:00`).toISOString() : undefined,
          dateFin: f.dateFin ? new Date(`${f.dateFin}T23:59:59.999`).toISOString() : undefined,
        } });
        return data;
      } catch (error: any) {
        erreur.value = error.response?.data?.message || t('audit.error');
        throw error;
      }
    },
  }),
);
function rechercher() {
  const avant = JSON.stringify(filtres.value);
  filtres.value = { ...saisie.value };
  // Filtres inchangés : la liste ne se relance pas d'elle-même.
  if (JSON.stringify(filtres.value) === avant) liste.page = 1;
}
</script>

<style scoped>
.audit-detail { width: 720px; max-width: 95vw; }
dd { margin: 0 0 12px; overflow-wrap: anywhere; }
dt { font-weight: 600; }
pre, .audit-texte { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.85rem; }
</style>
