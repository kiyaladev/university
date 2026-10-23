import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { chargerEtablissement, PALETTE_IMPRESSION as P } from '../../common/impression';
import { ParametresService } from '../parametres/parametres.service';
import { RapportsService } from './rapports.service';
import { ReleveHebdomadaireDto } from './rapports.dto';
import { journaliser } from '../../common/audit';
import { estChefDeDepartement } from '../../common/perimetre';
import { t } from '../../common/i18n';

const LARGEURS = [40, 61, 118, 144, 49, 96, 62, 188];
const STATUTS: Record<string, string> = {
  PRESENT: 'Présent', RETARD: 'Retard', ABSENT: 'Absent', EXCUSE: 'Excusé',
  REMPLACE: 'Remplacé', DEPART_ANTICIPE: 'Départ anticipé', NON_CONTROLE: 'Non contrôlé',
};

function decoderSignature(data: string): Buffer {
  const base64 = data.replace(/^data:image\/png;base64,/, '');
  const png = Buffer.from(base64, 'base64');
  const signaturePng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    png.length < 33 || png.length > 768_000 || !png.subarray(0, 8).equals(signaturePng)
    || png.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw new BadRequestException(t('rapports.signaturePngInvalide'));
  }
  const largeur = png.readUInt32BE(16);
  const hauteur = png.readUInt32BE(20);
  if (!largeur || !hauteur || largeur > 4000 || hauteur > 4000 || largeur * hauteur > 8_000_000) {
    throw new BadRequestException(t('rapports.signatureResolutionExcessive'));
  }
  return png;
}

function dateIso(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

function dateFr(date: Date | string) {
  return new Date(`${dateIso(date)}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

function hash(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}

@Injectable()
export class RelevePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rapports: RapportsService,
    private readonly parametres: ParametresService,
  ) {}

  async generer(dto: ReleveHebdomadaireDto, user: AuthUser) {
    if (!estChefDeDepartement(user) || !user.departementId || user.departementId !== dto.departementId) {
      throw new ForbiddenException(t('rapports.releveReserveChefDepartement'));
    }
    const [chef, departement] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, nom: true, prenom: true, role: true, actif: true, departementId: true },
      }),
      this.prisma.departement.findUnique({ where: { id: dto.departementId }, select: { id: true, nom: true } }),
    ]);
    if (!chef || !chef.actif || chef.role !== Role.CHEF_DEPARTEMENT || chef.departementId !== dto.departementId) {
      throw new ForbiddenException(t('rapports.compteSignatureNonChef'));
    }
    if (!departement) throw new NotFoundException(t('rapports.departementIntrouvable'));

    const debut = new Date(`${dto.dateDebut}T00:00:00Z`);
    const fin = new Date(`${dto.dateFin}T00:00:00Z`);
    const finAttendue = new Date(debut.getTime() + 6 * 86_400_000);
    if (debut.getUTCDay() !== 1 || dateIso(fin) !== dateIso(finAttendue)) {
      throw new BadRequestException(t('rapports.releveSemaineComplete'));
    }
    const signatureChef = decoderSignature(dto.signatureBase64);
    const signatureHash = hash(signatureChef);
    const numero = `RH-${dto.dateDebut.slice(0, 4)}-${dto.departementId.slice(0, 6).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const { nom: etablissement } = await chargerEtablissement(this.prisma);
    const rapport = await this.rapports.registre({
      dateDebut: dto.dateDebut,
      dateFin: dto.dateFin,
      departementId: dto.departementId,
    }, true);

    const document = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, compress: true });
    document.info.Title = `Relevé hebdomadaire ${departement.nom} ${dto.dateDebut}`;
    document.info.Author = `${chef.prenom} ${chef.nom} — ${etablissement}`;
    const morceaux: Buffer[] = [];
    const sortie = new Promise<Buffer>((resolve, reject) => {
      document.on('data', (morceau: Buffer) => morceaux.push(morceau));
      document.on('error', reject);
      document.on('end', () => resolve(Buffer.concat(morceaux)));
    });

    const x0 = document.page.margins.left;
    const droite = document.page.width - document.page.margins.right;
    const largeurTable = LARGEURS.reduce((a, b) => a + b, 0);
    const dessinerEnteteTable = () => {
      const titres = ['Date', 'Horaire', 'Enseignant', 'Matière / promotion', 'Salle', 'État / arrivée', 'Heures', 'Signature enseignant'];
      let x = x0;
      const y = document.y;
      document.font('Helvetica-Bold').fontSize(7).fillColor(P.grisFond);
      for (let i = 0; i < LARGEURS.length; i += 1) {
        document.rect(x, y, LARGEURS[i], 24).fillAndStroke(P.grisFond, P.encreTertiaire);
        document.fillColor(P.encre).text(titres[i], x + 3, y + 5, { width: LARGEURS[i] - 6, height: 16, ellipsis: true });
        x += LARGEURS[i];
      }
      document.y = y + 24;
    };
    const dessinerEntetePage = (premiere: boolean) => {
      document.font('Helvetica-Bold').fontSize(premiere ? 15 : 9).fillColor(P.encre)
        .text(etablissement, x0, document.y, { width: largeurTable });
      document.moveDown(0.35);
      if (premiere) {
        document.font('Helvetica-Bold').fontSize(12).fillColor(P.encre)
          .text('RELEVÉ HEBDOMADAIRE DES SÉANCES', x0, document.y, { width: largeurTable, align: 'center' });
        document.moveDown(0.35);
        document.font('Helvetica').fontSize(9).fillColor(P.encre)
          .text(`Département : ${departement.nom}    Semaine : ${dateFr(dto.dateDebut)} – ${dateFr(dto.dateFin)}`, x0, document.y, { width: largeurTable });
        document.text(`Numéro : ${numero}    Généré le : ${new Date().toLocaleString('fr-FR')}`, x0, document.y + 2, { width: largeurTable });
        document.moveDown(1.6);
        const s = rapport.synthese;
        document.font('Helvetica-Bold').fontSize(8).fillColor(P.encre)
          .text(`Séances : ${s.planifiees}    Contrôlées : ${s.controlees} (${s.tauxControle} %)    Assurées : ${s.assurees} (${s.tauxPresence} %)    Heures constatées : ${s.heuresRealisees} h`, x0, document.y, { width: largeurTable });
        document.moveDown(0.8);
      }
      dessinerEnteteTable();
    };

    dessinerEntetePage(true);
    document.on('pageAdded', () => {
      document.y = document.page.margins.top;
      dessinerEntetePage(false);
    });

    const lignes = rapport.lignes;
    for (let index = 0; index < lignes.length; index += 1) {
      const ligne = lignes[index];
      const signatureEnseignant = (ligne as typeof ligne & { signatureBase64?: string | null }).signatureBase64;
      const valeurs = [
        dateFr(ligne.date),
        ligne.horaire,
        `${ligne.enseignant}\n${ligne.matricule}`,
        `${ligne.matiere}\n${ligne.promotion}`,
        ligne.salle,
        `${STATUTS[ligne.statut] ?? ligne.statut}\n${ligne.heureArrivee === '—' ? '' : `Arrivée ${ligne.heureArrivee}`}`,
        ligne.dureeMinutes ? (ligne.dureeMinutes / 60).toFixed(2) : '—',
        '',
      ];
      document.font('Helvetica').fontSize(7).fillColor(P.encre);
      const hauteurTexte = valeurs.slice(0, 7).map((valeur, i) =>
        document.heightOfString(valeur, { width: LARGEURS[i] - 8, lineGap: 1 }),
      );
      const hauteur = Math.max(34, Math.max(...hauteurTexte) + 8);
      if (document.y + hauteur > document.page.height - document.page.margins.bottom - 8) document.addPage();
      const y = document.y;
      let x = x0;
      for (let i = 0; i < LARGEURS.length; i += 1) {
        document.rect(x, y, LARGEURS[i], hauteur).stroke(P.encreTertiaire);
        if (i < 7) {
          document.font('Helvetica').fontSize(7).fillColor(P.encre).text(valeurs[i], x + 3, y + 4, {
            width: LARGEURS[i] - 6, height: hauteur - 8, ellipsis: true,
          });
        } else if (signatureEnseignant) {
          try {
            const signature = decoderSignature(signatureEnseignant);
            document.image(signature, x + 4, y + 3, { fit: [LARGEURS[i] - 8, hauteur - 6], align: 'center', valign: 'center' });
          } catch {
            document.font('Helvetica').fontSize(6).fillColor(P.encreDouce).text('Signature enregistrée', x + 3, y + 8, { width: LARGEURS[i] - 6 });
          }
        } else {
          document.font('Helvetica').fontSize(7).fillColor(P.encreTertiaire).text('—', x + 3, y + 8, { width: LARGEURS[i] - 6, align: 'center' });
        }
        x += LARGEURS[i];
      }
      document.y = y + hauteur;
    }

    const hauteurSignature = 118;
    if (document.y + hauteurSignature > document.page.height - document.page.margins.bottom) document.addPage();
    document.moveDown(1.2);
    const ySignature = document.y;
    document.font('Helvetica-Bold').fontSize(9).fillColor(P.encre)
      .text('Signature du chef de département', droite - 230, ySignature, { width: 230, align: 'center' });
    try {
      document.image(signatureChef, droite - 190, ySignature + 15, { fit: [150, 55], align: 'center', valign: 'center' });
    } catch {
      throw new BadRequestException(t('rapports.signatureNonIntegrable'));
    }
    document.moveTo(droite - 230, ySignature + 75).lineTo(droite, ySignature + 75).stroke(P.encre);
    document.font('Helvetica').fontSize(8).fillColor(P.encre)
      .text(`${chef.prenom} ${chef.nom} — chef de département`, droite - 230, ySignature + 79, { width: 230, align: 'center' });
    document.text(`Numéro de relevé : ${numero}`, x0, ySignature + 25, { width: 320 });
    document.text(`Semaine close le ${dateFr(dto.dateFin)} · ${lignes.length} séance(s)`, x0, ySignature + 42, { width: 320 });
    document.end();
    const pdf = await sortie;
    const pdfHash = hash(pdf);
    await journaliser(
      this.prisma,
      chef,
      'RAPPORT_HEBDOMADAIRE_SIGNE',
      'RapportHebdomadaire',
      numero,
      { departementId: departement.id, dateDebut: dto.dateDebut, dateFin: dto.dateFin, signatureHash, pdfHash },
    );
    return { numero, pdf, pdfHash };
  }
}
