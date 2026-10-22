/**
 * Rendu HTML A4 d'une attestation officielle. L'enveloppe et le style
 * d'impression viennent de `common/impression` (pageA4) : en-tête
 * d'établissement, filets, signature de pied de page.
 *
 * Le QR code encode l'URL publique de vérification, qui porte à la fois le
 * numéro (ref) et le jeton aléatoire (k). Scanner le document, c'est ouvrir
 * la page de vérité : attestation existe, intacte, jamais révoquée.
 */
import * as QRCode from 'qrcode';
import { StatutAttestation, TypeAttestation } from '@prisma/client';
import { echapper, Etablissement, pageA4, PALETTE_IMPRESSION as P } from '../../common/impression';

const LIBELLE_TYPE: Record<TypeAttestation, string> = {
  SCOLARITE: 'Certificat de scolarité',
  SITUATION: 'Certificat de situation administrative',
  REUSSITE: 'Attestation de réussite',
  DIPLOME: 'Attestation de diplôme',
  ASSIDUITE: "Attestation d'assiduité",
};

export interface AttestationImprimable {
  numero: string;
  type: TypeAttestation;
  motif: string | null;
  statut: StatutAttestation;
  emiseLe: Date | string;
  etudiant?: {
    nom?: string;
    prenom?: string;
    matricule?: string;
    sexe?: string | null;
    dateNaissance?: Date | string | null;
    lieuNaissance?: string | null;
  } | null;
  annee?: { libelle?: string } | null;
  promotion?: { nom?: string; filiere?: { nom?: string } } | null;
  inscription?: { numero?: string } | null;
}

function dateFr(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Règles propres à l'attestation ; le reste vient de `pageA4`. */
const STYLE = `
  body { font-size: 12.5px; line-height: 1.55; }
  .titre { margin-top: 14px; border-bottom: 1px solid ${P.grisFilet}; padding-bottom: 6px; }
  .numero { margin-top: 8px; font-size: 12px; }
  .numero strong { letter-spacing: .5px; }
  .corps { margin-top: 18px; font-size: 13.5px; }
  .corps p { margin: 10px 0; text-align: justify; }
  .identite { margin: 18px 0 0; border: 1px solid ${P.grisFilet}; border-collapse: collapse; width: 100%; }
  .identite td { border: 1px solid ${P.grisFilet}; padding: 8px 10px; }
  .identite .intitule { background: ${P.grisFond}; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; width: 150px; font-weight: 600; }
  .verification { margin-top: 26px; }
  .verification svg { width: 230px; height: 230px; }
  .signatures { margin-top: 44px; }
  .signature { font-size: 11.5px; }
`;

export class DocumentsAttestation {
  /** Document officiel : en-tête, corps certifiant, QR de vérification. */
  async documentA4(
    a: AttestationImprimable,
    opt: { urlVerification: string; etablissement: Etablissement },
  ): Promise<string> {
    const etablissement = echapper(opt.etablissement.nom);
    const libelle = LIBELLE_TYPE[a.type] ?? a.type;
    const edite = dateFr(a.emiseLe);

    const svg = await QRCode.toString(opt.urlVerification, {
      type: 'svg',
      margin: 2,
      width: 230,
      errorCorrectionLevel: 'M',
    });

    const statut = a.statut === StatutAttestation.REVOQUEE
      ? '<div class="revoque">DOCUMENT RÉVOQUÉ — SANS VALEUR LÉGALE</div>'
      : '';

    return pageA4({
      titre: `${libelle} ${a.numero}`,
      lang: 'fr',
      etablissement: opt.etablissement,
      styles: STYLE,
      entete: `<div class="etab">${etablissement}</div>
    <div class="coordonnees">La direction des études — service de la scolarité</div>
    <div class="titre">${echapper(libelle)}</div>
    <div class="numero">N° <strong>${echapper(a.numero)}</strong></div>`,
      corps: `<div class="corps">
    <p>
      La direction des études certifie que ${a.etudiant?.sexe === 'F' ? 'Madame' : 'Monsieur'}
      <strong>${echapper(`${a.etudiant?.prenom ?? ''} ${a.etudiant?.nom ?? ''}`)}</strong>,
      né(e) le ${dateFr(a.etudiant?.dateNaissance)}${a.etudiant?.lieuNaissance ? ` à ${echapper(a.etudiant.lieuNaissance)}` : ''}${a.etudiant?.matricule ? `, matricule ${echapper(a.etudiant.matricule)}` : ''},
      ${this.parcours(a)}. ${this.finalite(a)}
    </p>
    <p>
      <em>${echapper(a.motif || "Le présent document est délivré à l'étudiant(e) pour servir et valoir ce que de droit.")}</em>
    </p>
    ${statut}
  </div>

  <table class="identite" cellspacing="0">
    <tr><td class="intitule">Date d'émission</td><td>${edite}</td></tr>
    <tr>
      <td class="intitule">Contrôle d'authenticité</td>
      <td>
        Le QR ci-dessous ouvre la page publique de vérification du document :
        <strong>${echapper(opt.urlVerification)}</strong>. Toute consultation y est journalisée.
      </td>
    </tr>
  </table>

  <div class="verification">
    ${svg}
    <div class="mention">Vérifiable en ligne : ${echapper(opt.urlVerification)}</div>
    <div class="numero-clair">N° ${echapper(a.numero)}</div>
  </div>

  <div class="signatures">
    <div class="signature">La scolarité</div>
    <div class="signature">Le secrétariat pédagogique</div>
    <div class="signature">La direction des études</div>
  </div>`,
      piedDePage: `<span>${etablissement}</span>
    <span>Édité le ${edite} — vérification gratuite et publique du QR</span>`,
    });
  }

  private parcours(a: AttestationImprimable): string {
    const morceaux: string[] = [];
    if (a.promotion?.nom) {
      morceaux.push(`${echapper(a.promotion.nom)}${a.promotion.filiere?.nom ? ` (${echapper(a.promotion.filiere.nom)})` : ''}`);
    }
    if (a.annee?.libelle) {
      morceaux.push(`année académique ${echapper(a.annee.libelle)}`);
    }
    if (a.inscription?.numero) {
      morceaux.push(`inscription n° ${echapper(a.inscription.numero)}`);
    }
    return morceaux.length
      ? `est inscrit(e) ${morceaux.join(', ')}`
      : 'est un(e) étudiant(e) de cet établissement';
  }

  private finalite(a: AttestationImprimable): string {
    switch (a.type) {
      case TypeAttestation.SCOLARITE:
        return "Ce certificat atteste de sa qualité d'étudiant inscrit(e).";
      case TypeAttestation.SITUATION:
        return 'Le présent certificat de situation est établi à sa demande';
      case TypeAttestation.REUSSITE:
        return 'Il/elle a satisfait aux épreuves et réussit l’année considérée.';
      case TypeAttestation.DIPLOME:
        return 'Il/elle est titulaire du diplôme de la session correspondante.';
      case TypeAttestation.ASSIDUITE:
        return "Il/elle a suivi les enseignements avec l'assiduité requise.";
      default:
        return '';
    }
  }
}

/** Export unique : l'utilitaire de génération de documents. */
export const documents = new DocumentsAttestation();