<template>
  <div class="row q-col-gutter-md">
    <div v-for="doc in documents" :key="doc.id" class="col-12 col-sm-6 col-lg-4">
      <q-card class="carte carte-document q-pa-md full-height">
        <div class="row items-start no-wrap">
          <q-chip
            dense
            outline
            color="primary"
            class="q-ma-none"
            :label="LIBELLE_TYPE_DOCUMENT[doc.type] ?? doc.type"
          />
          <q-space />
          <q-icon v-if="!doc.public" name="visibility_off" color="orange" size="20px">
            <q-tooltip>{{ $t('bibliotheque.card.unpublished') }}</q-tooltip>
          </q-icon>
          <q-icon v-if="!doc.fichier" name="description" color="grey" size="20px">
            <q-tooltip>{{ $t('bibliotheque.card.depositedWithoutFile') }}</q-tooltip>
          </q-icon>
        </div>

        <div class="doc-titre q-mt-sm">{{ doc.titre }}</div>
        <div class="doc-auteurs">{{ doc.auteurs ?? $t('bibliotheque.card.noAuthor') }}</div>

        <div v-if="doc.motsClefs?.length" class="text-caption text-grey-7 q-mt-xs">
          <q-icon name="sell" size="13px" class="q-mr-xs" />
          <span v-for="(m, i) in doc.motsClefs.slice(0, 3)" :key="m + i">
            {{ m }}<span v-if="i < Math.min(doc.motsClefs.length, 3) - 1"> · </span>
          </span>
        </div>

        <div v-if="doc.extraitContexte" class="doc-extrait q-mt-sm" v-html="surligner(doc.extraitContexte, terme)" />

        <q-banner v-if="(doc.indicePlagiat ?? 0) > 50" dense class="bg-red-1 text-red-10 q-mt-sm q-pa-sm">
          <template #avatar><q-icon name="policy" color="negative" /></template>
          <div class="text-caption text-weight-medium">
            {{ $t('bibliotheque.card.plagiarismRisk', { score: doc.indicePlagiat }) }}
          </div>
        </q-banner>

        <q-separator class="q-mt-sm q-mb-sm" />
        <div class="row items-center text-caption text-grey-7">
          <div class="col">
            <div>{{ doc.departement?.nom ?? '—' }}</div>
            <div>
              {{ $t('bibliotheque.card.year', { year: anneeDocument(doc) }) }}
              <template v-if="doc.tailleKo">
                >· {{ $t('common.units.megabytes', { n: (doc.tailleKo / 1024).toFixed(1) }) }}</template
              >
            </div>
          </div>
          <div class="col-auto" :title="$t('bibliotheque.card.downloads', { count: doc.telechargements })">
            <q-icon name="download" size="16px" class="q-mr-xs" />{{ doc.telechargements }}
          </div>
        </div>

        <div class="row q-mt-sm q-col-gutter-xs justify-end">
          <q-btn
            v-if="doc.fichier"
            flat
            dense
            outline
            color="primary"
            icon="download"
            :label="$t('common.actions.download')"
            no-caps
            @click="emit('telecharger', doc)"
          />
          <q-btn
            flat
            dense
            outline
            icon="visibility"
            :label="$t('bibliotheque.actionsColumn.preview')"
            no-caps
            @click="emit('apercu', doc)"
          />
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            icon="edit"
            :aria-label="$t('bibliotheque.actionsColumn.editAria')"
            @click="emit('modifier', doc)"
          >
            <q-tooltip>{{ $t('common.actions.edit') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutGerer"
            flat
            dense
            round
            :icon="doc.public ? 'visibility_off' : 'visibility'"
            :color="doc.public ? 'orange' : 'primary'"
            :aria-label="
              doc.public ? $t('bibliotheque.actionsColumn.unpublishAria') : $t('bibliotheque.actionsColumn.publishAria')
            "
            @click="emit('basculer', doc)"
          >
            <q-tooltip>{{ doc.public ? $t('common.actions.unpublish') : $t('common.actions.publish') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="peutVoirPlagiat && (doc.indicePlagiat ?? 0) > 0"
            flat
            dense
            round
            icon="policy"
            :color="couleurPlagiat(doc.indicePlagiat ?? 0)"
            :aria-label="$t('bibliotheque.actionsColumn.viewScoreAria')"
            @click="emit('score', doc)"
          >
            <q-tooltip>{{ $t('bibliotheque.actionsColumn.viewScoreTooltip') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-if="estAdmin"
            flat
            dense
            round
            color="negative"
            icon="delete"
            :aria-label="$t('bibliotheque.actionsColumn.deleteAria')"
            @click="emit('supprimer', doc)"
          >
            <q-tooltip>{{ $t('common.actions.delete') }}</q-tooltip>
          </q-btn>
        </div>
      </q-card>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Vue cartes du fonds documentaire. La page garde la liste et les actions :
 * ce composant présente les fiches et rend les clics.
 */
import { LIBELLE_TYPE_DOCUMENT } from '@/shared/utils/libelles';
import { couleurPlagiat, surligner } from './BibliothequeAffiche';
import type { DocumentDepot } from '@/types';

defineProps<{
  documents: DocumentDepot[];
  /** Texte de recherche : il surligne les extraits. */
  terme: string;
  /** Modifier ou (dé)publier un document. */
  peutGerer: boolean;
  /** Voir le score de plagiat. */
  peutVoirPlagiat: boolean;
  /** Supprimer un document. */
  estAdmin: boolean;
}>();

const emit = defineEmits<{
  telecharger: [document: DocumentDepot];
  apercu: [document: DocumentDepot];
  modifier: [document: DocumentDepot];
  basculer: [document: DocumentDepot];
  score: [document: DocumentDepot];
  supprimer: [document: DocumentDepot];
}>();

/** Année d'édition : celle saisie, sinon celle du dépôt. */
function anneeDocument(doc: DocumentDepot): number {
  return doc.anneeEdition ?? new Date(doc.createdAt).getFullYear();
}
</script>

<style scoped>
.carte-document {
  display: flex;
  flex-direction: column;
}
.doc-titre {
  font-weight: 800;
  font-size: 1.05rem;
  line-height: 1.3;
  color: var(--up-encre);
}
.doc-auteurs {
  font-size: 0.85rem;
  color: var(--up-encre-douce);
}
/* Un extrait cité est une plaque cernée, pas une carte à bandeau latéral :
   le monde « panneau peint » trace des filets entiers. */
.doc-extrait {
  font-size: 0.83rem;
  line-height: 1.4;
  color: var(--up-encre-douce);
  background: var(--up-craie);
  padding: var(--up-2);
  border: var(--up-filet-fin);
  white-space: pre-wrap;
}
/* Le surlignage se pose en jaune très dilué. Ce bloc est du CSS simple : la
   variable Sass `$jaune` qui s'y trouvait n'y était jamais résolue, et le
   surlignage n'avait donc aucun fond. */
.doc-extrait :deep(mark) {
  background: #fff6c2;
  padding: 0 2px;
  border-radius: 2px;
  color: var(--up-encre);
  font-weight: 600;
}
</style>
