import { i18n } from '../boot/i18n';
/**
 * File d'attente hors ligne. Dans les amphis, le réseau est souvent absent :
 * le contrôleur pointe quand même, les pointages sont conservés localement
 * puis renvoyés dès que la connexion revient.
 */
import { defineStore } from 'pinia';
import { Notify } from 'quasar';
import { api } from '../boot/axios';
import { useSeancesStore } from './seances';
import { lireToken } from '../services/session';
import { ecrireFileChiffree, lireFileChiffree } from '../services/file-chiffree';
import type { Pointage } from '../types';

const CLE_FILE = 'unipresence_file_pointages';
function proprietaire(): string {
  try { const token = lireToken(); const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return payload.sub || ''; }
  catch { return ''; }
}
function cleFile(owner: string): string { return `${CLE_FILE}_${owner}`; }
function lireErreurs(owner: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(`${cleFile(owner)}_erreurs`) || '{}'); } catch { return {}; }
}
function retirerPins(file: unknown[]): { file: Pointage[]; modifie: boolean } {
  let modifie = false;
  const securisee = file.filter((pointage): pointage is Pointage => Boolean(pointage) && typeof pointage === 'object').map((pointage) => {
    if (!('codePinEnseignant' in pointage)) return pointage;
    const { codePinEnseignant: _pin, ...sansSecret } = pointage as Pointage & { codePinEnseignant?: string };
    modifie = true;
    return sansSecret as Pointage;
  });
  return { file: securisee, modifie };
}
/**
 * Au-delà de ce délai, un pointage n'a plus de chance d'être accepté et n'a
 * plus à rester sur l'appareil : un téléphone de contrôleur perdu ne doit pas
 * être un stock de preuves d'attestation.
 */
const PEREMPTION_JOURS = 7;

async function lireFile(owner: string): Promise<Pointage[]> {
  if (!owner) return [];
  const file = await lireFileChiffree<unknown>(cleFile(owner), owner, []);
  if (!Array.isArray(file)) throw new Error(i18n.global.t('filePointages.chiffrement.invalidFormat'));
  const { file: sansSecrets, modifie: secretsRetires } = retirerPins(file);
  const limite = Date.now() - PEREMPTION_JOURS * 24 * 3600 * 1000;
  const retenus = sansSecrets.filter((p) => {
    const t = p.horodatage ? new Date(p.horodatage).getTime() : Date.now();
    return Number.isFinite(t) && t >= limite;
  });
  if (secretsRetires || retenus.length !== file.length) await ecrireFileChiffree(cleFile(owner), owner, retenus);
  return retenus;
}

export const usePointagesStore = defineStore('pointages', {
  state: () => ({
    proprietaire: proprietaire(),
    file: [],
    erreurs: lireErreurs(proprietaire()),
    ancienneFile: 0,
    fileChargee: false,
    erreurReseauSignalee: false,
    enLigne: navigator.onLine,
    synchronisation: false,
    generationReseau: 0,
  }),

  getters: {
    enAttente: (s) => s.file.length,
  },

  actions: {
    async initialiser() {
      await this.chargerProprietaire();
      const legacy = await lireFileChiffree<unknown>(CLE_FILE, 'ancienne-file-sans-proprietaire', []);
      if (Array.isArray(legacy)) {
        const securisee = retirerPins(legacy);
        this.ancienneFile = securisee.file.length;
        if (securisee.modifie) await ecrireFileChiffree(CLE_FILE, 'ancienne-file-sans-proprietaire', securisee.file);
      }
    },

    /**
     * Abonne le store aux changements de connectivité et renvoie la fonction
     * qui désabonne. Le listener doit pouvoir être retiré : le composant qui
     * appelle peut être démonté puis remonté, et chaque remontée ajoutait une
     * paire d'écouteurs qui rejouait `synchroniser()`.
     */
    ecouterReseau(): () => void {
      const enLigne = () => {
        this.enLigne = true;
        this.generationReseau++;
        this.erreurReseauSignalee = false;
        void this.synchroniser();
      };
      const horsLigne = () => {
        this.enLigne = false;
      };
      window.addEventListener('online', enLigne);
      window.addEventListener('offline', horsLigne);
      // Le Wi-Fi peut rester connecté pendant une panne de la passerelle :
      // navigator.onLine reste vrai et aucun nouvel événement online n'arrive.
      const reprise = window.setInterval(() => {
        this.enLigne = navigator.onLine;
        if (this.enLigne) void this.synchroniser();
      }, 30_000);
      return () => {
        window.removeEventListener('online', enLigne);
        window.removeEventListener('offline', horsLigne);
        window.clearInterval(reprise);
      };
    },

    async chargerProprietaire() {
      const owner = proprietaire();
      if (this.proprietaire !== owner || !this.fileChargee) {
        if (this.proprietaire !== owner) this.file = [];
        this.fileChargee = false;
        this.proprietaire = owner;
        this.file = await lireFile(owner);
        this.erreurs = lireErreurs(owner);
        this.fileChargee = true;
      }
    },

    async persister() {
      if (!this.proprietaire) throw new Error('Session requise pour conserver un pointage');
      await ecrireFileChiffree(cleFile(this.proprietaire), this.proprietaire, this.file);
      localStorage.setItem(`${cleFile(this.proprietaire)}_erreurs`, JSON.stringify(this.erreurs));
    },

    /**
     * Envoie le pointage ; en cas d'échec réseau il est mis en file d'attente.
     * Renvoie `true` si le serveur a accepté immédiatement.
     */
    async envoyer(pointage: Pointage): Promise<boolean> {
      if (!this.enLigne) {
        await this.mettreEnFile(pointage);
        return false;
      }
      try {
        // Silencieux : un échec réseau ou 5xx part dans la file (message « mis
        // en file ») ; une erreur métier est relancée et notifiée par l'appelant.
        await api.post('/controles', pointage, { silencieux: true });
        return true;
      } catch (e: any) {
        // Une erreur métier (400/403) ne doit pas être rejouée indéfiniment.
        if (e.response?.status && e.response.status < 500) throw e;
        await this.mettreEnFile(pointage);
        return false;
      }
    },

    async mettreEnFile(pointage: Pointage) {
      await this.chargerProprietaire();
      delete this.erreurs[pointage.seanceId];
      // Le code personnel est un secret réutilisable : il ne doit jamais être
      // écrit sur l'appareil, où il survivrait à la séance. Hors ligne, seules
      // la signature (qui est elle-même la preuve) et l'empreinte (dont le
      // résultat est signé par la passerelle) sont conservables.
      //
      // Le résultat d'empreinte n'est toutefois recevable que quelques minutes
      // (anti-rejeu côté serveur) et il est vérifié avant la signature : s'il
      // partait en file avec elle, une longue coupure ferait rejeter le
      // pointage. Accompagné d'une signature, seule celle-ci est conservée ;
      // seul, il part en file avec un avertissement.
      const { codePinEnseignant, ...conservable } = pointage;
      const sansSecret: Pointage = { ...conservable };
      if (sansSecret.empreinte && sansSecret.signatureBase64) delete sansSecret.empreinte;
      const perdu = Boolean(codePinEnseignant) && !sansSecret.signatureBase64;
      const empreinteSeule = Boolean(sansSecret.empreinte) && !sansSecret.signatureBase64;

      this.file = [
        ...this.file.filter((p) => p.seanceId !== pointage.seanceId),
        {
          ...sansSecret,
          horsLigne: true,
          horodatage: pointage.horodatage ?? new Date().toISOString(),
        },
      ];
      await this.persister();

      const avertir = perdu || empreinteSeule;
      Notify.create({
        type: avertir ? 'warning' : 'info',
        message: perdu
          ? i18n.global.t('filePointages.withoutPin')
          : empreinteSeule
            ? i18n.global.t('filePointages.fingerprintOnly')
            : i18n.global.t('filePointages.queued'),
        caption: perdu
          ? i18n.global.t('filePointages.pinHelp')
          : empreinteSeule
            ? i18n.global.t('filePointages.fingerprintHelp')
            : undefined,
        icon: 'cloud_off',
        timeout: avertir ? 8000 : undefined,
      });
    },

    async synchroniser() {
      await this.chargerProprietaire();
      if (this.synchronisation || !this.enLigne) return;
      this.synchronisation = true;
      const owner = this.proprietaire;
      const generation = this.generationReseau;
      try {
        // Les pointages peuvent référencer une séance créée hors ligne : le
        // serveur doit connaître cette séance avant de recevoir le contrôle.
        await useSeancesStore().synchroniser();
        await this.chargerProprietaire();
        if (owner !== this.proprietaire || !this.file.length) return;
        const envoyes = JSON.parse(JSON.stringify(this.file)) as Pointage[];
        // Silencieux : la file reste intacte et le catch prévient une seule fois.
        const { data } = await api.post('/controles/sync', { pointages: envoyes }, { silencieux: true });
        const echecs = new Set((data.echecs ?? []).map((e: any) => e.seanceId));
        const acceptes = new Map(envoyes.filter(p => !echecs.has(p.seanceId)).map(p => [p.seanceId, JSON.stringify(p)]));
        // Une modification ajoutée pendant l'envoi doit rester à synchroniser.
        // Un changement de compte ne doit jamais déplacer la file vers ce compte.
        await this.chargerProprietaire();
        const file = owner === this.proprietaire ? this.file : await lireFile(owner);
        const restants = file.filter(p => acceptes.get(p.seanceId) !== JSON.stringify(p));
        await ecrireFileChiffree(cleFile(owner), owner, restants);
        const erreurs = Object.fromEntries((data.echecs ?? []).map((e: any) => [e.seanceId, e.erreur]));
        localStorage.setItem(`${cleFile(owner)}_erreurs`, JSON.stringify(erreurs));
        if (owner !== this.proprietaire) return data;
        this.file = restants;
        const erreursChangees = JSON.stringify(this.erreurs) !== JSON.stringify(erreurs);
        this.erreurs = erreurs;
        this.erreurReseauSignalee = false;

        if (data.synchronises || erreursChangees) Notify.create({
          type: data.synchronises ? 'positive' : 'warning',
          message: i18n.global.t('filePointages.synced', { synced: data.synchronises, total: data.recus }),
          caption: data.echecs?.length ? i18n.global.t('filePointages.failed', { n: data.echecs.length }) : undefined,
          icon: 'cloud_done',
        });
        return data;
      } catch (error: any) {
        // La file reste intacte ; l'écouteur online n'émet pas de rejet non traité.
        if (!this.erreurReseauSignalee) Notify.create({ type: 'warning', message: error.response?.data?.message || i18n.global.t('filePointages.unavailable') });
        this.erreurReseauSignalee = true;
        return { indisponible: true };
      } finally {
        this.synchronisation = false;
        // Le réseau peut revenir pendant qu'un envoi hors ligne attend son
        // timeout. L'événement online doit encore déclencher un nouvel essai.
        if (this.enLigne && this.file.length && generation !== this.generationReseau) {
          void this.synchroniser();
        }
      }
    },

    async vider() {
      this.file = [];
      this.erreurs = {};
      await this.persister();
    },

    async retirer(seanceId: string) {
      await this.chargerProprietaire();
      this.file = this.file.filter(pointage => pointage.seanceId !== seanceId);
      delete this.erreurs[seanceId];
      await this.persister();
    },
  },
});
