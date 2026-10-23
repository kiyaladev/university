import { defineStore } from 'pinia';
import { api } from '../boot/axios';
import { enrolerAppareilSiNecessaire } from '../services/empreinte';
import { ecrireToken, effacerToken, lireToken } from '../services/session';
import { useReferentielsStore } from './referentiels';
import type { Role, Utilisateur } from '../types';
import { roleAutorise, type Permission } from '../navigation/permissions';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: lireToken(),
    utilisateur: null as Utilisateur | null,
    chargement: false,
  }),

  getters: {
    connecte: (s) => !!s.token,
    role: (s): Role | null => s.utilisateur?.role ?? null,
    nomComplet: (s) =>
      s.utilisateur ? `${s.utilisateur.prenom} ${s.utilisateur.nom}` : '',
    initiales: (s) =>
      s.utilisateur
        ? `${s.utilisateur.prenom?.[0] ?? ''}${s.utilisateur.nom?.[0] ?? ''}`.toUpperCase()
        : '?',

    /** Vrai si l'utilisateur a l'un des rôles demandés. */
    aRole: (s) => (roles: Role[]) => !!s.utilisateur && roles.includes(s.utilisateur.role),

    /** Droit d'action de la matrice navigation/permissions.ts. */
    peut: (s) => (permission: Permission) => roleAutorise(s.utilisateur?.role, permission),

    /** Peut consigner un pointage en salle. */
    peutPointer: (s) => roleAutorise(s.utilisateur?.role, 'seances.pointer'),

    /** Peut modifier les référentiels et l'emploi du temps. */
    peutPlanifier: (s) => roleAutorise(s.utilisateur?.role, 'referentiels.planifier'),

    /**
     * Tenir l'emploi du temps : le contrôleur constate la réalité des créneaux
     * avant tout le monde, il peut donc en ouvrir et en corriger — mais cela ne
     * lui ouvre aucun autre référentiel.
     */
    peutTenirEmploiDuTemps: (s) => roleAutorise(s.utilisateur?.role, 'emploiDuTemps.tenir'),

    estAdmin: (s) => s.utilisateur?.role === 'ADMIN',
    estEnseignant: (s) => s.utilisateur?.role === 'ENSEIGNANT',
  },

  actions: {
    async connexion(email: string, password: string) {
      this.chargement = true;
      try {
        const { data } = await api.post('/auth/login', { email, password });
        // Nouveau compte : rien du cache de l'ancien ne doit lui être servi.
        useReferentielsStore().vider();
        this.token = data.token;
        this.utilisateur = data.user;
        ecrireToken(data.token);

        // Dans l'application Android, l'appareil réclame sa clé de signature
        // dès la première session : c'est elle qui rendra ses lectures
        // d'empreinte recevables, et elle seule pourra être révoquée.
        try {
          await enrolerAppareilSiNecessaire(
            `Appareil de ${data.user.prenom} ${data.user.nom}`,
          );
        } catch {
          // Un enrôlement raté ne doit pas empêcher d'entrer : le contrôleur
          // garde la signature et le code, et l'appareil réessaiera.
        }

        return data.user as Utilisateur;
      } finally {
        this.chargement = false;
      }
    },

    /**
     * Connexion du portail étudiant : le code reçu par SMS tient lieu de mot
     * de passe. Le jeton est stocké comme pour la connexion classique, puis
     * le profil est rechargé pour que la garde de routes voie le rôle.
     * Les erreurs sont gérées par la page (silencieux), pour ne pas être
     * déconnecté du portail par un code simplement faux.
     */
    async connexionOtp(telephone: string, code: string) {
      this.chargement = true;
      try {
        const { data } = await api.post(
          '/portail/otp/verifier',
          { telephone, code },
          { silencieux: true },
        );
        useReferentielsStore().vider();
        this.token = data.token;
        ecrireToken(data.token);
        await this.chargerProfil();
        return this.utilisateur;
      } finally {
        this.chargement = false;
      }
    },

    /** Recharge le profil à partir du jeton conservé (rafraîchissement de page). */
    async chargerProfil() {
      if (!this.token) return null;
      try {
        const { data } = await api.get('/auth/me');
        this.utilisateur = data;
        return data as Utilisateur;
      } catch {
        this.deconnexion();
        return null;
      }
    },

    async changerMotDePasse(ancien: string, nouveau: string) {
      await api.post('/auth/mot-de-passe', { ancien, nouveau });
    },

    deconnexion() {
      this.token = '';
      this.utilisateur = null;
      // Les référentiels peuvent dépendre du compte (périmètre d'un chef de
      // département) : ils ne doivent pas survivre à la session.
      useReferentielsStore().vider();
      effacerToken();
      if ('caches' in window) {
        void Promise.all(['unipresence-api', 'unipresence-api-v2'].map(name => caches.delete(name)));
      }
    },
  },
});
