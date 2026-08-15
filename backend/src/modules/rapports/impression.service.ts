/** Génération des états imprimables (HTML A4, impression navigateur → PDF).
 *  Remplace les feuillets du registre papier tout en gardant leur mise en forme. */
import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametresService } from '../parametres/parametres.module';
import { RapportsService } from './rapports.service';
import { RapportQueryDto } from './rapports.dto';

const ATTESTATION_LIBELLE: Record<string, string> = {
  SIGNATURE: 'Signature',
  CODE_PIN: 'Code personnel',
  EMPREINTE: 'Empreinte digitale',
  PASSKEY: 'Téléphone de l’enseignant',
  AUCUNE: '—',
};

const STATUT_LIBELLE: Record<string, string> = {
  PRESENT: 'Présent',
  RETARD: 'Retard',
  ABSENT: 'Absent',
  EXCUSE: 'Excusé',
  REMPLACE: 'Remplacé',
  DEPART_ANTICIPE: 'Départ anticipé',
  NON_CONTROLE: 'Non contrôlé',
};

/** Colonne « attestation » du registre : la signature manuscrite y est reproduite,
 *  les autres moyens sont mentionnés en toutes lettres. */
function attestationHtml(l: {
  attestation?: string | null;
  attestationValide?: boolean;
  signatureBase64?: string | null;
  observation?: string;
}): string {
  if (l.signatureBase64) {
    return `<img src="${l.signatureBase64}" alt="signature" class="signature" />`;
  }
  if (!l.attestation || l.attestation === 'AUCUNE') {
    return '<span class="badge NON_CONTROLE">non attestée</span>';
  }
  return `<span class="badge ${l.attestationValide ? 'PRESENT' : 'NON_CONTROLE'}">${
    ATTESTATION_LIBELLE[l.attestation] ?? l.attestation
  }</span>`;
}

function echapper(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
  .attestation { text-align: center; min-width: 92px; }
  .signature { max-height: 34px; max-width: 110px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 28px; }
  .signature { width: 30%; border-top: 1px solid #999; padding-top: 4px; text-align: center; color: #555; }
  footer { margin-top: 18px; font-size: 10px; color: #777; display: flex; justify-content: space-between; }
  @media print { body { padding: 8mm; } .no-print { display: none; } }
  @page { size: A4; margin: 10mm; }
`;

@Injectable()
export class ImpressionService {
  constructor(
    private prisma: PrismaService,
    private rapports: RapportsService,
    private parametres: ParametresService,
  ) {}

  private async page(titre: string, sousTitre: string, contenu: string) {
    const etablissement = await this.parametres.valeur('NOM_ETABLISSEMENT');
    const edite = new Date().toLocaleString('fr-FR');

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(titre)}</title>
<style>${STYLE}</style></head>
<body>
  <header>
    <div class="etab">${echapper(etablissement)}</div>
    <div class="titre">${echapper(titre)}</div>
    <div class="sous-titre">${sousTitre}</div>
  </header>
  ${contenu}
  <footer><span>UniPrésence — contrôle numérique de présence des enseignants</span><span>Édité le ${edite}</span></footer>
  <script>window.onload = () => window.matchMedia('print').matches || setTimeout(() => window.print(), 300);</script>
</body></html>`;
  }

  private kpis(items: Array<[string, string | number]>) {
    return `<div class="kpis">${items
      .map(([l, v]) => `<div class="kpi"><span>${echapper(l)}</span><strong>${echapper(v)}</strong></div>`)
      .join('')}</div>`;
  }

  /** Registre journalier de contrôle. */
  async registre(query: RapportQueryDto) {
    const r = await this.rapports.registre(query);
    const lignes = r.lignes
      .map(
        (l) => `<tr>
        <td>${echapper(l.horaire)}</td>
        <td>${echapper(l.enseignant)}<br><small>${echapper(l.matricule)}</small></td>
        <td>${echapper(l.matiere)}<br><small>${echapper(l.promotion)}</small></td>
        <td>${echapper(l.salle)}</td>
        <td><span class="badge ${l.statut}">${STATUT_LIBELLE[l.statut] ?? l.statut}</span></td>
        <td>${echapper(l.heureArrivee)}</td>
        <td>${echapper(l.heureFinReelle)}</td>
        <td>${l.dureeMinutes ? `${Math.floor(l.dureeMinutes / 60)}h${String(l.dureeMinutes % 60).padStart(2, '0')}` : '—'}</td>
        <td>${l.effectifPresent ?? '—'}</td>
        <td>${echapper(l.thematiqueTraitee)}</td>
        <td class="attestation">${attestationHtml(l)}</td>
      </tr>`,
      )
      .join('');

    const contenu = `
      ${this.kpis([
        ['Séances', r.total],
        ['Contrôlées', r.synthese.controlees],
        ['Assurées', r.synthese.assurees],
        ['Absences', r.synthese.absent],
        ['Retards', r.synthese.retard],
        ['Heures réalisées', `${r.synthese.heuresRealisees} h`],
        ['Taux de présence', `${r.synthese.tauxPresence} %`],
      ])}
      <table>
        <thead><tr>
          <th>Horaire</th><th>Enseignant</th><th>Matière / Promotion</th><th>Salle</th>
          <th>Statut</th><th>Arrivée</th><th>Fin</th><th>Durée</th><th>Étud.</th>
          <th>Thème déroulé</th><th>Attestation de l'enseignant</th>
        </tr></thead>
        <tbody>${lignes || '<tr><td colspan="11">Aucune séance sur la période.</td></tr>'}</tbody>
      </table>
      <div class="signatures">
        <div class="signature">Le contrôleur</div>
        <div class="signature">Le chef de département</div>
        <div class="signature">La direction des études</div>
      </div>`;

    return this.page(
      'Registre de contrôle des séances',
      `Journée du ${echapper(r.date)}${query.dateFin && query.dateFin !== r.date ? ` au ${echapper(query.dateFin)}` : ''}`,
      contenu,
    );
  }

  /** Fiche individuelle d'assiduité d'un enseignant. */
  async ficheEnseignant(enseignantId: string, query: RapportQueryDto) {
    const f = await this.rapports.ficheEnseignant(enseignantId, query);
    const e = f.enseignant;

    const lignes = f.seances
      .map(
        (s) => `<tr>
        <td>${echapper(s.date)}</td><td>${echapper(s.horaire)}</td>
        <td>${echapper(s.matiere)}</td><td>${echapper(s.promotion)}</td><td>${echapper(s.salle)}</td>
        <td><span class="badge ${s.statut}">${STATUT_LIBELLE[s.statut] ?? s.statut}</span></td>
        <td>${s.dureeMinutes} min</td><td>${echapper(s.thematiqueTraitee)}</td>
      </tr>`,
      )
      .join('');

    const contenu = `
      <p><strong>${echapper(`${e?.nom ?? ''} ${e?.prenom ?? ''}`)}</strong> — matricule ${echapper(e?.matricule)}<br>
      ${echapper(e?.grade ?? '')} · ${echapper(e?.statut)} · ${echapper(e?.departement?.nom ?? 'Sans département')}</p>
      ${this.kpis([
        ['Séances programmées', f.synthese.planifiees],
        ['Contrôlées', f.synthese.controlees],
        ['Assurées', f.synthese.assurees],
        ['Absences', f.synthese.absent],
        ['Retards', f.synthese.retard],
        ['Heures réalisées', `${f.synthese.heuresRealisees} h`],
        ['Taux de présence', `${f.synthese.tauxPresence} %`],
      ])}
      <table><thead><tr>
        <th>Date</th><th>Horaire</th><th>Matière</th><th>Promotion</th><th>Salle</th>
        <th>Statut</th><th>Durée</th><th>Thème déroulé</th>
      </tr></thead><tbody>${lignes || '<tr><td colspan="8">Aucune séance.</td></tr>'}</tbody></table>
      <div class="signatures">
        <div class="signature">L'enseignant</div>
        <div class="signature">Le chef de département</div>
        <div class="signature">La direction des études</div>
      </div>`;

    return this.page(
      "Fiche individuelle d'assiduité",
      `Période du ${echapper(query.dateDebut ?? '—')} au ${echapper(query.dateFin ?? '—')}`,
      contenu,
    );
  }

  /** État de paiement des vacataires sur la période. */
  async etatPaiement(query: RapportQueryDto) {
    const r = await this.rapports.etatPaiement(query);
    const lignes = r.lignes
      .map(
        (l, i) => `<tr>
        <td>${i + 1}</td><td>${echapper(l.matricule)}</td><td>${echapper(l.nom)}</td>
        <td>${echapper(l.departement ?? '—')}</td><td>${echapper(l.statutEnseignant)}</td>
        <td>${l.seancesAssurees}</td><td>${l.heuresRealisees}</td>
        <td>${l.tauxHoraire.toLocaleString('fr-FR')}</td>
        <td><strong>${l.montant.toLocaleString('fr-FR')}</strong></td>
      </tr>`,
      )
      .join('');

    const contenu = `
      ${this.kpis([
        ['Enseignants', r.lignes.length],
        ['Heures payables', `${r.totalHeures} h`],
        ['Montant total', r.totalMontant.toLocaleString('fr-FR')],
      ])}
      <table><thead><tr>
        <th>#</th><th>Matricule</th><th>Enseignant</th><th>Département</th><th>Statut</th>
        <th>Séances</th><th>Heures</th><th>Taux horaire</th><th>Montant</th>
      </tr></thead><tbody>${lignes || '<tr><td colspan="9">Aucune heure réalisée sur la période.</td></tr>'}</tbody></table>
      <div class="signatures">
        <div class="signature">Le service financier</div>
        <div class="signature">La direction des études</div>
        <div class="signature">Le recteur / doyen</div>
      </div>`;

    return this.page(
      'État de paiement des heures assurées',
      `Période du ${echapper(query.dateDebut ?? '—')} au ${echapper(query.dateFin ?? '—')} — heures effectivement contrôlées`,
      contenu,
    );
  }

  /** Affichettes QR à coller dans chaque salle. */
  async affichesQr(salleId?: string) {
    const salles = await this.prisma.salle.findMany({
      where: { actif: true, ...(salleId ? { id: salleId } : {}) },
      orderBy: { code: 'asc' },
    });

    const blocs = await Promise.all(
      salles.map(async (s) => {
        const svg = await QRCode.toString(s.qrToken, { type: 'svg', margin: 1, width: 220 });
        return `<div style="page-break-after: always; text-align:center; padding-top:20mm">
          <div class="titre" style="font-size:26px">${echapper(s.code)} — ${echapper(s.nom)}</div>
          <p>${echapper(s.batiment ?? '')} · capacité ${s.capacite} places</p>
          <div style="margin:14px auto; width:220px">${svg}</div>
          <p style="font-size:13px">Le contrôleur scanne ce code pour attester sa présence dans la salle.</p>
          <p style="font-size:10px; color:#888">${echapper(s.qrToken)}</p>
        </div>`;
      }),
    );

    return this.page(
      'Affiches QR des salles',
      `${salles.length} salle(s) — à afficher à l'entrée de chaque salle`,
      blocs.join('') || '<p>Aucune salle active.</p>',
    );
  }
}
