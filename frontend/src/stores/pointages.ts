/**
 * File d'attente hors ligne. Dans les amphis, le réseau est souvent absent :
 * le contrôleur pointe quand même, les pointages sont conservés localement
 * puis renvoyés dès que la connexion revient.
 */
import { defineStore } from 'pinia';
import { Notify } from 'quasar';
import { api } from '../boot/axios';
import type { Pointage } from '../types';

const CLE_FILE = 'unipresence_file_pointages';

/**
 * Au-delà de ce délai, un pointage n'a plus de chance d'être accepté et n'a
 * plus à rester sur l'appareil : un téléphone de contrôleur perdu ne doit pas
 * être un stock de preuves d'attestation.
 */
const PEREMPTION_JOURS = 7;

function lireFile(): Pointage[] {
  try {
    const file: Pointage[] = JSON.parse(localStorage.getItem(CLE_FILE) ?? '[]');
    const limite = Date.now() - PEREMPTION_JOURS * 24 * 3600 * 1000;
    const retenus = file.filter((p) => {
      const t = p.horodatage ? new Date(p.horodatage).getTime() : Date.now();
      return Number.isFinite(t) && t >= limite;
    });
    if (retenus.length !== file.length) {
      localStorage.setItem(CLE_FILE, JSON.stringify(retenus));
    }
    return retenus;
  } catch {
    return [];
  }
}

export const usePointagesStore = defineStore('pointages', {
  state: () => ({
    file: lireFile(),
    enLigne: navigator.onLine,
    synchronisation: false,
  }),

  getters: {
    enAttente: (s) => s.file.length,
  },

  actions: {
    ecouterReseau() {
      window.addEventListener('online', () => {
        this.enLigne = true;
        void this.synchroniser();
      });
      window.addEventListener('offline', () => {
        this.enLigne = false;
      });
    },

    persister() {
      localStorage.setItem(CLE_FILE, JSON.stringify(this.file));
    },

    /**
     * Envoie le pointage ; en cas d'échec réseau il est mis en file d'attente.
     * Renvoie `true` si le serveur a accepté immédiatement.
     */
    async envoyer(pointage: Pointage): Promise<boolean> {
      if (!this.enLigne) {
        this.mettreEnFile(pointage);
        return false;
      }
      try {
        await api.post('/controles', pointage);
        return true;
      } catch (e: any) {
        // Une erreur métier (400/403) ne doit pas être rejouée indéfiniment.
        if (e.response?.status && e.response.status < 500) throw e;
        this.mettreEnFile(pointage);
        return false;
      }
    },

    mettreEnFile(pointage: Pointage) {
      // Le code personnel est un secret réutilisable : il ne doit jamais être
      // écrit sur l'appareil, où il survivrait à la séance. Hors ligne, seules
      // la signature (qui est elle-même la preuve) et l'empreinte (dont le
      // résultat est signé par la passerelle) sont conservables.
      const { codePinEnseignant, ...sansSecret } = pointage;
      const perdu = Boolean(codePinEnseignant) && !sansSecret.signatureBase64;

      this.file = [
        ...this.file.filter((p) => p.seanceId !== pointage.seanceId),
        {
          ...sansSecret,
          horsLigne: true,
          horodatage: pointage.horodatage ?? new Date().toISOString(),
        },
      ];
      this.persister();

      Notify.create({
        type: perdu ? 'warning' : 'info',
        message: perdu
          ? 'Pointage mis en attente sans le code — faites signer l’enseignant'
          : 'Pointage enregistré hors ligne — il sera synchronisé automatiquement',
        caption: perdu
          ? 'Le code ne peut être vérifié qu’en ligne et n’est pas conservé sur l’appareil.'
          : undefined,
        icon: 'cloud_off',
        timeout: perdu ? 8000 : undefined,
      });
    },

    async synchroniser() {
      if (!this.file.length || this.synchronisation || !this.enLigne) return;
      this.synchronisation = true;
      try {
        const { data } = await api.post('/controles/sync', { pointages: this.file });
        const echecs = new Set((data.echecs ?? []).map((e: any) => e.seanceId));
        this.file = this.file.filter((p) => echecs.has(p.seanceId));
        this.persister();

        Notify.create({
          type: data.synchronises ? 'positive' : 'warning',
          message: `${data.synchronises}/${data.recus} pointage(s) synchronisé(s)`,
          caption: data.echecs?.length ? `${data.echecs.length} en échec` : undefined,
          icon: 'cloud_done',
        });
        return data;
      } finally {
        this.synchronisation = false;
      }
    },

    vider() {
      this.file = [];
      this.persister();
    },
  },
});
