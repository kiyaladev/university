/** Tests des règles de délibération — le cœur du jury, figé dans le code. */
import { classer, decider, mention, moyenneGenerale, moyenneUe } from './calcul.service';

/**
 * Feuille type : une matière peut porter plusieurs épreuves (CC + examen).
 * Les trois scénarios montrent la règle d'absence : à une épreuve clôturée,
 * une absence consignée vaut 0/20 (avec pondération), une ligne jamais saisie
 * met la matière en défaut, une épreuve ouverte ne compte pas les absences.
 */
describe('moyenneUe', () => {
  it('pondère les épreuves par leur coefficient', () => {
    const r = moyenneUe([
      { note: 10, present: true, coefficient: 1, cloturee: false },
      { note: 14, present: true, coefficient: 2, cloturee: true },
    ]);
    expect(r.moyenne).toBe(12.67); // (10×1 + 14×2) / 3
    expect(r.enDefaut).toBe(false);
  });

  it('ne compte pas une évaluation ouverte non notée', () => {
    const r = moyenneUe([
      { note: null, present: true, coefficient: 1, cloturee: false },
      { note: 12, present: true, coefficient: 1, cloturee: true },
    ]);
    expect(r.moyenne).toBe(12);
    expect(r.enDefaut).toBe(false);
  });

  it('compte 0/20 pour une absence consignée à une épreuve clôturée', () => {
    const r = moyenneUe([
      { note: null, present: false, coefficient: 1, cloturee: true },
      { note: 12, present: true, coefficient: 1, cloturee: true },
    ]);
    expect(r.moyenne).toBe(6);
    expect(r.enDefaut).toBe(false);
    expect(r.absencesCloturees).toBe(true);
  });

  it('met la matière en défaut si aucune ligne sur une épreuve clôturée', () => {
    const r = moyenneUe([{ note: null, present: true, coefficient: 1, cloturee: true }]);
    expect(r.moyenne).toBeNull();
    expect(r.enDefaut).toBe(true);
  });
});

describe('moyenneGenerale', () => {
  it('pondère les UE par leurs crédits', () => {
    const m = moyenneGenerale([
      { moyenne: 12, credits: 6 },
      { moyenne: 8, credits: 4 },
    ]);
    expect(m).toBe(10.4); // (12×6 + 8×4) / 10
  });
});

describe('decider', () => {
  const ue = (moyenne: number | null, opts: Partial<{ enDefaut: boolean; absenceCloturee: boolean }> = {}) => ({
    matiereId: 'm1',
    matiereIntitule: 'UE 1',
    credits: 6,
    moyenne,
    enDefaut: opts.enDefaut ?? false,
    absenceCloturee: opts.absenceCloturee ?? false,
  });

  it('ADMIS si moyenne générale ≥ 10 sans matière en défaut', () => {
    const r = decider([ue(12), ue(11)]);
    expect(r.decision).toBe('ADMIS');
    expect(r.mention).toBe('Passable');
    expect(r.moyenneGenerale).toBeGreaterThanOrEqual(10);
  });

  it('AJOURNÉ si moyenne générale < 10', () => {
    const r = decider([ue(9), ue(8)]);
    expect(r.decision).toBe('AJOURNE');
    expect(r.mention).toBeNull();
  });

  it('AJOURNÉ (pas ADMIS) si une matière < 5 due à une absence consignée', () => {
    const r = decider([
      { ...ue(12), absenceCloturee: false },
      { ...ue(4), absenceCloturee: true }, // matière sous 5 après absence clôturée
    ]);
    // moyenne générale : (12×6 + 4×6)/12 = 8 → déjà < 10 ; vérifions le cas
    // d'une moyenne ≥ 10 quand même (ex. UE à 18 et UE à 4).
    const r2 = decider([
      { ...ue(18), absenceCloturee: false },
      { ...ue(4), absenceCloturee: true },
    ]);
    expect(r2.moyenneGenerale).toBe(11); // (18×6 + 4×6)/12
    expect(r2.decision).toBe('AJOURNE'); // défaut d'absence exclut l'admission
    expect(r2.motif).toContain('5/20');
  });

  it('DEFAILLANT si une matière est en défaut', () => {
    const r = decider([ue(14), ue(null, { enDefaut: true })]);
    expect(r.decision).toBe('DEFAILLANT');
  });
});

describe('classer', () => {
  it('classe par moyenne décroissante puis par nom', () => {
    const r = classer([
      { inscriptionId: 'a', moyenne: 12, nom: 'Zola', prenom: 'E' },
      { inscriptionId: 'b', moyenne: 14, nom: 'Diallo', prenom: 'F' },
      { inscriptionId: 'c', moyenne: 12, nom: 'Bah', prenom: 'A' },
    ]);
    expect(r.map((c) => c.inscriptionId)).toEqual(['b', 'c', 'a']);
    expect(r.map((c) => c.rang)).toEqual([1, 2, 3]);
  });
});