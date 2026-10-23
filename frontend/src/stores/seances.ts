import { defineStore } from 'pinia';
import { Notify } from 'quasar';
import { api } from '../boot/axios';
import { i18n } from '../boot/i18n';
import { lireToken } from '@/shared/services/session';
import { normaliserJetonsStatuts } from '@/shared/utils/statuts';
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

const CLE = 'unipresence_file_seances';
const CLE_AFFECTATIONS = 'unipresence_affectations_tournee';
const CLE_SALLES = 'unipresence_salles_tournee';
const PEREMPTION_JOURS = 7;
const AGE_AFFECTATIONS_MAX = 24 * 60 * 60 * 1000;

function proprietaire(): string {
  try {
    const payload = JSON.parse(atob(lireToken().split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.sub || '';
  } catch {
    return '';
  }
}

function clePour(prefixe: string, owner: string) {
  return `${prefixe}_${owner}`;
}

function idClient(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const octets = new Uint8Array(16);
  globalThis.crypto.getRandomValues(octets);
  octets[6] = (octets[6] & 0x0f) | 0x40;
  octets[8] = (octets[8] & 0x3f) | 0x80;
  const h = [...octets].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function lireFile(owner: string): SeanceEnFile[] {
  if (!owner) return [];
  try {
    const file: unknown = JSON.parse(localStorage.getItem(clePour(CLE, owner)) ?? '[]');
    if (!Array.isArray(file)) return [];
    const limite = Date.now() - PEREMPTION_JOURS * 24 * 60 * 60 * 1000;
    const retenues = file.filter((s: any) => {
      const date = new Date(s?.enfileeLe ?? '').getTime();
      return Number.isFinite(date) && date >= limite && typeof s.idClient === 'string';
    });
    // Jetons d'état : la file peut dater d'avant l'harmonisation des statuts.
    // On convertit à la lecture et on réécrit le fichier (migration de la
    // file), faute de quoi le serveur refuserait la valeur.
    const converties = normaliserJetonsStatuts(retenues) as SeanceEnFile[];
    if (retenues.length !== file.length || JSON.stringify(converties) !== JSON.stringify(retenues))
      localStorage.setItem(clePour(CLE, owner), JSON.stringify(converties));
    return converties;
  } catch {
    return [];
  }
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
  state: () => ({
    proprietaire: proprietaire(),
    file: lireFile(proprietaire()),
    affectationsCache: lireAffectations(proprietaire()),
    sallesCache: lireSalles(proprietaire()),
    erreurs: {} as Record<string, string>,
    enLigne: navigator.onLine,
    synchronisation: false,
    erreurReseauSignalee: false,
  }),

  getters: {
    enAttente: (s) => s.file.length,
  },

  actions: {
    chargerProprietaire() {
      const owner = proprietaire();
      if (owner === this.proprietaire) return;
      this.proprietaire = owner;
      this.file = lireFile(owner);
      this.affectationsCache = lireAffectations(owner);
      this.sallesCache = lireSalles(owner);
      this.erreurs = {};
    },

    enregistrerAffectations(affectations: Affectation[]) {
      this.chargerProprietaire();
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
      this.chargerProprietaire();
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

    persister() {
      if (!this.proprietaire) throw new Error('Session requise pour conserver une séance');
      localStorage.setItem(clePour(CLE, this.proprietaire), JSON.stringify(this.file));
    },

    async creer(payload: NouvelleSeance, affectation: Affectation, salle: Salle | null) {
      this.chargerProprietaire();
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
      this.persister();
      Notify.create({ type: 'info', icon: 'cloud_off', message: i18n.global.t('seances.offline.queued') });
      return { id: entree.idClient, enFile: true };
    },

    donneesServeur(entree: SeanceEnFile) {
      const { affectation: _affectation, salle: _salle, enfileeLe: _enfileeLe, ...donnees } = entree;
      return donnees;
    },

    pourDate(date: string): Seance[] {
      this.chargerProprietaire();
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
      this.chargerProprietaire();
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
        this.chargerProprietaire();
        const file = owner === this.proprietaire ? this.file : lireFile(owner);
        const restantes = file.filter((e) => acceptees.get(e.idClient) !== JSON.stringify(e));
        localStorage.setItem(clePour(CLE, owner), JSON.stringify(restantes));
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

    retirer(idClient: string) {
      this.chargerProprietaire();
      this.file = this.file.filter((s) => s.idClient !== idClient);
      this.persister();
    },
  },
});
