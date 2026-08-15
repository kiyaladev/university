import { defineStore } from 'pinia';
import { api } from '../boot/axios';
import { enrolerAppareilSiNecessaire } from '../services/empreinte';
import type { Role, Utilisateur } from '../types';

const CLE_TOKEN = 'unipresence_token';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(CLE_TOKEN) ?? '',
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

    /** Peut consigner un pointage en salle. */
    peutPointer: (s) =>
      !!s.utilisateur &&
      ['CONTROLEUR', 'ADMIN', 'DIRECTION', 'CHEF_DEPARTEMENT'].includes(s.utilisateur.role),

    /** Peut modifier les référentiels et l'emploi du temps. */
    peutPlanifier: (s) =>
      !!s.utilisateur &&
      ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT'].includes(s.utilisateur.role),

    /**
     * Tenir l'emploi du temps : le contrôleur constate la réalité des créneaux
     * avant tout le monde, il peut donc en ouvrir et en corriger — mais cela ne
     * lui ouvre aucun autre référentiel.
     */
    peutTenirEmploiDuTemps: (s) =>
      !!s.utilisateur &&
      ['ADMIN', 'SCOLARITE', 'CHEF_DEPARTEMENT', 'CONTROLEUR'].includes(s.utilisateur.role),

    estAdmin: (s) => s.utilisateur?.role === 'ADMIN',
    estEnseignant: (s) => s.utilisateur?.role === 'ENSEIGNANT',
  },

  actions: {
    async connexion(email: string, password: string) {
      this.chargement = true;
      try {
        const { data } = await api.post('/auth/login', { email, password });
        this.token = data.token;
        this.utilisateur = data.user;
        localStorage.setItem(CLE_TOKEN, data.token);

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
          { silencieux: true } as never,
        );
        this.token = data.token;
        localStorage.setItem(CLE_TOKEN, data.token);
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
      localStorage.removeItem(CLE_TOKEN);
    },
  },
});
