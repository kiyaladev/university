/** Empreinte SHA-256 (hex minuscule) d'un fichier, calculée dans le navigateur. */
export async function empreinteSha256Fichier(fichier: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await fichier.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
