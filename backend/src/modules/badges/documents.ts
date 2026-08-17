/**
 * Rendu HTML A4 du badge d'accès (visiteur, intervenant, technicien, VIP).
 *
 * Format paysage A6 / A5 centré sur la page A4, pour découpe ou plastification.
 * Le QR encode l'URL publique de vérification.
 */
import * as QRCode from 'qrcode';
import { StatutBadge } from '@prisma/client';

export interface BadgeImprimable {
  id: string;
  numero: string;
  type: string;
  nom: string;
  prenom: string;
  fonction?: string | null;
  organisation?: string | null;
  dateDelivrance: Date | string;
  dateValidite: Date | string;
  zonesAccess?: string | null;
  statut: StatutBadge;
  motif?: string | null;
  photoUrl?: string | null;
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
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TYPE_LIBELLE: Record<string, string> = {
  VISITEUR: 'Visiteur',
  INTERVENANT: 'Intervenant',
  TECHNICIEN: 'Technicien',
  VIP: 'Personnalité officielle',
};

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm; font-size: 12px; }
  header { border-bottom: 3px solid #1565c0; padding-bottom: 6px; margin-bottom: 12px; }
  .etab { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #0d47a1; }
  .coordonnees { font-size: 11px; color: #555; }
  .titre { font-size: 16px; font-weight: 700; margin-top: 8px; color: #0d47a1; }
  .carte {
    width: 380px; min-height: 230px; margin: 24px auto; padding: 16px 18px;
    border: 2px solid #0d47a1; border-radius: 14px; background: linear-gradient(180deg,#fff 70%,#f3f7fb 100%);
  }
  .badge-type { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #0d47a1; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .5px; }
  .badge-type.VIP { background: #b8860b; }
  .badge-type.TECHNICIEN { background: #455a64; }
  .identite { display: flex; gap: 14px; margin-top: 14px; align-items: center; }
  .photo { width: 90px; height: 110px; object-fit: cover; border: 1px solid #b9c4cf; background: #f6f8fa; display:flex; align-items:center; justify-content:center; color:#888; font-size:11px; }
  .nom { font-size: 19px; font-weight: 700; line-height: 1.2; }
  .orga { color: #555; font-size: 12px; margin-top: 4px; }
  .dates { margin-top: 10px; font-size: 11px; color: #333; }
  .dates strong { color: #0d47a1; }
  .numero { font-size: 11px; letter-spacing: .6px; color: #777; margin-top: 10px; }
  .qr { text-align: center; margin-top: 14px; }
  .qr svg { width: 110px; height: 110px; }
  .statut-revoque { margin-top: 12px; border: 2px solid #a52020; color: #a52020; padding: 6px; text-align: center; font-weight: 700; letter-spacing: .6px; font-size: 12px; }
  footer { margin-top: 18px; font-size: 10px; color: #777; display: flex; justify-content: space-between; border-top: 1px solid #e3e8ee; padding-top: 6px; }
  @media print { body { padding: 8mm; } }
  @page { size: A4; margin: 12mm; }
`;

export class DocumentsBadge {
  async documentA4(
    b: BadgeImprimable,
    opt: { urlVerification: string; nomEtablissement: string },
  ): Promise<string> {
    const etablissement = echapper(opt.nomEtablissement);
    const libelleType = TYPE_LIBELLE[b.type] ?? b.type;
    const edite = dateFr(new Date());

    const svg = await QRCode.toString(opt.urlVerification, {
      type: 'svg',
      margin: 1,
      width: 110,
      errorCorrectionLevel: 'M',
    });

    const photo = b.photoUrl
      ? `<img class="photo" src="${echapper(b.photoUrl)}" alt="photo" />`
      : `<div class="photo">Photo</div>`;

    const statutAnnule =
      b.statut === StatutBadge.ANNULE
        ? `<div class="statut-revoque">BADGE ANNULÉ${b.motif ? ` — ${echapper(b.motif)}` : ''}</div>`
        : '';

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Badge ${echapper(b.numero)}</title>
<style>${STYLE}</style></head>
<body>
  <header>
    <div class="etab">${etablissement}</div>
    <div class="coordonnees">Service d'accueil — contrôle des accès</div>
    <div class="titre">Badge d'accès</div>
  </header>

  <div class="carte">
    <div class="badge-type ${echapper(b.type)}">${echapper(libelleType)}</div>
    <div class="identite">
      ${photo}
      <div>
        <div class="nom">${echapper(b.prenom)} ${echapper(b.nom)}</div>
        ${b.fonction ? `<div class="orga">${echapper(b.fonction)}</div>` : ''}
        ${b.organisation ? `<div class="orga"><strong>${echapper(b.organisation)}</strong></div>` : ''}
        <div class="dates">
          Délivré le <strong>${dateFr(b.dateDelivrance)}</strong><br>
          Valable jusqu'au <strong>${dateFr(b.dateValidite)}</strong>
        </div>
        <div class="numero">N° ${echapper(b.numero)}</div>
        ${b.zonesAccess ? `<div class="orga">Zones : ${echapper(b.zonesAccess)}</div>` : ''}
      </div>
    </div>
    <div class="qr">${svg}</div>
    ${statutAnnule}
  </div>

  <footer>
    <span>${etablissement}</span>
    <span>Édité le ${edite} — le QR encode l'URL de vérification publique</span>
  </footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }
}

export const documentsBadge = new DocumentsBadge();