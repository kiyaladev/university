/** Fiche récapitulative d'un travail encadré — HTML A4 ouvert dans un nouvel
 *  onglet, imprimé via le navigateur. L'enveloppe et le style viennent du
 *  gabarit commun `common/impression` (pageA4). */
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { t } from '../../common/i18n';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametresService } from '../parametres/parametres.service';
import { chargerEtablissement, echapper, pageA4 } from '../../common/impression';

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

/** Règles propres à la fiche ; le reste (états de présence compris) vient de `pageA4`. */
const STYLE = `
  .signatures { margin-top: 28px; }
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
  etudiant: { select: { id: true, matricule: true, nom: true, prenom: true } },
  encadrant: { select: { id: true, nom: true, prenom: true, grade: true } },
  soutenance: {
    select: {
      id: true,
      presidentId: true,
      date: true,
      assesseurs: true,
      note: true,
      mention: true,
      salle: { select: { id: true, code: true, nom: true } },
      president: { select: { id: true, nom: true, prenom: true } },
    },
  },
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
      throw new UnauthorizedException(t('stages.jeton_invalide_ou_expire'));
    }

    const travail: any = await this.prisma.travailEncadre.findUnique({
      where: { id },
      include: TRAVAIL_FICHE_INCLUDE,
    });
    if (!travail) {
      throw new NotFoundException(t('stages.travail_encadre_introuvable'));
    }

    const etablissement = await chargerEtablissement(this.prisma);
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

    return pageA4({
      titre: `Fiche travail encadré — ${travail.intitule}`,
      lang: 'fr',
      etablissement,
      styles: STYLE,
      entete: `<div class="etab">${echapper(etablissement.nom)}</div>
    <div class="titre">Fiche récapitulative — ${LIBELLE_TYPE[travail.type] ?? travail.type}</div>
    <div class="sous-titre">Établie le ${echapper(dateFr(new Date()))} · document à conserver au dossier</div>`,
      corps: `<div class="kpis">
    <div class="kpi"><span>Type</span><strong>${LIBELLE_TYPE[travail.type] ?? travail.type}</strong></div>
    <div class="kpi"><span>Statut</span><strong><span class="badge ${COULEUR_STATUT[travail.statut] ?? 'NON_CONTROLE'}">${LIBELLE_STATUT[travail.statut] ?? travail.statut}</span></strong></div>
    <div class="kpi"><span>Rapport</span><strong>${travail.rapportRendu ? 'Rendu' : 'Non rendu'}</strong></div>
  </div>

  <table>
    <tbody>${lignes
      .map(([k, v]) => `<tr><th style="width:26%">${echapper(k)}</th><td>${echapper(v)}</td></tr>`)
      .join('')}
    </tbody>
  </table>

  ${blocSoutenance}

  <div class="signatures">
    <div class="signature">L’étudiant</div>
    <div class="signature">L’encadrant</div>
    <div class="signature">La direction des études</div>
  </div>`,
      piedDePage: `<span>UniÉcole — suivi des stages et mémoires</span><span>Édité le ${echapper(edite)}</span>`,
    });
  }
}
