/**
 * Faux de stockage pour les tests unitaires : l'environnement Vitest est
 * « node », sans navigateur. Ces fakes rejouent fidèlement le contrat
 * utilisé par l'application (énumération des clés, IndexedDB avec une clé
 * AES-GCM non extractible).
 */

interface FauxRequete {
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded?: (() => void) | null;
  result: unknown;
  error: unknown;
}

/** Stockage local (localStorage, sessionStorage) : un Map suffit. */
export function creerStockageFaux() {
  const valeurs = new Map<string, string>();
  return {
    get length() {
      return valeurs.size;
    },
    key(index: number) {
      return [...valeurs.keys()][index] ?? null;
    },
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => {
      valeurs.set(cle, valeur);
    },
    removeItem: (cle: string) => {
      valeurs.delete(cle);
    },
    clear: () => valeurs.clear(),
  };
}

/**
 * IndexedDB minimal : le service y conserve la clé AES-GCM du compte, avec la
 * seule exigence d'`extractable: false` — la clé n'est jamais lisible.
 *
 * La fin d'une transaction est signalée par une micro-tâche, jamais par un
 * minuteur : le faux ne doit pas introduire de délai réel, sans quoi les
 * tests qui l'utilisent peuvent expirer sur une machine chargée.
 */
export function creerIndexedDbFaux() {
  const bases = new Map<string, Map<string, Map<string, unknown>>>();
  return {
    open(base: string) {
      const requete: FauxRequete = { onsuccess: null, onerror: null, result: null, error: null };
      queueMicrotask(() => {
        const magasins = bases.get(base) ?? new Map<string, Map<string, unknown>>();
        bases.set(base, magasins);
        requete.result = {
          objectStoreNames: { contains: (nom: string) => magasins.has(nom) },
          createObjectStore: (nom: string) => {
            magasins.set(nom, new Map<string, unknown>());
            return nom;
          },
          transaction: (nom: string) => {
            const tx = {
              oncomplete: null as (() => void) | null,
              onerror: null as (() => void) | null,
              onabort: null as (() => void) | null,
              objectStore: () => ({
                get(cle: string) {
                  const lecture: FauxRequete = { onsuccess: null, onerror: null, result: undefined, error: null };
                  queueMicrotask(() => {
                    lecture.result = magasins.get(nom)?.get(cle);
                    lecture.onsuccess?.();
                  });
                  return lecture;
                },
                getAll() {
                  const lecture: FauxRequete = { onsuccess: null, onerror: null, result: [], error: null };
                  queueMicrotask(() => {
                    lecture.result = [...(magasins.get(nom)?.values() ?? [])];
                    lecture.onsuccess?.();
                  });
                  return lecture;
                },
                put(valeur: { proprietaire: string }) {
                  magasins.get(nom)?.set(valeur.proprietaire, valeur);
                },
              }),
            };
            queueMicrotask(() => tx.oncomplete?.());
            return tx;
          },
          close: () => undefined,
        };
        requete.onupgradeneeded?.();
        requete.onsuccess?.();
      });
      return requete;
    },
    deleteDatabase(base: string) {
      const requete: FauxRequete = { onsuccess: null, onerror: null, result: null, error: null };
      queueMicrotask(() => {
        bases.delete(base);
        requete.onsuccess?.();
      });
      return requete;
    },
    databases() {
      return Promise.resolve([...bases.keys()].map((name) => ({ name })));
    },
  };
}

/** Jeton de session portant l'identifiant du compte. */
export function jetonPour(proprietaire: string): string {
  const charge = Buffer.from(JSON.stringify({ sub: proprietaire })).toString('base64');
  return `e30.${charge}.signature-de-recette`;
}
