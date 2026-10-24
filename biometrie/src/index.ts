/**
 * Passerelle biométrique University — point d'entrée.
 *
 * Tourne sur l'appareil du contrôleur (PC, tablette, ou téléphone Android via
 * Termux avec un lecteur en OTG). Le navigateur l'appelle en local ; elle
 * pilote le lecteur et signe ses résultats, de sorte que l'API puisse faire la
 * différence entre une vraie lecture et un client qui prétendrait avoir vérifié.
 *
 * Deux modes de signature :
 *   • par appareil — un fichier de configuration hors dépôt porte l'identifiant
 *     et la clé de l'appareil enrôlé ; chaque poste a sa clé, révocable
 *     individuellement ;
 *   • par secret partagé — l'ancien chemin, conservé pour les postes non
 *     enrôlés, avec un avertissement au démarrage.
 */
import { chargerConfiguration, ErreurConfiguration } from './configuration';
import { creerPasserelle, VERSION_PASSERELLE } from './passeurelle';
import { PILOTES } from './pilotes';
import type { PiloteLecteur } from './pilote';

async function demarrer() {
  let configuration;
  try {
    configuration = chargerConfiguration();
  } catch (e: any) {
    if (e instanceof ErreurConfiguration) {
      console.error(`[biometrie] configuration refusée : ${e.message}`);
      process.exit(1);
    }
    throw e;
  }

  const fabrique = PILOTES[configuration.pilote];
  if (!fabrique) {
    console.error(
      `[biometrie] pilote inconnu « ${configuration.pilote} » — disponibles : ${Object.keys(PILOTES).join(', ')}`,
    );
    process.exit(1);
  }

  const pilote: PiloteLecteur = fabrique();
  await pilote.initialiser();

  for (const avertissement of configuration.avertissements) {
    console.warn(`[biometrie] ${avertissement}`);
  }

  const passerelle = creerPasserelle({
    configuration,
    pilote,
    doigtSimule: process.env.DOIGT_SIMULE === 'inconnu',
  });

  const serveur = Bun.serve({
    port: configuration.port,
    // Écoute locale uniquement : le poste du contrôleur n'a pas à exposer son
    // lecteur d'empreintes au réseau de l'établissement.
    hostname: '127.0.0.1',
    fetch: passerelle.fetch,
  });

  console.log(
    `[biometrie] passerelle ${VERSION_PASSERELLE} à l'écoute sur http://127.0.0.1:${serveur.port} `
      + `(pilote : ${pilote.nom}, signature : ${configuration.mode})`,
  );
  if (configuration.fichierConfig) {
    console.log(`[biometrie] configuration d'appareil : ${configuration.fichierConfig}`);
  }

  const arreter = async () => {
    await pilote.fermer?.();
    await serveur.stop(true);
    process.exit(0);
  };
  process.on('SIGINT', arreter);
  process.on('SIGTERM', arreter);
}

await demarrer();
