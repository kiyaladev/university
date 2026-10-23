/**
 * Rendu HTML A4 du bulletin de vote (élections des délégués).
 *
 * Document neutre : le votant l'imprime, coche ses candidats à la main et
 * le glisse dans l'urne. Aucune information nominative ne figure : le
 * scrutin est secret. Le QR encode l'URL de l'élection (vérification
 * publique côté serveur, sans révéler les choix).
 */
import { StatutElection } from '@prisma/client';
import { echapper, Etablissement, pageA4, PALETTE_IMPRESSION as P, qrSvg } from '../../common/impression';

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

/** Règles propres au bulletin de vote ; le reste vient de `pageA4`. */
const STYLE = `
  body { font-size: 13px; line-height: 1.5; }
  .titre { margin-top: 10px; }
  .nb-sieges { margin-top: 6px; font-size: 12px; color: ${P.encreDouce}; }
  .candidats { margin-top: 18px; border: 1px solid ${P.grisFilet}; border-collapse: collapse; width: 100%; }
  .candidats td { border: 1px solid ${P.grisFilet}; padding: 10px 12px; vertical-align: middle; }
  .candidats .coche { width: 50px; text-align: center; }
  .candidats .coche .case { width: 20px; height: 20px; border: 2px solid ${P.encreDouce}; display:inline-block; border-radius: 4px; }
  .candidats .ordre { width: 50px; text-align: center; color: ${P.encreDouce}; }
  .consignes { margin-top: 22px; padding: 10px 12px; border-left: 3px solid ${P.encre}; background: ${P.grisFond}; font-size: 12.5px; }
  .qr svg { width: 130px; height: 130px; }
`;

export class DocumentsElection {
  async bulletinA4(
    e: BulletinElection,
    opt: { etablissement: Etablissement; urlVerification: string },
  ): Promise<string> {
    const etablissement = echapper(opt.etablissement.nom);
    const candidatsTries = [...e.candidats].sort((a, b) => a.ordre - b.ordre);
    const svg = await qrSvg(opt.urlVerification, { margin: 1, width: 130 });

    const lignes = candidatsTries
      .map(
        (c) => `<tr>
        <td class="ordre">${echapper(c.ordre)}</td>
        <td><strong>${echapper(c.prenom)} ${echapper(c.nom)}</strong></td>
        <td class="coche"><span class="case"></span></td>
      </tr>`,
      )
      .join('');

    return pageA4({
      titre: `Bulletin — ${e.titre}`,
      lang: 'fr',
      etablissement: opt.etablissement,
      styles: STYLE,
      entete: `<div class="etab">${etablissement}</div>
    <div class="titre">${echapper(e.titre)}</div>
    <div class="nb-sieges">
      Sièges à pourvoir : <strong>${e.nbSieges}</strong> — choisissez au plus ${e.nbSieges} candidat(s).
    </div>`,
      corps: `<table class="candidats" cellspacing="0">
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
    <div style="font-size:11px;color:${P.encreDouce};margin-top:6px">${echapper(opt.urlVerification)}</div>
  </div>`,
      piedDePage: `<span>${etablissement}</span>
    <span>Scrutin : ${echapper(e.statut)}</span>`,
    });
  }
}

export const documentsElection = new DocumentsElection();
