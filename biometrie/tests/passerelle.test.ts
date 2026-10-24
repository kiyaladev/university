/**
 * Passerelle HTTP : ce que le contrôleur obtient, et ce que l'API acceptera.
 *
 * Les signatures produites ici sont vérifiées avec l'algorithme de l'API
 * reproduit dans le test : si la passerelle s'écarte d'un champ, le test le
 * voit avant qu'un enseignant ne se fasse refuser au pointage.
 */
import { describe, expect, it } from 'bun:test';
import { createHash, createHmac } from 'node:crypto';
import { RegistreAntiRejeu } from '../src/anti-rejeu';
import type { ConfigurationPasserelle } from '../src/configuration';
import { creerPasserelle, origineAutorisee, VERSION_PASSERELLE } from '../src/passerelle';
import type { Capture, PiloteLecteur } from '../src/pilote';

const APPAREIL_ID = '3f2b6c1a-9d4e-4a71-8c2f-0b5a7e9d1c33';
const SECRET_APPAREIL = 'a'.repeat(64);
const SECRET_PARTAGE = 'secret-partage-0001';
const GABARIT = 'GABARIT-TEST-0001';
const ORIGINE = 'https://university.naimba.com';

/** Pilote déterministe : même gabarit, même score — pour les vecteurs. */
class PiloteFixe implements PiloteLecteur {
  readonly nom = 'fixe';
  readonly simule = false;

  async initialiser() {}

  async capturer(): Promise<Capture> {
    return { template: GABARIT, qualite: 90, doigt: 'index droit' };
  }

  async comparer(gabaritEnrole: string, gabaritCapture: string): Promise<number> {
    return gabaritEnrole === gabaritCapture ? 88 : 10;
  }
}

function configurationAppareil(): ConfigurationPasserelle {
  return {
    port: 5044,
    origines: [ORIGINE],
    scoreMin: 60,
    langue: 'fr',
    pilote: 'fixe',
    appareil: { appareilId: APPAREIL_ID, secret: SECRET_APPAREIL },
    mode: 'appareil',
    secret: SECRET_APPAREIL,
    fichierConfig: '/tmp/biometrie.json',
    avertissements: [],
  };
}

function configurationPartage(): ConfigurationPasserelle {
  return {
    ...configurationAppareil(),
    appareil: null,
    mode: 'secret-partage',
    secret: SECRET_PARTAGE,
    fichierConfig: null,
  };
}

/** Algorithme de l'API, reproduit depuis le backend. */
function apiVerifieVerification(params: {
  appareilId?: string;
  secret: string;
  enseignantId: string;
  template: string;
  score: number;
  horodatage: string;
  signature: string;
}): boolean {
  const gabarit = createHash('sha256').update(params.template).digest('hex');
  const charge = params.appareilId
    ? `verification|${params.appareilId}|${params.enseignantId}|${gabarit}|${params.score}|${params.horodatage}`
    : `verification|${params.enseignantId}|${gabarit}|${params.score}|${params.horodatage}`;
  return createHmac('sha256', params.secret).update(charge).digest('hex') === params.signature;
}

function apiVerifieEnrolement(params: {
  appareilId?: string;
  secret: string;
  enseignantId: string;
  template: string;
  horodatage: string;
  signature: string;
}): boolean {
  const charge = params.appareilId
    ? `enrolement|${params.appareilId}|${params.enseignantId}|${params.template}|${params.horodatage}`
    : `enrolement|${params.enseignantId}|${params.template}|${params.horodatage}`;
  return createHmac('sha256', params.secret).update(charge).digest('hex') === params.signature;
}

/** Le corps JSON est typé à la lecture : le test sait ce qu'il attend. */
async function corps<T = any>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

function requete(url: string, options: RequestInit & { origine?: string | null } = {}) {
  const entetes = new Headers(options.headers);
  if (options.origine !== null) {
    entetes.set('Origin', options.origine ?? ORIGINE);
  }
  return new Request(`http://127.0.0.1:5044${url}`, { ...options, headers: entetes });
}

describe('Passerelle — état', () => {
  it('décrit le lecteur, le mode de signature et l’appareil', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(requete('/etat'));
    const etat = await corps(reponse);

    expect(reponse.status).toBe(200);
    expect(etat.pret).toBe(true);
    expect(etat.lecteur).toBe('fixe');
    expect(etat.simule).toBe(false);
    expect(etat.mode).toBe('appareil');
    expect(etat.appareilId).toBe(APPAREIL_ID);
    expect(etat.version).toBe(VERSION_PASSERELLE);
  });
});

describe('Passerelle — enrôlement signé par l’appareil', () => {
  it('produit une signature que l’API accepte', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(
      requete('/enroler', { method: 'POST', body: JSON.stringify({ enseignantId: 'ens-1' }) }),
    );
    const capture = await corps(reponse);

    expect(reponse.status).toBe(200);
    expect(capture.template).toBe(GABARIT);
    expect(capture.appareilId).toBe(APPAREIL_ID);
    expect(
      apiVerifieEnrolement({
        appareilId: APPAREIL_ID,
        secret: SECRET_APPAREIL,
        enseignantId: 'ens-1',
        template: capture.template,
        horodatage: capture.horodatage,
        signature: capture.signature,
      }),
    ).toBe(true);
  });

  it('refuse un enrôlement sans identifiant d’enseignant', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(requete('/enroler', { method: 'POST', body: JSON.stringify({}) }));

    expect(reponse.status).toBe(400);
    expect((await corps(reponse)).erreur).toBeTruthy();
  });
});

describe('Passerelle — vérification signée par l’appareil', () => {
  it('produit une signature que l’API accepte', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(
      requete('/verifier', {
        method: 'POST',
        body: JSON.stringify({ enseignantId: 'ens-1', gabarit: GABARIT }),
      }),
    );
    const resultat = await corps(reponse);

    expect(reponse.status).toBe(200);
    expect(resultat.score).toBe(88);
    expect(resultat.correspond).toBe(true);
    expect(resultat.appareilId).toBe(APPAREIL_ID);
    expect(
      apiVerifieVerification({
        appareilId: APPAREIL_ID,
        secret: SECRET_APPAREIL,
        enseignantId: 'ens-1',
        template: GABARIT,
        score: resultat.score,
        horodatage: resultat.horodatage,
        signature: resultat.signature,
      }),
    ).toBe(true);
  });

  it('accepte aussi le nom « template » du gabarit', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(
      requete('/verifier', {
        method: 'POST',
        body: JSON.stringify({ enseignantId: 'ens-1', template: GABARIT }),
      }),
    );

    expect(reponse.status).toBe(200);
    expect((await corps(reponse)).score).toBe(88);
  });

  it('signe avec le secret partagé quand aucun appareil n’est configuré', async () => {
    const passerelle = creerPasserelle({ configuration: configurationPartage(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(
      requete('/verifier', {
        method: 'POST',
        body: JSON.stringify({ enseignantId: 'ens-1', gabarit: GABARIT }),
      }),
    );
    const resultat = await corps(reponse);

    expect(resultat.appareilId).toBeNull();
    expect(
      apiVerifieVerification({
        secret: SECRET_PARTAGE,
        enseignantId: 'ens-1',
        template: GABARIT,
        score: resultat.score,
        horodatage: resultat.horodatage,
        signature: resultat.signature,
      }),
    ).toBe(true);
    // La signature de l'appareil ne doit pas être acceptée par l'API en mode partagé.
    expect(
      apiVerifieVerification({
        appareilId: APPAREIL_ID,
        secret: SECRET_PARTAGE,
        enseignantId: 'ens-1',
        template: GABARIT,
        score: resultat.score,
        horodatage: resultat.horodatage,
        signature: resultat.signature,
      }),
    ).toBe(false);
  });

  it('refuse une vérification sans gabarit', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(
      requete('/verifier', { method: 'POST', body: JSON.stringify({ enseignantId: 'ens-1' }) }),
    );

    expect(reponse.status).toBe(400);
  });
});

describe('Passerelle — anti-rejeu', () => {
  it('refuse une requête rejouée (même tentative)', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });
    const corpsRequete = JSON.stringify({ enseignantId: 'ens-1', gabarit: GABARIT, tentativeId: 'tentative-1' });

    const premiere = await passerelle.fetch(requete('/verifier', { method: 'POST', body: corpsRequete }));
    expect(premiere.status).toBe(200);

    const seconde = await passerelle.fetch(requete('/verifier', { method: 'POST', body: corpsRequete }));
    expect(seconde.status).toBe(409);
    expect((await corps(seconde)).erreur).toMatch(/rejouée/);
  });

  it('refuse de signer deux fois le même résultat', async () => {
    // Horloge figée : la seconde vérification produit la même charge signée.
    const instant = new Date('2026-10-24T08:00:00.000Z').getTime();
    const passerelle = creerPasserelle({
      configuration: configurationAppareil(),
      pilote: new PiloteFixe(),
      horloge: () => instant,
    });

    const premiere = await passerelle.fetch(
      requete('/verifier', { method: 'POST', body: JSON.stringify({ enseignantId: 'ens-1', gabarit: GABARIT }) }),
    );
    expect(premiere.status).toBe(200);

    const seconde = await passerelle.fetch(
      requete('/verifier', { method: 'POST', body: JSON.stringify({ enseignantId: 'ens-1', gabarit: GABARIT }) }),
    );
    expect(seconde.status).toBe(409);
  });

  it('accepte une tentative nouvelle', async () => {
    // Deux lectures distinctes : l'horodatage avance, la charge change.
    let instant = new Date('2026-10-24T08:00:00.000Z').getTime();
    const passerelle = creerPasserelle({
      configuration: configurationAppareil(),
      pilote: new PiloteFixe(),
      horloge: () => (instant += 10),
    });

    for (const tentativeId of ['tentative-1', 'tentative-2']) {
      const reponse = await passerelle.fetch(
        requete('/verifier', {
          method: 'POST',
          body: JSON.stringify({ enseignantId: 'ens-1', gabarit: GABARIT, tentativeId }),
        }),
      );
      expect(reponse.status).toBe(200);
    }
  });

  it('oublie une tentative une fois la fenêtre écoulée', async () => {
    let instant = 1_000_000;
    const registre = new RegistreAntiRejeu({ maintenant: () => instant });
    const passerelle = creerPasserelle({
      configuration: configurationAppareil(),
      pilote: new PiloteFixe(),
      registre,
    });

    const corpsRequete = JSON.stringify({ enseignantId: 'ens-1', gabarit: GABARIT, tentativeId: 'tentative-1' });
    expect((await passerelle.fetch(requete('/verifier', { method: 'POST', body: corpsRequete }))).status).toBe(200);

    instant += 5 * 60 * 1000 + 1;
    expect((await passerelle.fetch(requete('/verifier', { method: 'POST', body: corpsRequete }))).status).toBe(200);
  });
});

describe('Passerelle — contrôle d’origine', () => {
  it('accepte l’origine de l’application', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(requete('/etat', { origine: ORIGINE }));

    expect(reponse.status).toBe(200);
    expect(reponse.headers.get('Access-Control-Allow-Origin')).toBe(ORIGINE);
  });

  it('refuse une origine inconnue', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(requete('/etat', { origine: 'https://site-pirate.example' }));

    expect(reponse.status).toBe(403);
    expect(reponse.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('laisse passer un appel sans origine (application native, script local)', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(requete('/etat', { origine: null }));

    expect(reponse.status).toBe(200);
  });

  it('ne met jamais en cache une preuve', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(requete('/etat'));

    expect(reponse.headers.get('Cache-Control')).toBe('no-store');
  });

  it('décide de l’autorisation d’origine', () => {
    expect(origineAutorisee(null, [ORIGINE])).toBe(true);
    expect(origineAutorisee(ORIGINE, [ORIGINE])).toBe(true);
    expect(origineAutorisee('https://autre.example', [ORIGINE])).toBe(false);
    expect(origineAutorisee('https://autre.example', ['*'])).toBe(true);
  });
});

describe('Passerelle — routes inconnues', () => {
  it('répond 404', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });

    const reponse = await passerelle.fetch(requete('/inconnue'));

    expect(reponse.status).toBe(404);
  });
});

describe('Passerelle — service en écoute', () => {
  it('répond sur une vraie adresse locale', async () => {
    const passerelle = creerPasserelle({ configuration: configurationAppareil(), pilote: new PiloteFixe() });
    const serveur = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: passerelle.fetch });

    try {
      const reponse = await fetch(`http://127.0.0.1:${serveur.port}/etat`, { headers: { Origin: ORIGINE } });
      const etat = await corps(reponse);

      expect(reponse.status).toBe(200);
      expect(etat.pret).toBe(true);
      expect(etat.appareilId).toBe(APPAREIL_ID);
    } finally {
      await serveur.stop(true);
    }
  });
});
