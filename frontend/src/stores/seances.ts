import { defineStore } from 'pinia';
import { Notify } from 'quasar';
import { api } from '../boot/axios';
import { i18n } from '../boot/i18n';
import { lireToken, proprietaireDepuisToken } from '@/shared/services/session';
import { CLE_AFFECTATIONS, CLE_FILE_SEANCES, CLE_SALLES, clePour } from '@/shared/services/cles-stockage';
import {
  OPTIONS_SEANCES,
  ecrireFileHorsLigne,
  fileEnMemoire,
  idClient,
  lireFileHorsLigne,
} from '@/shared/services/file-hors-ligne';
import type { Affectation, Salle, Seance, TypeCours } from '../types';

export interface NouvelleSeance {
  affectationId: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  type: TypeCours;
  salleId: string | null;
  thematique?: string;
}

interface SeanceEnFile extends NouvelleSeance {
  idClient: string;
  enfileeLe: string;
  affectation: Affectation;
  salle: Salle | null;
}

const AGE_AFFECTATIONS_MAX = 24 * 60 * 60 * 1000;

/** Propriétaire du compte : c'est lui qui possède la file hors ligne. */
function proprietaire(): string {
  return proprietaireDepuisToken(lireToken());
}

function lireAffectations(owner: string): Affectation[] {
  if (!owner) return [];
  try {
    const cache = JSON.parse(localStorage.getItem(clePour(CLE_AFFECTATIONS, owner)) ?? 'null');
    if (Date.now() - new Date(cache?.enregistreesLe ?? '').getTime() > AGE_AFFECTATIONS_MAX) return [];
    return Array.isArray(cache?.data) ? cache.data : [];
  } catch {
    return [];
  }
}

function lireSalles(owner: string): Salle[] {
  if (!owner) return [];
  try {
    const cache = JSON.parse(localStorage.getItem(clePour(CLE_SALLES, owner)) ?? 'null');
    if (Date.now() - new Date(cache?.enregistreesLe ?? '').getTime() > AGE_AFFECTATIONS_MAX) return [];
    return Array.isArray(cache?.data) ? cache.data : [];
  } catch {
    return [];
  }
}

function erreurTransport(e: any) {
  return !e?.response || e.response.status >= 500;
}

export const useSeancesStore = defineStore('seancesHorsLigne', {
  state: () => {
    const owner = proprietaire();
    return {
      proprietaire: owner,
      // La file est chiffrée : elle a pu être déchiffrée avant le démarrage
      // de l'interface, sinon elle est relue à la première demande.
      file: fileEnMemoire<SeanceEnFile>(CLE_FILE_SEANCES, owner) ?? [],
      affectationsCache: lireAffectations(owner),
      sallesCache: lireSalles(owner),
      erreurs: {} as Record<string, string>,
      enLigne: navigator.onLine,
      synchronisation: false,
      erreurReseauSignalee: false,
      fileChargee: false,
    };
  },

  getters: {
    enAttente: (s) => s.file.length,
  },

  actions: {
    /**
     * Change de propriétaire sans attendre : un changement de compte ne doit
     * jamais laisser la file de l'ancien compte en mémoire.
     */
    rafraichirProprietaire() {
      const owner = proprietaire();
      if (owner === this.proprietaire) return;
      this.proprietaire = owner;
      this.file = [];
      this.affectationsCache = lireAffectations(owner);
      this.sallesCache = lireSalles(owner);
      this.erreurs = {};
      this.fileChargee = false;
    },

    /**
     * Relit la file du compte courant. Le déchiffrement est asynchrone : la
     * file est donc vide le temps de la lecture, et l'appelant qui veut la
     * file complète doit attendre `initialiser()`.
     */
    async chargerProprietaire() {
      this.rafraichirProprietaire();
      if (this.fileChargee) return;
      const owner = this.proprietaire;
      this.file = owner ? await lireFileHorsLigne<SeanceEnFile>(CLE_FILE_SEANCES, owner, [], OPTIONS_SEANCES) : [];
      this.fileChargee = true;
    },

    /** Point d'entrée explicite : la file est disponible une fois lisible. */
    async initialiser() {
      await this.chargerProprietaire();
    },

    enregistrerAffectations(affectations: Affectation[]) {
      this.rafraichirProprietaire();
      if (!this.proprietaire) return;
      this.affectationsCache = affectations;
      localStorage.setItem(
        clePour(CLE_AFFECTATIONS, this.proprietaire),
        JSON.stringify({
          enregistreesLe: new Date().toISOString(),
          data: affectations,
        }),
      );
    },

    enregistrerSalles(salles: Salle[]) {
      this.rafraichirProprietaire();
      if (!this.proprietaire) return;
      this.sallesCache = salles;
      localStorage.setItem(
        clePour(CLE_SALLES, this.proprietaire),
        JSON.stringify({
          enregistreesLe: new Date().toISOString(),
          data: salles,
        }),
      );
    },

    async persister() {
      if (!this.proprietaire) throw new Error('Session requise pour conserver une séance');
      await ecrireFileHorsLigne(CLE_FILE_SEANCES, this.proprietaire, this.file);
    },

    async creer(payload: NouvelleSeance, affectation: Affectation, salle: Salle | null) {
      await this.chargerProprietaire();
      if (!this.proprietaire) throw new Error(i18n.global.t('seances.offline.sessionRequired'));
      const entree: SeanceEnFile = {
        ...payload,
        idClient: idClient(),
        enfileeLe: new Date().toISOString(),
        affectation,
        salle,
      };

      if (navigator.onLine) {
        try {
          const { data } = await api.post('/seances/sync', {
            seances: [this.donneesServeur(entree)],
          });
          const resultat = data.resultats?.[0];
          if (!resultat?.ok)
            throw Object.assign(new Error(resultat?.erreur || i18n.global.t('seances.offline.rejected')), {
              metier: true,
            });
          return { id: resultat.id as string, enFile: false };
        } catch (e: any) {
          if (!erreurTransport(e) || e.metier) throw e;
        }
      }

      this.file = [...this.file, entree];
      await this.persister();
      Notify.create({ type: 'info', icon: 'cloud_off', message: i18n.global.t('seances.offline.queued') });
      return { id: entree.idClient, enFile: true };
    },

    donneesServeur(entree: SeanceEnFile) {
      const { affectation: _affectation, salle: _salle, enfileeLe: _enfileeLe, ...donnees } = entree;
      return donnees;
    },

    pourDate(date: string): Seance[] {
      void this.chargerProprietaire().catch(() => undefined);
      return this.file
        .filter((s) => s.date.slice(0, 10) === date)
        .map(
          (s) =>
            ({
              id: s.idClient,
              affectationId: s.affectationId,
              anneeId: s.affectation.anneeId,
              date: s.date,
              heureDebut: s.heureDebut,
              heureFin: s.heureFin,
              type: s.type,
              salleId: s.salleId,
              statut: 'PLANIFIE',
              thematique: s.thematique ?? null,
              affectation: s.affectation,
              salle: s.salle,
            }) as Seance,
        );
    },

    async synchroniser() {
      await this.chargerProprietaire();
      if (!this.file.length || this.synchronisation || !navigator.onLine) return;
      this.synchronisation = true;
      const owner = this.proprietaire;
      const envoyees = JSON.parse(JSON.stringify(this.file)) as SeanceEnFile[];
      try {
        const { data } = await api.post('/seances/sync', {
          seances: envoyees.map((entree) => this.donneesServeur(entree)),
        });
        const resultats: Array<{ idClient: string; ok: boolean; erreur?: string }> = data.resultats ?? [];
        const acceptees = new Map(
          envoyees
            .filter((e) => resultats.some((r) => r.idClient === e.idClient && r.ok))
            .map((e) => [e.idClient, JSON.stringify(e)]),
        );
        await this.chargerProprietaire();
        const file =
          owner === this.proprietaire
            ? this.file
            : await lireFileHorsLigne<SeanceEnFile>(CLE_FILE_SEANCES, owner, [], OPTIONS_SEANCES);
        const restantes = file.filter((e) => acceptees.get(e.idClient) !== JSON.stringify(e));
        await ecrireFileHorsLigne(CLE_FILE_SEANCES, owner, restantes);
        if (owner !== this.proprietaire) return data;
        this.file = restantes;
        this.erreurs = Object.fromEntries(resultats.filter((r) => !r.ok).map((r) => [r.idClient, r.erreur ?? '']));
        this.erreurReseauSignalee = false;
        if (acceptees.size || Object.keys(this.erreurs).length) {
          Notify.create({
            type: this.erreurs && Object.keys(this.erreurs).length ? 'warning' : 'positive',
            icon: 'cloud_done',
            message: i18n.global.t('seances.offline.synced', { ok: acceptees.size, total: envoyees.length }),
          });
        }
        return data;
      } catch (e: any) {
        if (!this.erreurReseauSignalee)
          Notify.create({
            type: 'warning',
            message: e.response?.data?.message || i18n.global.t('seances.offline.unavailable'),
          });
        this.erreurReseauSignalee = true;
        return { indisponible: true };
      } finally {
        this.synchronisation = false;
      }
    },

    async retirer(idClient: string) {
      await this.chargerProprietaire();
      this.file = this.file.filter((s) => s.idClient !== idClient);
      await this.persister();
    },
  },
});
