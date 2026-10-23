/**
 * Rendu HTML A4 du badge d'accès (visiteur, intervenant, technicien, VIP).
 *
 * Format paysage A6 / A5 centré sur la page A4, pour découpe ou plastification.
 * Le QR encode l'URL publique de vérification.
 */
import { StatutBadge } from '@prisma/client';
import { echapper, Etablissement, pageA4, PALETTE_IMPRESSION as P, qrSvg } from '../../common/impression';

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

/** Règles propres au badge ; le reste vient de `pageA4`. */
const STYLE = `
  body { padding: 16mm; }
  header { padding-bottom: 6px; margin-bottom: 12px; }
  .etab { font-size: 14px; letter-spacing: .4px; }
  .coordonnees { margin-top: 0; }
  .titre { font-size: 16px; margin-top: 8px; }
  .carte {
    width: 380px; min-height: 230px; margin: 24px auto; padding: 16px 18px;
    border: 2px solid ${P.encre}; border-radius: 12px; background: ${P.blanc};
  }
  .badge-type { display: inline-block; padding: 3px 10px; border-radius: 980px; background: ${P.grisInerte}; color: ${P.encre}; font-size: 11px; font-weight: 700; letter-spacing: .5px; }
  .badge-type.VIP { background: ${P.jauneFond}; color: ${P.jauneTexte}; }
  .badge-type.TECHNICIEN { background: ${P.grisFond}; color: ${P.encreDouce}; }
  .identite { display: flex; gap: 14px; margin-top: 14px; align-items: center; }
  .photo { width: 90px; height: 110px; object-fit: cover; border: 1px solid ${P.grisFilet}; background: ${P.grisFond}; display:flex; align-items:center; justify-content:center; color: ${P.encreDouce}; font-size:11px; }
  .nom { font-size: 19px; font-weight: 700; line-height: 1.2; }
  .orga { color: ${P.encreDouce}; font-size: 12px; margin-top: 4px; }
  .dates { margin-top: 10px; font-size: 11px; }
  .numero { font-size: 11px; letter-spacing: .6px; color: ${P.encreDouce}; margin-top: 10px; }
  .qr { margin-top: 14px; }
  .qr svg { width: 110px; height: 110px; }
  .revoque { font-size: 12px; padding: 6px; }
  footer { margin-top: 18px; }
`;

export class DocumentsBadge {
  async documentA4(
    b: BadgeImprimable,
    opt: { urlVerification: string; etablissement: Etablissement },
  ): Promise<string> {
    const etablissement = echapper(opt.etablissement.nom);
    const libelleType = TYPE_LIBELLE[b.type] ?? b.type;
    const edite = dateFr(new Date());

    const svg = await qrSvg(opt.urlVerification, { margin: 1, width: 110 });

    const photo = b.photoUrl
      ? `<img class="photo" src="${echapper(b.photoUrl)}" alt="photo" />`
      : `<div class="photo">Photo</div>`;

    const statutAnnule =
      b.statut === StatutBadge.ANNULE
        ? `<div class="revoque">BADGE ANNULÉ${b.motif ? ` — ${echapper(b.motif)}` : ''}</div>`
        : '';

    return pageA4({
      titre: `Badge ${b.numero}`,
      lang: 'fr',
      etablissement: opt.etablissement,
      styles: STYLE,
      entete: `<div class="etab">${etablissement}</div>
    <div class="coordonnees">Service d'accueil — contrôle des accès</div>
    <div class="titre">Badge d'accès</div>`,
      corps: `<div class="carte">
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
  </div>`,
      piedDePage: `<span>${etablissement}</span>
    <span>Édité le ${edite} — le QR encode l'URL de vérification publique</span>`,
    });
  }
}

export const documentsBadge = new DocumentsBadge();
