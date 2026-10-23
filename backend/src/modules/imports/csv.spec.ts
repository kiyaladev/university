import { lireCsv, normaliserEntete } from './csv';

describe('lecture des fichiers CSV de référentiels', () => {
  it('normalise les accents, un BOM et les espaces de colonne', () => {
    expect(normaliserEntete('\uFEFFPrénom enseignant')).toBe('prenom');
    expect(normaliserEntete('Volume horaire total')).toBe('volumeHoraireTotal');
  });

  it('reconnaît les libellés français courants des exports de planning', () => {
    expect(normaliserEntete('Jour de la semaine')).toBe('jourSemaine');
    expect(normaliserEntete('Heure de début')).toBe('heureDebut');
    expect(normaliserEntete('Heure de début du cours')).toBe('heureDebut');
    expect(normaliserEntete('Heure de fin')).toBe('heureFin');
    expect(normaliserEntete('Type de cours')).toBe('type');
    expect(normaliserEntete('Nom de l’enseignant')).toBe('nom');
    expect(normaliserEntete('Date de début')).toBe('dateDebut');
    expect(normaliserEntete('Taux horaire (€)')).toBe('tauxHoraire');
    expect(normaliserEntete('Volume horaire (h)')).toBe('volumeHoraireTotal');
    expect(normaliserEntete('Intitulé de la matière')).toBe('intitule');
  });

  it('lit un export français avec champs cités, séparateur interne et retours multilignes', () => {
    const csv = lireCsv('Matricule;Nom;Prénom;Email\r\nT-01;"Diallo; Camara";"Aïssatou\nMarie";a@example.org');
    expect(csv.erreurs).toEqual([]);
    expect(csv.entetes).toEqual(['matricule', 'nom', 'prenom', 'email']);
    expect(csv.lignes).toEqual([
      {
        numero: 2,
        donnees: { matricule: 'T-01', nom: 'Diallo; Camara', prenom: 'Aïssatou\nMarie', email: 'a@example.org' },
      },
    ]);
  });

  it('repère les en-têtes après un titre préliminaire contenant une virgule', () => {
    const csv = lireCsv('Enseignants, export du 05/10/2026\n\nMatricule;Nom;Prénom\nT-01;Diallo;Awa');
    expect(csv.entetes).toEqual(['matricule', 'nom', 'prenom']);
    expect(csv.lignes[0]).toEqual({ numero: 4, donnees: { matricule: 'T-01', nom: 'Diallo', prenom: 'Awa' } });
  });

  it('retient explicitement les en-têtes inconnus pour avertir avant import', () => {
    const csv = lireCsv('Matricule;Nom;Prénom;Département\nT-01;Diallo;Awa;D-1');
    expect(csv.colonnesIgnorees).toEqual(['Département']);
  });

  it('reconnaît le séparateur virgule et les guillemets échappés', () => {
    const csv = lireCsv('code,intitule\nM1,"Analyse, probabilités et ""mesure"""');
    expect(csv.entetes).toEqual(['code', 'intitule']);
    expect(csv.lignes[0].donnees.intitule).toBe('Analyse, probabilités et "mesure"');
  });

  it('signale deux colonnes normalisées vers la même propriété', () => {
    expect(lireCsv('Prénom;Prenom\nA;B').erreurs[0]).toContain('prenom');
  });

  it('refuse un guillemet non refermé', () => {
    expect(lireCsv('code;intitule\nM1;"Analyse').erreurs[0]).toContain('non refermés');
  });
});
