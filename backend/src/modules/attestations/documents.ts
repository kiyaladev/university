/**
 * Rendu HTML A4 d'une attestation officielle. Le style d'impression est une
 * copie locale de celui des états imprimés (modules/rapports — intouchable) :
 * en-tête d'établissement, filets, signature de pied de page.
 *
 * Le QR code encode l'URL publique de vérification, qui porte à la fois le
 * numéro (ref) et le jeton aléatoire (k). Scanner le document, c'est ouvrir
 * la page de vérité : attestation existe, intacte, jamais révoquée.
 */
import * as QRCode from 'qrcode';
import { StatutAttestation, TypeAttestation } from '@prisma/client';

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
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm 12mm; font-size: 12.5px; line-height: 1.55; }
  header { border-bottom: 3px solid #1565c0; padding-bottom: 8px; margin-bottom: 16px; }
  .etab { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #0d47a1; }
  .coordonnees { font-size: 11px; color: #555; margin-top: 2px; }
  .titre { font-size: 21px; font-weight: 700; margin-top: 14px; color: #0d47a1; border-bottom: 1px solid #b9c4cf; padding-bottom: 6px; }
  .numero { margin-top: 8px; font-size: 12px; }
  .numero strong { letter-spacing: .5px; }
  .corps { margin-top: 18px; font-size: 13.5px; }
  .corps p { margin: 10px 0; text-align: justify; }
  .identite { margin: 18px 0 0; border: 1px solid #b9c4cf; border-collapse: collapse; width: 100%; }
  .identite td { border: 1px solid #b9c4cf; padding: 8px 10px; }
  .identite .intitule { background: #e8eef5; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; width: 150px; font-weight: 600; }
  .verification { margin-top: 26px; border-top: 1px solid #b9c4cf; padding-top: 12px; text-align: center; }
  .verification svg { width: 230px; height: 230px; }
  .verification .mention { font-size: 11px; color: #555; margin-top: 8px; word-break: break-all; }
  .verification .numero-clair { font-size: 13px; font-weight: 700; letter-spacing: .4px; margin-top: 4px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 44px; }
  .signature { width: 30%; border-top: 1px solid #999; padding-top: 4px; text-align: center; color: #555; font-size: 11.5px; }
  footer { margin-top: 26px; font-size: 10px; color: #777; display: flex; justify-content: space-between; border-top: 1px solid #e3e8ee; padding-top: 6px; }
  @media print { body { padding: 8mm; } }
  @page { size: A4; margin: 12mm; }
`;

export class DocumentsAttestation {
  /** Document officiel : en-tête, corps certifiant, QR de vérification. */
  async documentA4(
    a: AttestationImprimable,
    opt: { urlVerification: string; nomEtablissement: string },
  ): Promise<string> {
    const etablissement = echapper(opt.nomEtablissement);
    const libelle = LIBELLE_TYPE[a.type] ?? a.type;
    const edite = dateFr(a.emiseLe);

    const svg = await QRCode.toString(opt.urlVerification, {
      type: 'svg',
      margin: 2,
      width: 230,
      errorCorrectionLevel: 'M',
    });

    const statut = a.statut === StatutAttestation.REVOQUEE
      ? `<div style="margin-top:12px; border:2px solid #a52020; color:#a52020; padding:8px; text-align:center; font-weight:700; letter-spacing:.6px;">DOCUMENT RÉVOQUÉ — SANS VALEUR LÉGALE</div>`
      : '';

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(libelle)} ${echapper(a.numero)}</title>
<style>${STYLE}</style></head>
<body>
  <header>
    <div class="etab">${etablissement}</div>
    <div class="coordonnees">La direction des études — service de la scolarité</div>
    <div class="titre">${echapper(libelle)}</div>
    <div class="numero">N° <strong>${echapper(a.numero)}</strong></div>
  </header>

  <div class="corps">
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
  </div>

  <footer>
    <span>${etablissement}</span>
    <span>Édité le ${edite} — vérification gratuite et publique du QR</span>
  </footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
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