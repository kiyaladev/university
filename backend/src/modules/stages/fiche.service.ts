/** Fiche récapitulative d'un travail encadré — HTML A4 ouvert dans un nouvel
 *  onglet, imprimé via le navigateur. Le gabarit reprend la mise en page de
 *  modules/rapports/impression.service.ts : c'en est une copie LOCALE, ce
 *  service d'origine n'est jamais modifié. */
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametresService } from '../parametres/parametres.module';

const LIBELLE_TYPE: Record<string, string> = {
  STAGE: 'Stage',
  MEMOIRE: 'Mémoire',
  RAPPORT: 'Rapport',
};

const LIBELLE_STATUT: Record<string, string> = {
  PROPOSE: 'Proposé',
  VALIDE: 'Validé',
  EN_COURS: 'En cours',
  SOUTENU: 'Soutenu',
  ABANDONNE: 'Abandonné',
};

const COULEUR_STATUT: Record<string, string> = {
  PROPOSE: 'RETARD',
  VALIDE: 'EXCUSE',
  EN_COURS: 'PRESENT',
  SOUTENU: 'PRESENT',
  ABANDONNE: 'ABSENT',
};

function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Copie locale du gabarit de modules/rapports/impression.service.ts. */
const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1d1d1d; margin: 0; padding: 16mm 12mm; font-size: 12px; }
  header { border-bottom: 2px solid #1565c0; padding-bottom: 8px; margin-bottom: 14px; }
  .etab { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .titre { font-size: 19px; font-weight: 700; margin-top: 6px; color: #0d47a1; }
  .sous-titre { color: #555; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #b9c4cf; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #e8eef5; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
  tbody tr:nth-child(even) { background: #fafbfd; }
  .kpis { display: flex; gap: 10px; margin: 12px 0; flex-wrap: wrap; }
  .kpi { flex: 1 1 120px; border: 1px solid #d6dee7; border-radius: 6px; padding: 8px 10px; }
  .kpi span { display: block; font-size: 10px; color: #666; text-transform: uppercase; }
  .kpi strong { font-size: 18px; color: #0d47a1; }
  .badge { padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .PRESENT { background: #e3f5e9; color: #17683a; }
  .RETARD { background: #fff4e0; color: #8a5300; }
  .ABSENT { background: #fdeaea; color: #a52020; }
  .EXCUSE { background: #eef0fb; color: #3b419e; }
  .REMPLACE, .DEPART_ANTICIPE { background: #eef4f8; color: #33586e; }
  .NON_CONTROLE { background: #f0f0f0; color: #666; }
  .signatures { display: flex; justify-content: space-between; margin-top: 28px; }
  .signature { width: 30%; border-top: 1px solid #999; padding-top: 4px; text-align: center; color: #555; }
  footer { margin-top: 18px; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
  @media print { body { padding: 8mm; } }
  @page { size: A4; margin: 10mm; }
`;

function dateFr(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('fr-FR');
}

function dateHeureFr(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('fr-FR');
}

const TRAVAIL_FICHE_INCLUDE = {
  etudiant: true,
  encadrant: true,
  soutenance: { include: { salle: true, president: true } },
};

@Injectable()
export class FicheService {
  constructor(
    private prisma: PrismaService,
    private parametres: ParametresService,
    private jwt: JwtService,
  ) {}

  /** Fiche récapitulative : page ouverte dans un nouvel onglet sans en-tête
   *  Authorization, le jeton passe par l'URL et est vérifié à la main. */
  async fiche(id: string, token: string | undefined): Promise<string> {
    try {
      await this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }

    const travail: any = await this.prisma.travailEncadre.findUnique({
      where: { id },
      include: TRAVAIL_FICHE_INCLUDE,
    });
    if (!travail) {
      throw new NotFoundException('Travail encadré introuvable');
    }

    const etablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');
    const edite = new Date().toLocaleString('fr-FR');
    const lignes: Array<[string, string]> = [
      ['Intitulé', travail.intitule],
      ['Description', travail.description ?? '—'],
      ['Étudiant', `${travail.etudiant?.nom ?? ''} ${travail.etudiant?.prenom ?? ''}${travail.etudiant?.matricule ? ` (${travail.etudiant.matricule})` : ''}`],
      ['Encadrant', travail.encadrantId ? `${travail.encadrant?.nom ?? ''} ${travail.encadrant?.prenom ?? ''}${travail.encadrant?.grade ? ` — ${travail.encadrant.grade}` : ''}` : 'À désigner'],
      ['Entreprise', travail.entreprise ?? '—'],
      ['Tuteur entreprise', travail.tuteurEntreprise ?? '—'],
      ['Lieu', travail.lieu ?? '—'],
      ['Période', `${dateFr(travail.dateDebut)} → ${dateFr(travail.dateFin)}`],
      ['Rapport rendu', travail.rapportRendu ? 'Oui' : 'Non'],
    ];

    const blocSoutenance = travail.soutenance
      ? `<h3 style="margin-top:16px">Soutenance</h3>
      <table><tbody>
        <tr><th>Date</th><td>${echapper(dateHeureFr(travail.soutenance.date))}</td></tr>
        <tr><th>Salle</th><td>${echapper(travail.soutenance.salle ? `${travail.soutenance.salle.nom} (${travail.soutenance.salle.code})` : '—')}</td></tr>
        <tr><th>Président</th><td>${echapper(travail.soutenance.presidentId ? `${travail.soutenance.president?.nom ?? ''} ${travail.soutenance.president?.prenom ?? ''}` : '—')}</td></tr>
        <tr><th>Assesseurs</th><td>${echapper(travail.soutenance.assesseurs ?? '—')}</td></tr>
        <tr><th>Note</th><td>${travail.soutenance.note ?? '—'}</td></tr>
        <tr><th>Mention</th><td>${echapper(travail.soutenance.mention ?? '—')}</td></tr>
      </table>`
      : '';

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Fiche travail encadré — ${echapper(travail.intitule)}</title>
<style>${STYLE}</style></head>
<body>
  <header>
    <div class="etab">${echapper(etablissement)}</div>
    <div class="titre">Fiche récapitulative — ${LIBELLE_TYPE[travail.type] ?? travail.type}</div>
    <div class="sous-titre">Établie le ${echapper(dateFr(new Date()))} · document à conserver au dossier</div>
  </header>

  <div class="kpis">
    <div class="kpi"><span>Type</span><strong>${LIBELLE_TYPE[travail.type] ?? travail.type}</strong></div>
    <div class="kpi"><span>Statut</span><strong><span class="badge ${COULEUR_STATUT[travail.statut] ?? 'NON_CONTROLE'}">${LIBELLE_STATUT[travail.statut] ?? travail.statut}</span></strong></div>
    <div class="kpi"><span>Rapport</span><strong>${travail.rapportRendu ? 'Rendu' : 'Non rendu'}</strong></div>
  </div>

  <table>
    <tbody>${lignes
      .map(([k, v]) => `<tr><th style="width:26%">${echapper(k)}</th><td>${v}</td></tr>`)
      .join('')}
    </tbody>
  </table>

  ${blocSoutenance}

  <div class="signatures">
    <div class="signature">L’étudiant</div>
    <div class="signature">L’encadrant</div>
    <div class="signature">La direction des études</div>
  </div>

  <footer><span>UniÉcole — suivi des stages et mémoires</span><span>Édité le ${echapper(edite)}</span></footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }
}