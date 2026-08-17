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
import * as QRCode from 'qrcode';
import { StatutAttestation } from '@prisma/client';

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

function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dateFr(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm 12mm; font-size: 12.5px; line-height: 1.5; }
  header { border-bottom: 3px solid #1565c0; padding-bottom: 8px; margin-bottom: 16px; }
  .etab { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #0d47a1; }
  .coordonnees { font-size: 11px; color: #555; margin-top: 2px; }
  .titre { font-size: 21px; font-weight: 700; margin-top: 14px; color: #0d47a1; }
  .identite { margin-top: 18px; border: 1px solid #b9c4cf; border-collapse: collapse; width: 100%; }
  .identite td { border: 1px solid #b9c4cf; padding: 10px 12px; vertical-align: top; }
  .identite .intitule { background: #e8eef5; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; width: 170px; font-weight: 600; }
  .photo { width: 130px; height: 160px; object-fit: cover; border: 1px solid #b9c4cf; background: #f6f8fa; }
  .qr { text-align: center; margin-top: 26px; }
  .qr svg { width: 230px; height: 230px; }
  .qr .mention { font-size: 11px; color: #555; margin-top: 8px; word-break: break-all; }
  .statut-revoquee { margin-top: 14px; border: 2px solid #a52020; color: #a52020; padding: 8px; text-align: center; font-weight: 700; letter-spacing: .6px; }
  footer { margin-top: 26px; font-size: 10px; color: #777; display: flex; justify-content: space-between; border-top: 1px solid #e3e8ee; padding-top: 6px; }
  @media print { body { padding: 8mm; } }
  @page { size: A4; margin: 12mm; }
`;

export class DocumentsCarte {
  async documentA4(
    c: CarteImprimable,
    opt: { urlVerification: string; nomEtablissement: string },
  ): Promise<string> {
    const etablissement = echapper(opt.nomEtablissement);
    const civilite = c.etudiant?.sexe === 'F' ? 'Madame' : 'Monsieur';
    const edite = dateFr(new Date());

    const svg = await QRCode.toString(opt.urlVerification, {
      type: 'svg',
      margin: 2,
      width: 230,
      errorCorrectionLevel: 'M',
    });

    const photo = c.photoUrl
      ? `<img class="photo" src="${echapper(c.photoUrl)}" alt="photo" />`
      : `<div class="photo" style="display:flex;align-items:center;justify-content:center;color:#888;">Photo</div>`;

    const revoquee =
      c.statut === StatutAttestation.REVOQUEE
        ? `<div class="statut-revoquee">CARTE RÉVOQUÉE${c.motifRevocation ? ` — ${echapper(c.motifRevocation)}` : ''}</div>`
        : '';

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Carte d'étudiant ${echapper(c.etudiant?.matricule ?? '')}</title>
<style>${STYLE}</style></head>
<body>
  <header>
    <div class="etab">${etablissement}</div>
    <div class="coordonnees">Le service de la scolarité</div>
    <div class="titre">Carte d'étudiant numérique</div>
  </header>

  <table class="identite" cellspacing="0">
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
  </div>

  <footer>
    <span>${etablissement}</span>
    <span>Édité le ${edite} — vérification gratuite et publique du QR</span>
  </footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }
}

export const documentsCarte = new DocumentsCarte();