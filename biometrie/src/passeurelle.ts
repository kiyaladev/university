/**
 * Passerelle biométrique : le service HTTP qui relie le lecteur au poste.
 *
 * Elle n'expose que trois routes (`/etat`, `/enroler`, `/verifier`) et ne
 * touche jamais au matériel : elle passe la main au pilote, puis signe ce qu'il
 * a rendu. La signature est celle que l'API vérifie — c'est tout ce qui
 * distingue une vraie lecture d'une affirmation.
 *
 * Le service est écrit comme une fabrique pour que les tests puissent le
 * monter à volonté : horloge, pilote, registre anti-rejeu et configuration sont
 * injectés.
 */
import { RegistreAntiRejeu } from './anti-rejeu';
import type { ConfigurationPasserelle } from './configuration';
import { langueDepuisEntete, t, type Langue } from './messages';
import type { PiloteLecteur } from './pilote';
import {
  chargeEnrolement,
  chargeVerification,
  empreinteGabarit,
  horodatageAcceptable,
  signer,
} from './signature';

export const VERSION_PASSERELLE = '1.1.0';

export interface OptionsPasserelle {
  configuration: ConfigurationPasserelle;
  pilote: PiloteLecteur;
  /** Registre anti-rejeu : un résultat déjà signé ne l'est plus. */
  registre?: RegistreAntiRejeu;
  /** Horloge, injectable pour les tests. */
  horloge?: () => number;
  /** Simuler un doigt qui n'est pas celui de l'enseignant. */
  doigtSimule?: boolean;
}

export interface Passerelle {
  fetch: (req: Request) => Promise<Response>;
  registre: RegistreAntiRejeu;
}

/** L'origine de la requête est-elle autorisée à appeler la passerelle ? */
export function origineAutorisee(origine: string | null, origines: string[]): boolean {
  // Pas d'en-tête Origin : ce n'est pas un appel de navigateur (application
  // native, script local). Le contrôle d'origine ne s'applique pas.
  if (!origine) return true;
  if (origines.includes('*')) return true;
  return origines.includes(origine);
}

function enTetes(origine: string | null, configuration: ConfigurationPasserelle): Headers {
  const enTetes = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    // Une preuve biométrique ne doit jamais être conservée par un cache.
    'Cache-Control': 'no-store',
  });
  if (origine && origineAutorisee(origine, configuration.origines)) {
    enTetes.set('Access-Control-Allow-Origin', origine);
    enTetes.set('Vary', 'Origin');
  }
  return enTetes;
}

function json(corps: unknown, origine: string | null, configuration: ConfigurationPasserelle, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: enTetes(origine, configuration),
  });
}

async function lireCorps(req: Request): Promise<Record<string, unknown>> {
  try {
    const corps = await req.json();
    return corps && typeof corps === 'object' ? (corps as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Assemble la passerelle : configuration, pilote, registre anti-rejeu. */
export function creerPasserelle(options: OptionsPasserelle): Passerelle {
  const { configuration, pilote } = options;
  const registre = options.registre ?? new RegistreAntiRejeu();
  const horloge = options.horloge ?? Date.now;

  const signerResultat = (charge: string) => signer(configuration.secret, charge);

  async function fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const origine = req.headers.get('origin');
    const langue: Langue = langueDepuisEntete(req.headers.get('accept-language')) ?? configuration.langue;

    // Origine non autorisée : la passerelle pilote du matériel, elle ne répond
    // pas à une page qui n'est pas l'application. Le CORS seul ne suffirait
    // pas : la requête serait exécutée quand même, la lecture déclenchée.
    if (!origineAutorisee(origine, configuration.origines)) {
      return json({ erreur: t('erreur.requeteInvalide', langue) }, null, configuration, 403);
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: enTetes(origine, configuration) });
    }

    // --- état du lecteur : interrogé par l'écran de pointage
    if (url.pathname === '/etat') {
      return json(
        {
          pret: true,
          // Le nom du pilote, repris par l'interface sous les deux noms.
          lecteur: pilote.nom,
          pilote: pilote.nom,
          simule: pilote.simule,
          seuil: configuration.scoreMin,
          mode: configuration.mode,
          appareilId: configuration.appareil?.appareilId ?? null,
          version: VERSION_PASSERELLE,
        },
        origine,
        configuration,
      );
    }

    // --- enrôlement : capture le doigt de référence d'un enseignant
    if (url.pathname === '/enroler' && req.method === 'POST') {
      const corps = await lireCorps(req);
      const enseignantId = String(corps.enseignantId ?? '').trim();
      if (!enseignantId) {
        return json({ erreur: t('erreur.enseignantIdRequis', langue) }, origine, configuration, 400);
      }

      try {
        const capture = await pilote.capturer();
        const horodatage = new Date(horloge()).toISOString();
        if (!horodatageAcceptable(horodatage, horloge())) {
          return json({ erreur: t('erreur.horodatageHorsFenetre', langue) }, origine, configuration, 500);
        }

        const charge = chargeEnrolement({
          appareilId: configuration.appareil?.appareilId ?? null,
          enseignantId,
          template: capture.template,
          horodatage,
        });
        if (registre.dejaSignee(charge)) {
          return json({ erreur: t('erreur.rejeu', langue) }, origine, configuration, 409);
        }
        registre.enregistrerCharge(charge);

        return json(
          {
            template: capture.template,
            qualite: capture.qualite,
            doigt: capture.doigt ?? 'index droit',
            horodatage,
            signature: signerResultat(charge),
            // L'API a besoin de savoir quel appareil a signé pour choisir la
            // clé qu'elle vérifiera.
            appareilId: configuration.appareil?.appareilId ?? null,
          },
          origine,
          configuration,
        );
      } catch (e: any) {
        return json({ erreur: e?.message ?? t('erreur.lectureImpossible', langue) }, origine, configuration, 503);
      }
    }

    // --- vérification en salle : compare le doigt posé au gabarit enrôlé
    if (url.pathname === '/verifier' && req.method === 'POST') {
      const corps = await lireCorps(req);
      const enseignantId = String(corps.enseignantId ?? '').trim();
      // L'interface appelle « gabarit », la passerelle parle de « template ».
      const gabarit = String(corps.gabarit ?? corps.template ?? '').trim();
      const tentativeId = corps.tentativeId ? String(corps.tentativeId) : null;

      if (!enseignantId || !gabarit) {
        return json({ erreur: t('erreur.gabaritRequis', langue) }, origine, configuration, 400);
      }

      // Une tentative déjà traitée est un rejeu de la même requête.
      if (tentativeId && registre.dejaTraitee(tentativeId)) {
        return json({ erreur: t('erreur.rejeu', langue) }, origine, configuration, 409);
      }

      try {
        // Le simulateur reproduit le doigt attendu ; un vrai lecteur, lui,
        // capture ce que l'enseignant pose réellement.
        pilote.preparerDoigt?.(options.doigtSimule ? null : gabarit);

        const capture = await pilote.capturer();
        const score = await pilote.comparer(gabarit, capture.template);
        const horodatage = new Date(horloge()).toISOString();
        if (!horodatageAcceptable(horodatage, horloge())) {
          return json({ erreur: t('erreur.horodatageHorsFenetre', langue) }, origine, configuration, 500);
        }

        const charge = chargeVerification({
          appareilId: configuration.appareil?.appareilId ?? null,
          enseignantId,
          gabarit: empreinteGabarit(gabarit),
          score,
          horodatage,
        });
        if (registre.dejaSignee(charge)) {
          return json({ erreur: t('erreur.rejeu', langue) }, origine, configuration, 409);
        }
        registre.enregistrerCharge(charge);
        if (tentativeId) registre.enregistrerTentative(tentativeId);

        return json(
          {
            score,
            correspond: score >= configuration.scoreMin,
            qualite: capture.qualite,
            horodatage,
            // L'API rejettera tout résultat dont la signature ne correspond pas,
            // ou dont le gabarit comparé n'est pas celui qu'elle a enrôlé.
            signature: signerResultat(charge),
            appareilId: configuration.appareil?.appareilId ?? null,
          },
          origine,
          configuration,
        );
      } catch (e: any) {
        return json({ erreur: e?.message ?? t('erreur.lectureImpossible', langue) }, origine, configuration, 503);
      }
    }

    return json({ erreur: t('erreur.routeInconnue', langue) }, origine, configuration, 404);
  }

  return { fetch, registre };
}
