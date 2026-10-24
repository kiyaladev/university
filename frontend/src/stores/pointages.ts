import { i18n } from '../boot/i18n';
/**
 * File d'attente hors ligne. Dans les amphis, le réseau est souvent absent :
 * le contrôleur pointe quand même, les pointages sont conservés localement
 * puis renvoyés dès que la connexion revient.
 */
import { defineStore } from 'pinia';
import { Notify } from 'quasar';
import axios from 'axios';
import { api } from '../boot/axios';
import { useSeancesStore } from './seances';
import { lireToken, proprietaireDepuisToken } from '@/shared/services/session';
import { CLE_FILE_POINTAGES, clePour } from '@/shared/services/cles-stockage';
import {
  OPTIONS_POINTAGES,
  echecDefinitif,
  ecrireFileHorsLigne,
  idClient,
  lireFileHorsLigne,
  type EchecSynchronisation,
} from '@/shared/services/file-hors-ligne';
import { extraireMessageErreur } from '@/shared/utils/erreur-http';
import type { Pointage } from '../types';

const CLE_FILE = CLE_FILE_POINTAGES;

/**
 * Pointage en file : l'identifiant client est créé sur l'appareil.
 *
 * Un pointage hors ligne peut être renvoyé après une réponse perdue. Le même
 * identifiant prouve à l'API qu'il s'agit du même pointage : le renvoi est
 * alors idempotent, au lieu d'être refusé comme un rejeu de preuve.
 */
export type PointageFile = Pointage & { idClient?: string };

/** État du store : la file est typée, sinon TypeScript en déduit `never[]`. */
interface EtatPointages {
  proprietaire: string;
  file: PointageFile[];
  erreurs: Record<string, string | undefined>;
  ancienneFile: number;
  fileChargee: boolean;
  erreurReseauSignalee: boolean;
  enLigne: boolean;
  synchronisation: boolean;
  generationReseau: number;
}

/** Réponse de `POST /controles/sync` : chaque pointage est accepté ou rejeté. */
interface ResultatSyncPointages {
  recus?: number;
  synchronises?: number;
  echecs?: EchecSynchronisation[];
}

function proprietaire(): string {
  return proprietaireDepuisToken(lireToken());
}

function cleFile(owner: string): string {
  return clePour(CLE_FILE, owner);
}

function lireErreurs(owner: string): Record<string, string | undefined> {
  try {
    return JSON.parse(localStorage.getItem(`${cleFile(owner)}_erreurs`) || '{}');
  } catch {
    return {};
  }
}

async function lireFile(owner: string): Promise<PointageFile[]> {
  if (!owner) return [];
  return lireFileHorsLigne<PointageFile>(CLE_FILE, owner, [], OPTIONS_POINTAGES);
}

export const usePointagesStore = defineStore('pointages', {
  state: (): EtatPointages => ({
    proprietaire: proprietaire(),
    file: [] as PointageFile[],
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
      // Ancienne file, sans propriétaire : elle n'appartient plus à personne,
      // mais son contenu est repris pour être chiffré et purgé de ses secrets.
      const legacy = await lireFileHorsLigne<Pointage>(
        CLE_FILE,
        'ancienne-file-sans-proprietaire',
        [],
        OPTIONS_POINTAGES,
      );
      if (Array.isArray(legacy)) this.ancienneFile = legacy.length;
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
      await ecrireFileHorsLigne(CLE_FILE, this.proprietaire, this.file);
      localStorage.setItem(`${cleFile(this.proprietaire)}_erreurs`, JSON.stringify(this.erreurs));
    },

    /**
     * Envoie le pointage ; en cas d'échec réseau il est mis en file d'attente.
     * Renvoie `true` si le serveur a accepté immédiatement.
     */
    async envoyer(pointage: PointageFile): Promise<boolean> {
      // L'identifiant client est posé AVANT le premier envoi : si la réponse
      // se perd, le renvoi hors ligne portera le même identifiant et l'API
      // reconnaîtra le même pointage au lieu de le refuser comme un rejeu.
      const prepare: PointageFile = { ...pointage, idClient: pointage.idClient ?? idClient() };
      if (!this.enLigne) {
        await this.mettreEnFile(prepare);
        return false;
      }
      try {
        // Silencieux : un échec réseau ou 5xx part dans la file (message « mis
        // en file ») ; une erreur métier est relancée et notifiée par l'appelant.
        await api.post('/controles', prepare, { silencieux: true });
        return true;
      } catch (e: unknown) {
        // Une erreur métier (400/403) ne doit pas être rejouée indéfiniment.
        const statut = axios.isAxiosError(e) ? e.response?.status : undefined;
        if (statut !== undefined && statut < 500) throw e;
        await this.mettreEnFile(prepare);
        return false;
      }
    },

    async mettreEnFile(pointage: PointageFile) {
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
      const sansSecret: PointageFile = { ...conservable };
      if (sansSecret.empreinte && sansSecret.signatureBase64) delete sansSecret.empreinte;
      const perdu = Boolean(codePinEnseignant) && !sansSecret.signatureBase64;
      const empreinteSeule = Boolean(sansSecret.empreinte) && !sansSecret.signatureBase64;

      this.file = [
        ...this.file.filter((p) => p.seanceId !== pointage.seanceId),
        {
          ...sansSecret,
          // L'identifiant client suit le pointage : le renvoi doit porter le
          // même, sinon l'API ne peut pas reconnaître le pointage renvoyé.
          idClient: sansSecret.idClient ?? idClient(),
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
        const envoyes = JSON.parse(JSON.stringify(this.file)) as PointageFile[];
        // Silencieux : la file reste intacte et le catch prévient une seule fois.
        const { data } = await api.post<ResultatSyncPointages>(
          '/controles/sync',
          { pointages: envoyes },
          { silencieux: true },
        );
        const echecs = data.echecs ?? [];
        // Un échec définitif (preuve déjà consommée) ne aboutira jamais : le
        // pointage est retiré de la file au lieu d'être réessayé sans fin.
        const definitifs = new Set(echecs.filter(echecDefinitif).map((e) => e.seanceId));
        const enEchec = new Set(echecs.map((e) => e.seanceId));
        const acceptes = new Map(
          envoyes.filter((p) => !enEchec.has(p.seanceId)).map((p) => [p.seanceId, JSON.stringify(p)]),
        );
        // Une modification ajoutée pendant l'envoi doit rester à synchroniser.
        // Un changement de compte ne doit jamais déplacer la file vers ce compte.
        await this.chargerProprietaire();
        const file = owner === this.proprietaire ? this.file : await lireFile(owner);
        const restants = file.filter(
          (p) => !definitifs.has(p.seanceId) && acceptes.get(p.seanceId) !== JSON.stringify(p),
        );
        await ecrireFileHorsLigne(CLE_FILE, owner, restants);
        const erreurs = Object.fromEntries(
          echecs.filter((e) => !definitifs.has(e.seanceId)).map((e) => [e.seanceId, e.erreur ?? '']),
        );
        localStorage.setItem(`${cleFile(owner)}_erreurs`, JSON.stringify(erreurs));
        if (owner !== this.proprietaire) return data;
        this.file = restants;
        const erreursChangees = JSON.stringify(this.erreurs) !== JSON.stringify(erreurs);
        this.erreurs = erreurs;
        this.erreurReseauSignalee = false;

        if (data.synchronises || erreursChangees)
          Notify.create({
            type: data.synchronises ? 'positive' : 'warning',
            message: i18n.global.t('filePointages.synced', { synced: data.synchronises, total: data.recus }),
            // Les échecs définitifs ne sont plus en file : ils ne sont pas
            // comptés comme des échecs en attente.
            caption:
              echecs.length - definitifs.size
                ? i18n.global.t('filePointages.failed', { n: echecs.length - definitifs.size })
                : undefined,
            icon: 'cloud_done',
          });
        if (definitifs.size)
          Notify.create({
            type: 'warning',
            message: i18n.global.t('filePointages.proofUsed', { n: definitifs.size }),
            caption: i18n.global.t('filePointages.proofUsedHelp'),
            icon: 'fingerprint',
            timeout: 8000,
          });
        return data;
      } catch (error: unknown) {
        // La file reste intacte ; l'écouteur online n'émet pas de rejet non traité.
        const reponse = axios.isAxiosError(error) ? error.response : undefined;
        const messageErreur = extraireMessageErreur(reponse?.data);
        if (!this.erreurReseauSignalee)
          Notify.create({
            type: 'warning',
            message: Array.isArray(messageErreur)
              ? messageErreur.join(' · ')
              : messageErreur || i18n.global.t('filePointages.unavailable'),
          });
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
      this.file = this.file.filter((pointage) => pointage.seanceId !== seanceId);
      delete this.erreurs[seanceId];
      await this.persister();
    },
  },
});
