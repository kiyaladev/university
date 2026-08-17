/**
 * Rendu HTML A4 du bulletin de vote (élections des délégués).
 *
 * Document neutre : le votant l'imprime, coche ses candidats à la main et
 * le glisse dans l'urne. Aucune information nominative ne figure : le
 * scrutin est secret. Le QR encode l'URL de l'élection (vérification
 * publique côté serveur, sans révéler les choix).
 */
import * as QRCode from 'qrcode';
import { StatutElection } from '@prisma/client';

export interface BulletinCandidat {
  id: string;
  nom: string;
  prenom: string;
  ordre: number;
}

export interface BulletinElection {
  id: string;
  titre: string;
  type: string;
  nbSieges: number;
  statut: StatutElection;
  candidats: BulletinCandidat[];
}

function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm 12mm; font-size: 13px; line-height: 1.5; }
  header { border-bottom: 3px solid #1565c0; padding-bottom: 8px; margin-bottom: 14px; }
  .etab { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #0d47a1; }
  .titre { font-size: 21px; font-weight: 700; margin-top: 10px; color: #0d47a1; }
  .nb-sieges { margin-top: 6px; font-size: 12px; color: #555; }
  .candidats { margin-top: 18px; border: 1px solid #b9c4cf; border-collapse: collapse; width: 100%; }
  .candidats td { border: 1px solid #b9c4cf; padding: 10px 12px; vertical-align: middle; }
  .candidats .coche { width: 50px; text-align: center; }
  .candidats .coche .case { width: 20px; height: 20px; border: 2px solid #555; display:inline-block; border-radius: 4px; }
  .candidats .ordre { width: 50px; text-align: center; color: #555; }
  .consignes { margin-top: 22px; padding: 10px 12px; border-left: 3px solid #0d47a1; background: #f6f8fa; font-size: 12.5px; }
  .qr { text-align: center; margin-top: 26px; }
  .qr svg { width: 130px; height: 130px; }
  footer { margin-top: 24px; font-size: 10px; color: #777; display: flex; justify-content: space-between; border-top: 1px solid #e3e8ee; padding-top: 6px; }
  @media print { body { padding: 8mm; } }
  @page { size: A4; margin: 12mm; }
`;

export class DocumentsElection {
  async bulletinA4(
    e: BulletinElection,
    opt: { nomEtablissement: string; urlVerification: string },
  ): Promise<string> {
    const etablissement = echapper(opt.nomEtablissement);
    const candidatsTries = [...e.candidats].sort((a, b) => a.ordre - b.ordre);
    const svg = await QRCode.toString(opt.urlVerification, {
      type: 'svg',
      margin: 1,
      width: 130,
      errorCorrectionLevel: 'M',
    });

    const lignes = candidatsTries
      .map(
        (c) => `<tr>
        <td class="ordre">${echapper(c.ordre)}</td>
        <td><strong>${echapper(c.prenom)} ${echapper(c.nom)}</strong></td>
        <td class="coche"><span class="case"></span></td>
      </tr>`,
      )
      .join('');

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Bulletin — ${echapper(e.titre)}</title>
<style>${STYLE}</style></head>
<body>
  <header>
    <div class="etab">${etablissement}</div>
    <div class="titre">${echapper(e.titre)}</div>
    <div class="nb-sieges">
      Sièges à pourvoir : <strong>${e.nbSieges}</strong> — choisissez au plus ${e.nbSieges} candidat(s).
    </div>
  </header>

  <table class="candidats" cellspacing="0">
    <thead><tr><th class="ordre">#</th><th>Candidat</th><th class="coche">Choix</th></tr></thead>
    <tbody>${lignes || '<tr><td colspan="3">Aucun candidat déclaré.</td></tr>'}</tbody>
  </table>

  <div class="consignes">
    Cochez les cases devant les candidats que vous soutenez, à concurrence du
    nombre de sièges à pourvoir. Tout bulletin raturé ou portant plus de
    <strong>${e.nbSieges}</strong> coche(s) est nul.
  </div>

  <div class="qr">
    ${svg}
    <div style="font-size:11px;color:#555;margin-top:6px">${echapper(opt.urlVerification)}</div>
  </div>

  <footer>
    <span>${etablissement}</span>
    <span>Scrutin : ${echapper(e.statut)}</span>
  </footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }
}

export const documentsElection = new DocumentsElection();