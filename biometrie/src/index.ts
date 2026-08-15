/**
 * Passerelle biométrique UniPrésence.
 *
 * Tourne sur l'appareil du contrôleur (PC, tablette, ou téléphone Android via
 * Termux avec un lecteur en OTG). Le navigateur l'appelle en local ; elle pilote
 * le lecteur et signe ses résultats, de sorte que l'API puisse faire la
 * différence entre une vraie lecture et un client qui prétendrait avoir vérifié.
 */
import { createHash, createHmac } from 'node:crypto';
import { PiloteSimulateur } from './pilotes/simulateur';
import type { PiloteLecteur } from './pilote';

const PORT = Number(process.env.PORT ?? 5044);
const SECRET = process.env.BIOMETRIE_SECRET ?? 'change-me-biometrie';
const ORIGINES = (process.env.ORIGINES ?? '*').split(',').map((o) => o.trim());
const SEUIL = Number(process.env.SCORE_MIN ?? 60);

// Remplacer par le pilote du lecteur réellement branché (voir README).
const pilote: PiloteLecteur = new PiloteSimulateur();
await pilote.initialiser();

function signer(charge: string) {
  return createHmac('sha256', SECRET).update(charge).digest('hex');
}

/** Empreinte numérique du gabarit comparé : elle est incluse dans la signature
 *  pour que l'API vérifie que la comparaison a bien porté sur le gabarit
 *  qu'elle a enrôlé, et non sur un gabarit fourni par le client. */
function empreinteGabarit(template: string) {
  return createHash('sha256').update(template).digest('hex');
}

function entetes(origine: string | null) {
  const autorisee =
    ORIGINES.includes('*') || (origine && ORIGINES.includes(origine)) ? (origine ?? '*') : '';
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': autorisee || 'null',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

function json(corps: unknown, origine: string | null, statut = 200) {
  return new Response(JSON.stringify(corps), { status: statut, headers: entetes(origine) });
}

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',

  async fetch(req) {
    const url = new URL(req.url);
    const origine = req.headers.get('origin');

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: entetes(origine) });
    }

    // --- état du lecteur : interrogé par l'écran de pointage
    if (url.pathname === '/etat') {
      return json({ pret: true, pilote: pilote.nom, seuil: SEUIL, version: '1.0.0' }, origine);
    }

    // --- enrôlement : capture le doigt de référence d'un enseignant
    if (url.pathname === '/enroler' && req.method === 'POST') {
      const { enseignantId } = (await req.json()) as { enseignantId?: string };
      if (!enseignantId) return json({ erreur: 'enseignantId requis' }, origine, 400);

      try {
        const capture = await pilote.capturer();
        const horodatage = new Date().toISOString();
        return json(
          {
            template: capture.template,
            qualite: capture.qualite,
            horodatage,
            signature: signer(`enrolement|${enseignantId}|${capture.template}|${horodatage}`),
          },
          origine,
        );
      } catch (e: any) {
        return json({ erreur: e?.message ?? 'Lecture impossible' }, origine, 503);
      }
    }

    // --- vérification en salle : compare le doigt posé au gabarit enrôlé
    if (url.pathname === '/verifier' && req.method === 'POST') {
      const { enseignantId, template } = (await req.json()) as {
        enseignantId?: string;
        template?: string;
      };
      if (!enseignantId || !template) {
        return json({ erreur: 'enseignantId et template requis' }, origine, 400);
      }

      try {
        // Le simulateur reproduit le doigt attendu ; un vrai lecteur, lui,
        // capture ce que l'enseignant pose réellement.
        if (pilote instanceof PiloteSimulateur) {
          pilote.preparerDoigt(process.env.DOIGT_SIMULE === 'inconnu' ? null : template);
        }

        const capture = await pilote.capturer();
        const score = await pilote.comparer(template, capture.template);
        const horodatage = new Date().toISOString();
        const gabarit = empreinteGabarit(template);

        return json(
          {
            score,
            correspond: score >= SEUIL,
            qualite: capture.qualite,
            horodatage,
            // L'API rejettera tout résultat dont la signature ne correspond pas,
            // ou dont le gabarit comparé n'est pas celui qu'elle a enrôlé.
            signature: signer(`verification|${enseignantId}|${gabarit}|${score}|${horodatage}`),
          },
          origine,
        );
      } catch (e: any) {
        return json({ erreur: e?.message ?? 'Lecture impossible' }, origine, 503);
      }
    }

    return json({ erreur: 'Route inconnue' }, origine, 404);
  },
});

console.log(`[biometrie] passerelle à l'écoute sur http://127.0.0.1:${PORT} (pilote : ${pilote.nom})`);
