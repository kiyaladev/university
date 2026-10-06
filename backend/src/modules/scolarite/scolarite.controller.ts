/** Scolarité LMD — routes API des évaluations, notes et délibérations.
 *  Les états imprimables (PV, bulletins) suivent le même dispositif que les
 *  rapports : ouverts dans un nouvel onglet sans en-tête Authorization, le
 *  jeton est passé en URL et vérifié ici à la main.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { I18nContext } from 'nestjs-i18n';
import { JwtService } from '@nestjs/jwt';
import { DecisionJury, Role, StatutDeliberation } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles, ProtectedDocument, DocumentScope } from '../../common/decorators';
import { QueryDto } from '../../common/dto';
import { verifierJetonImprimable } from '../../common/jeton-imprimable';
import { ParametresService } from '../parametres/parametres.module';
import { noteLisible } from './calcul.service';
import {
  CreateDeliberationDto,
  CreateEvaluationDto,
  DeliberationQueryDto,
  EvaluationQueryDto,
  NoteQueryDto,
  SaisieNotesDto,
  UpdateEvaluationDto,
} from './scolarite.dto';
import { ScolariteService } from './scolarite.service';
import { echapper } from '../../common/utils';

const SAISIE = [Role.SCOLARITE, Role.ADMIN] as const;
const JURY = [Role.ADMIN, Role.DIRECTION] as const;
/** Lecture des notes et des décisions de jury : jamais ouverte à l'étudiant. */
const NOTES = [Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.CHEF_DEPARTEMENT] as const;

// --------------------------------------------------------------- Évaluations

@ApiTags('Évaluations')
@ApiBearerAuth()
@Controller('evaluations')
@Roles(Role.ADMIN, Role.SCOLARITE, Role.DIRECTION, Role.CHEF_DEPARTEMENT)
export class EvaluationsController {
  constructor(private readonly service: ScolariteService) {}

  @Get()
  lister(@Query() query: EvaluationQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listerEvaluations(query, user);
  }

  @Get(':id')
  @DocumentScope('evaluation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  detail(@Param('id') id: string) {
    return this.service.findEvaluation(id);
  }

  /** Les inscrits de la promotion, pour la feuille de notes. */
  @Roles(...NOTES)
  @Get(':id/etudiants')
  @DocumentScope('evaluation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  feuille(@Param('id') id: string) {
    return this.service.feuilleEvaluation(id);
  }

  @Roles(...SAISIE)
  @Post()
  creer(@Body() dto: CreateEvaluationDto, @CurrentUser() user: AuthUser) {
    return this.service.creerEvaluation(dto, user);
  }

  @Roles(...SAISIE)
  @Put(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateEvaluationDto, @CurrentUser() user: AuthUser) {
    return this.service.modifierEvaluation(id, dto, user);
  }

  @Roles(...SAISIE)
  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.supprimerEvaluation(id, user);
  }

  @Roles(...SAISIE)
  @Post(':id/cloturer')
  cloturer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.cloturerEvaluation(id, user);
  }
}

// -------------------------------------------------------------------- Notes

@ApiTags('Notes')
@ApiBearerAuth()
@Controller('notes')
export class NotesController {
  constructor(private readonly service: ScolariteService) {}

  @Roles(...NOTES)
  @Get()
  lister(@Query() query: NoteQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listerNotes(query, user);
  }

  /** Feuille complète de saisie (avec les cases « présent » cochables). */
  @Roles(...NOTES)
  @Get('evaluation/:id')
  @DocumentScope('evaluation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  feuille(@Param('id') id: string) {
    return this.service.feuilleEvaluation(id);
  }

  /** Saisie en bloc d'une feuille d'évaluation. */
  @Roles(Role.ADMIN, Role.DIRECTION, Role.SCOLARITE, Role.CHEF_DEPARTEMENT)
  @Put('saisie')
  saisir(@Body() dto: SaisieNotesDto, @CurrentUser() user: AuthUser) {
    return this.service.saisirNotes(dto, user);
  }
}

// ------------------------------------------------------------ Délibérations

const PV_STYLE = `
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
  .ADMIS { background: #e3f5e9; color: #17683a; }
  .AJOURNE { background: #fff4e0; color: #8a5300; }
  .DEFAILLANT { background: #fdeaea; color: #a52020; }
  .signatures { display: flex; justify-content: space-between; margin-top: 32px; }
  .signature { width: 30%; border-top: 1px solid #999; padding-top: 4px; text-align: center; color: #555; }
  .infos { margin: 10px 0; line-height: 1.6; }
  .mention { font-style: italic; color: #333; }
  footer { margin-top: 18px; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
  @media print { body { padding: 8mm; } .no-print { display: none; } }
  @page { size: A4; margin: 10mm; }
`;

const LIBELLE_DECISION: Record<string, string> = {
  ADMIS: 'Admis',
  AJOURNE: 'Ajourné',
  DEFAILLANT: 'Défaillant',
};

const LIBELLE_SESSION: Record<string, string> = {
  NORMALE: 'Session normale',
  RATTRAPAGE: 'Session de rattrapage',
};

function decisionBadge(decision: string): string {
  return `<span class="badge ${decision}">${LIBELLE_DECISION[decision] ?? decision}</span>`;
}

@ApiTags('Délibérations')
@ApiBearerAuth()
@Controller('deliberations')
export class DeliberationsController {
  constructor(
    private readonly service: ScolariteService,
    private readonly jwt: JwtService,
    private readonly parametres: ParametresService,
  ) {}

  @Roles(...NOTES)
  @Get()
  lister(@Query() query: DeliberationQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.listerDeliberations(query, user);
  }

  @Roles(...NOTES)
  @Get(':id')
  @DocumentScope('deliberation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  detail(@Param('id') id: string) {
    return this.service.detailDeliberation(id);
  }

  @Roles(...SAISIE)
  @Post()
  creer(@Body() dto: CreateDeliberationDto, @CurrentUser() user: AuthUser) {
    return this.service.creerDeliberation(dto, user);
  }

  @Roles(...SAISIE)
  @Post(':id/calculer')
  calculer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.calculerDeliberation(id, undefined, user);
  }

  /** Le jury fige les résultats : plus aucun recalcul. */
  @Roles(...JURY)
  @Post(':id/valider')
  valider(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.validerDeliberation(id, user.id);
  }

  // ------------------------------------------------------------ Impression

  private async page(titre: string, sousTitre: string, contenu: string) {
    const etablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');
    const edite = new Date().toLocaleString('fr-FR');
    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(titre)}</title>
<style>${PV_STYLE}</style></head>
<body>
  <header>
    <div class="etab">${echapper(etablissement)}</div>
    <div class="titre">${echapper(titre)}</div>
    <div class="sous-titre">${sousTitre}</div>
  </header>
  ${contenu}
  <footer><span>UniPrésence — scolarité LMD</span><span>Édité le ${edite}</span></footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }

  private kpis(items: Array<[string, string | number]>) {
    return `<div class="kpis">${items
      .map(([l, v]) => `<div class="kpi"><span>${echapper(l)}</span><strong>${echapper(v)}</strong></div>`)
      .join('')}</div>`;
  }

  /** Procès-verbal de délibération (PV du jury). */
  @ProtectedDocument(...NOTES)
  @Get(':id/imprimer')
  @DocumentScope('deliberation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  async imprimer(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    verifierJetonImprimable(this.jwt, req);
    const { promotion, annee, session, statut, tauxReussite, lignes, creePar, valideePar } =
      await this.service.pourImpression(id);

    const lignesHtml = lignes
      .map(
        (l: any) => `<tr>
          <td>${l.rang ?? '—'}</td>
          <td>${echapper(l.inscription?.numero ?? '')}</td>
          <td>${echapper(l.inscription?.etudiant?.matricule ?? '')}</td>
          <td><strong>${echapper(`${l.inscription?.etudiant?.nom ?? ''} ${l.inscription?.etudiant?.prenom ?? ''}`)}</strong></td>
          <td>${noteLisible(l.moyenne)}</td>
          <td>${decisionBadge(l.decision)}</td>
          <td class="mention">${echapper(l.mention ?? '')}</td>
        </tr>`,
      )
      .join('');

    const contenu = `
      <div class="infos">
        <strong>Promotion :</strong> ${echapper(promotion?.nom ?? '')}${promotion?.filiere?.nom ? ` — ${echapper(promotion.filiere.nom)}` : ''}<br>
        <strong>Année académique :</strong> ${echapper(annee?.libelle ?? '')} · <strong>Session :</strong> ${LIBELLE_SESSION[session] ?? session}
      </div>
      ${this.kpis([
        ['Étudiants délibérés', lignes.length],
        ['Admis', lignes.filter((l: any) => l.decision === DecisionJury.ADMIS).length],
        ['Ajournés', lignes.filter((l: any) => l.decision === DecisionJury.AJOURNE).length],
        ['Défaillants', lignes.filter((l: any) => l.decision === DecisionJury.DEFAILLANT).length],
        ['Taux de réussite', tauxReussite !== null && tauxReussite !== undefined ? `${tauxReussite} %` : '—'],
        ['Statut', statut === StatutDeliberation.VALIDEE ? 'Validée par le jury' : 'Brouillon'],
      ])}
      <table>
        <thead><tr>
          <th>Rang</th><th>N° inscription</th><th>Matricule</th><th>Étudiant</th>
          <th>Moyenne</th><th>Décision</th><th>Mention</th>
        </tr></thead>
        <tbody>${lignesHtml || '<tr><td colspan="7">Aucune ligne de délibération.</td></tr>'}</tbody>
      </table>
      <div class="signatures">
        <div class="signature">Le président du jury</div>
        <div class="signature">Les assesseurs</div>
        <div class="signature">La scolarité</div>
      </div>`;

    const ligneValidee = statut === StatutDeliberation.VALIDEE && valideePar
      ? ` — validée par ${echapper(`${valideePar.prenom ?? ''} ${valideePar.nom ?? ''}`)}`
      : statut === StatutDeliberation.VALIDEE
        ? ' — validée par le jury'
        : '';
    res.type('html').send(
      await this.page(
        'Procès-verbal de délibération',
        `${echapper(promotion?.nom ?? '')} — ${echapper(annee?.libelle ?? '')}, ${LIBELLE_SESSION[session] ?? session}${ligneValidee}`,
        contenu,
      ),
    );
  }

  /** Bulletin individuel de notes (relevé), une page A4 par étudiant. */
  @ProtectedDocument(...NOTES)
  @Get(':id/releve/:inscriptionId')
  @DocumentScope('deliberation', { [Role.CHEF_DEPARTEMENT]: 'promotion.filiere.departementId' })
  async releve(
    @Param('id') id: string,
    @Param('inscriptionId') inscriptionId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    verifierJetonImprimable(this.jwt, req);
    const { delib, ligne, matieres } = await this.service.bulletin(id, inscriptionId);
    const etudiant = ligne?.inscription?.etudiant;

    const matieresHtml = matieres
      .map((m: any) =>
        `<tr>
          <td>${echapper(m.matiereIntitule)}</td>
          <td>${m.credits}</td>
          <td>${m.epreuves
            .map((e: any) => `${echapper(e.intitule)} (c. ${echapper(e.coefficient)}) : ${e.note !== null ? echapper(e.note) : e.present ? 'non noté' : 'absent'}`)
            .join('<br>')}</td>
          <td><strong>${m.moyenne !== null ? noteLisible(m.moyenne) : '—'}</strong></td>
          <td>${m.enDefaut ? '<span class="badge DEFAILLANT">en défaut</span>' : ''}</td>
        </tr>`,
      )
      .join('');

    const contenu = `
      <div class="infos">
        <strong>Étudiant :</strong> ${echapper(`${etudiant?.nom ?? ''} ${etudiant?.prenom ?? ''}`)}<br>
        <strong>Matricule :</strong> ${echapper(etudiant?.matricule ?? '')} · <strong>N° inscription :</strong> ${echapper(ligne?.inscription?.numero ?? '')}<br>
        <strong>Promotion :</strong> ${echapper(delib.promotion?.nom ?? '')} — ${echapper(delib.annee?.libelle ?? '')} · ${LIBELLE_SESSION[delib.session] ?? delib.session}
      </div>
      <table>
        <thead><tr><th>Matière (UE)</th><th>Crédits</th><th>Épreuves</th><th>Moyenne UE</th><th></th></tr></thead>
        <tbody>${matieresHtml || '<tr><td colspan="5">Aucune matière évaluée.</td></tr>'}</tbody>
      </table>
      <div class="kpis">
        <div class="kpi"><span>Moyenne générale</span><strong>${noteLisible(ligne?.moyenne ?? 0)}</strong></div>
        <div class="kpi"><span>Décision du jury</span><strong>${decisionBadge(ligne?.decision)}</strong></div>
        <div class="kpi"><span>Mention</span><strong>${echapper(ligne?.mention ?? '—')}</strong></div>
        <div class="kpi"><span>Rang</span><strong>${ligne?.rang ?? '—'}</strong></div>
      </div>
      <div class="signatures">
        <div class="signature">La scolarité</div>
        <div class="signature">Le Président du jury</div>
        <div class="signature">L'étudiant${''}</div>
      </div>`;

    res.type('html').send(
      await this.page(
        'Bulletin de délibération',
        `${echapper(`${etudiant?.nom ?? ''} ${etudiant?.prenom ?? ''}`)} — ${echapper(delib.promotion?.nom ?? '')}`,
        contenu,
      ),
    );
  }
}
