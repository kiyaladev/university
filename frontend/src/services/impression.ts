import { Notify } from 'quasar';
import { API_URL } from '../boot/axios';
import { jetonPresent, lireToken } from './session';

/**
 * Ouvre un document imprimable (procès-verbal, attestation, fiche, relevé…)
 * dans un nouvel onglet.
 *
 * Le serveur accepte deux formes d'authentification sur ces routes : l'en-tête
 * `Authorization`, ou un `?token=` en query string. On utilise l'en-tête :
 * un jeton passé en URL se retrouve dans l'historique du navigateur, dans
 * l'en-tête `Referer` de toutes les navigations suivantes et dans les journaux
 * du serveur, pour un document que l'utilisateur veut simplement voir.
 *
 * L'onglet est ouvert avant l'appel réseau : un `window.open` déclenché après
 * une promesse est bloqué comme pop-up, ce qui ferait perdre l'impression
 * sans aucun message.
 */
export async function ouvrirImpression(
  chemin: string,
  params: Record<string, string | undefined> = {},
): Promise<void> {
  if (!jetonPresent()) {
    Notify.create({ type: 'negative', message: 'Session expirée : reconnectez-vous.' });
    return;
  }

  const query = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur) query.set(cle, valeur);
  }
  const suffixe = query.toString() ? `?${query}` : '';
  const url = `${API_URL}${chemin}${suffixe}`;

  const onglet = window.open('', '_blank');
  try {
    const reponse = await fetch(url, {
      headers: { Authorization: `Bearer ${lireToken()}` },
    });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

    const objet = URL.createObjectURL(await reponse.blob());
    if (onglet) {
      onglet.location.href = objet;
    } else {
      // Pop-up bloqué : on tente une dernière fois depuis le geste initial.
      window.open(objet, '_blank');
    }
    // L'onglet a le temps de charger avant que la blobs URL ne meure.
    setTimeout(() => URL.revokeObjectURL(objet), 60_000);
  } catch {
    onglet?.close();
    Notify.create({
      type: 'negative',
      message: "Le document n'a pas pu être généré.",
    });
  }
}

/** Extrait le `<style>` d'un document imprimable serveur. */
function stylesDe(html: string): string {
  return (html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? '').trim();
}

/** Extrait le `<body>` d'un document imprimable serveur, script d'auto-print retiré. */
function corpsDe(html: string): string {
  const corps = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '';
  return corps.replace(/<script[\s\S]*?<\/script>/gi, '').trim();
}

/**
 * Imprime plusieurs documents dans UN seul onglet.
 *
 * Ouvrir un onglet par étudiant était ingérable : dès le second, le navigateur
 * bloque la fenêtre, et une promotion compte plutôt cent lignes. On récupère
 * donc tous les relevés puis on les recompose en un document paginé, avec un
 * seul saut de page par bulletin et un seul appel à l'impression.
 */
export async function ouvrirImpressions(
  chemins: string[],
  params: Record<string, string | undefined> = {},
): Promise<void> {
  if (!chemins.length) {
    Notify.create({ type: 'warning', message: 'Aucun document à imprimer.' });
    return;
  }
  if (!jetonPresent()) {
    Notify.create({ type: 'negative', message: 'Session expirée : reconnectez-vous.' });
    return;
  }

  const onglet = window.open('', '_blank');
  try {
    const entete = { Authorization: `Bearer ${lireToken()}` };
    const corps = await Promise.all(
      chemins.map(async (chemin) => {
        const q = new URLSearchParams();
        for (const [cle, valeur] of Object.entries(params)) {
          if (valeur) q.set(cle, valeur);
        }
        const suffixe = q.toString() ? `?${q}` : '';
        const reponse = await fetch(`${API_URL}${chemin}${suffixe}`, { headers: entete });
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
        return reponse.text();
      }),
    );

    const styles = [...new Set(corps.map(stylesDe).filter(Boolean))].join('\n');
    const contenu = corps
      .map((html) => `<section class="doc">${corpsDe(html)}</section>`)
      .join('\n');

    const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Bulletins</title>
<style>
${styles}
section.doc { page-break-after: always; }
section.doc:last-child { page-break-after: auto; }
</style></head>
<body>${contenu}
<script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
</body></html>`;

    const objet = URL.createObjectURL(new Blob([page], { type: 'text/html' }));
    if (onglet) onglet.location.href = objet;
    else window.open(objet, '_blank');
    setTimeout(() => URL.revokeObjectURL(objet), 60_000);
  } catch {
    onglet?.close();
    Notify.create({ type: 'negative', message: "Les documents n'ont pas pu être générés." });
  }
}

/**
 * Télécharge un fichier (export CSV) avec l'authentification par en-tête.
 * `window.open` ne peut pas porter d'en-tête : le CSV arriverait refusé.
 */
export async function telechargerFichier(
  chemin: string,
  params: Record<string, string | undefined> = {},
  nomFichier: string,
): Promise<void> {
  if (!jetonPresent()) {
    Notify.create({ type: 'negative', message: 'Session expirée : reconnectez-vous.' });
    return;
  }
  try {
    const q = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(params)) {
      if (valeur) q.set(cle, valeur);
    }
    const suffixe = q.toString() ? `?${q}` : '';
    const reponse = await fetch(`${API_URL}${chemin}${suffixe}`, {
      headers: { Authorization: `Bearer ${lireToken()}` },
    });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

    const objet = URL.createObjectURL(await reponse.blob());
    const lien = document.createElement('a');
    lien.href = objet;
    lien.download = nomFichier;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(objet), 60_000);
  } catch {
    Notify.create({ type: 'negative', message: "L'export n'a pas pu être généré." });
  }
}
