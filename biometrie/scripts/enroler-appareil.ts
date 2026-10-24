/**
 * Enrôle ce poste comme appareil de contrôle et écrit sa configuration.
 *
 *   1. la session de l'opérateur demande une clé à l'API
 *      (`POST /attestation/appareils`) ;
 *   2. la clé est écrite dans un fichier local, hors du dépôt, en permissions
 *      600 — elle n'est jamais affichée ni journalisée.
 *
 * Usage :
 *   BIOMETRIE_JETON=<jeton de session> bun run scripts/enroler-appareil.ts "Poste A -/U1"
 *
 * Variables : BIOMETRIE_API_URL (défaut : API de production),
 * BIOMETRIE_JETON (jeton de session du contrôleur), BIOMETRIE_CONFIG (chemin du
 * fichier de configuration), BIOMETRIE_PORT, BIOMETRIE_ORIGINES.
 */
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { cheminConfigEcriture, cheminDansDepot } from '../src/configuration';

const API_URL = (process.env.BIOMETRIE_API_URL ?? 'https://university-api.naimba.com/api').replace(/\/+$/, '');
const RACINE_DEPOT = resolve(dirname(resolve(import.meta.dir)), '..', '..');

const libelle = process.argv.slice(2).join(' ').trim();
if (!libelle) {
  console.error("Usage : BIOMETRIE_JETON=<jeton> bun run scripts/enroler-appareil.ts \"<libellé du poste>\"");
  process.exit(2);
}

const jeton = process.env.BIOMETRIE_JETON?.trim();
if (!jeton) {
  console.error('BIOMETRIE_JETON est requis : la clé se demande à l\'API au nom d\'une session.');
  process.exit(2);
}

const reponse = await fetch(`${API_URL}/attestation/appareils`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jeton}`,
  },
  body: JSON.stringify({ libelle }),
});

if (!reponse.ok) {
  const corps = await reponse.text();
  console.error(`L'API a refusé l'enrôlement (${reponse.status}) : ${corps}`);
  process.exit(1);
}

const enrolement = (await reponse.json()) as { appareilId: string; secret: string };
if (!enrolement.appareilId || !enrolement.secret) {
  console.error("La réponse de l'API est inattendue : ni appareilId ni secret.");
  process.exit(1);
}

const chemin = cheminConfigEcriture();
if (cheminDansDepot(chemin, RACINE_DEPOT)) {
  console.error(
    `Le fichier de configuration ${chemin} se trouve dans le dépôt : il porte une clé de signature et ne doit jamais y être versionné.`,
  );
  process.exit(1);
}

const configuration = {
  appareilId: enrolement.appareilId,
  secret: enrolement.secret,
  port: Number(process.env.BIOMETRIE_PORT ?? 5045),
  origines: (process.env.BIOMETRIE_ORIGINES ?? 'https://university.naimba.com')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  scoreMin: 60,
  langue: 'fr',
};

mkdirSync(dirname(chemin), { recursive: true, mode: 0o700 });
writeFileSync(chemin, `${JSON.stringify(configuration, null, 2)}\n`, { mode: 0o600 });
chmodSync(chemin, 0o600);

console.log(`Appareil enrôlé : ${enrolement.appareilId}`);
console.log(`Configuration écrite dans ${chemin} (permissions 600). La clé n'est jamais affichée.`);
console.log('Démarrez la passerelle avec : BIOMETRIE_CONFIG=' + chemin + ' bun run start');
