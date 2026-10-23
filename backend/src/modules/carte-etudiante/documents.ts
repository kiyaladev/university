/**
 * Rendu HTML A4 de la carte d'étudiant (recto verso ou recto seul).
 *
 * Le QR code encode l'URL publique de vérification, qui porte à la fois
 * l'identifiant interne (`carte`) et le jeton aléatoire (`k`). Scanner la
 * carte, c'est ouvrir la page de vérité.
 *
 * Le style d'impression reprend les codes couleurs des attestations et des
 * états : en-tête d'établissement, filets, signature de pied de page.
 */
import { StatutAttestation } from '@prisma/client';
import { echapper, Etablissement, pageA4, PALETTE_IMPRESSION as P, qrSvg } from '../../common/impression';

export interface CarteImprimable {
  id: string;
  qrToken: string;
  statut: StatutAttestation;
  dateEmission: Date | string;
  dateValidite?: Date | string | null;
  motifRevocation?: string | null;
  photoUrl?: string | null;
  etudiant?: {
    matricule?: string;
    nom?: string;
    prenom?: string;
    sexe?: string | null;
    dateNaissance?: Date | string | null;
    lieuNaissance?: string | null;
  } | null;
}

function dateFr(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Règles propres à la carte ; le reste vient de `pageA4`. */
const STYLE = `
  body { font-size: 12.5px; line-height: 1.5; }
  .titre { margin-top: 14px; }
  .identite { margin-top: 18px; border: 1px solid ${P.grisFilet}; border-collapse: collapse; width: 100%; }
  .identite td { border: 1px solid ${P.grisFilet}; padding: 10px 12px; vertical-align: top; }
  .identite .intitule { background: ${P.grisFond}; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; width: 170px; font-weight: 600; }
  .photo { width: 130px; height: 160px; object-fit: cover; border: 1px solid ${P.grisFilet}; background: ${P.grisFond}; }
  .qr svg { width: 230px; height: 230px; }
  .qr .mention { font-size: 11px; color: ${P.encreDouce}; margin-top: 8px; word-break: break-all; }
  .revoque { margin-top: 14px; }
`;

export class DocumentsCarte {
  async documentA4(
    c: CarteImprimable,
    opt: { urlVerification: string; etablissement: Etablissement },
  ): Promise<string> {
    const etablissement = echapper(opt.etablissement.nom);
    const civilite = c.etudiant?.sexe === 'F' ? 'Madame' : 'Monsieur';
    const edite = dateFr(new Date());

    const svg = await qrSvg(opt.urlVerification, { margin: 2, width: 230 });

    const photo = c.photoUrl
      ? `<img class="photo" src="${echapper(c.photoUrl)}" alt="photo" />`
      : `<div class="photo" style="display:flex;align-items:center;justify-content:center;color:${P.encreDouce};">Photo</div>`;

    const revoquee =
      c.statut === StatutAttestation.REVOQUE
        ? `<div class="revoque">CARTE RÉVOQUÉE${c.motifRevocation ? ` — ${echapper(c.motifRevocation)}` : ''}</div>`
        : '';

    return pageA4({
      titre: `Carte d'étudiant ${c.etudiant?.matricule ?? ''}`,
      lang: 'fr',
      etablissement: opt.etablissement,
      styles: STYLE,
      entete: `<div class="etab">${etablissement}</div>
    <div class="coordonnees">Le service de la scolarité</div>
    <div class="titre">Carte d'étudiant numérique</div>`,
      corps: `<table class="identite" cellspacing="0">
    <tr>
      <td class="intitule">Identité</td>
      <td>
        <strong>${echapper(civilite)} ${echapper(`${c.etudiant?.prenom ?? ''} ${c.etudiant?.nom ?? ''}`)}</strong><br>
        Matricule <strong>${echapper(c.etudiant?.matricule ?? '—')}</strong><br>
        Né(e) le ${dateFr(c.etudiant?.dateNaissance)}${c.etudiant?.lieuNaissance ? ` à ${echapper(c.etudiant.lieuNaissance)}` : ''}
      </td>
      <td rowspan="4" style="text-align:center">${photo}</td>
    </tr>
    <tr><td class="intitule">Date d'émission</td><td colspan="2">${dateFr(c.dateEmission)}</td></tr>
    <tr><td class="intitule">Valable jusqu'au</td><td colspan="2">${dateFr(c.dateValidite)}</td></tr>
    <tr><td class="intitule">Jeton d'identification</td><td colspan="2"><code>${echapper(c.qrToken)}</code></td></tr>
  </table>

  ${revoquee}

  <div class="qr">
    ${svg}
    <div class="mention">Vérifiable à l'adresse : ${echapper(opt.urlVerification)}</div>
    <div class="mention" style="margin-top:4px">Toute consultation est journalisée.</div>
  </div>`,
      piedDePage: `<span>${etablissement}</span>
    <span>Édité le ${edite} — vérification gratuite et publique du QR</span>`,
    });
  }
}

export const documentsCarte = new DocumentsCarte();
