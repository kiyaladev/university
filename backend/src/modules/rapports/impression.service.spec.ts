import { ImpressionService } from './impression.service';

function creerService(rapports: Record<string, jest.Mock> = {}) {
  const prisma = { salle: { findMany: jest.fn() }, auditLog: { create: jest.fn() } } as any;
  const parametres = { valeur: jest.fn().mockResolvedValue('<Université & campus>') } as any;
  return {
    prisma,
    parametres,
    service: new ImpressionService(prisma, rapports as any, parametres),
  };
}

describe('rendus HTML imprimables des rapports', () => {
  it('rend le registre avec les valeurs métier échappées et un tableau imprimable', async () => {
    const rapports = {
      registre: jest.fn().mockResolvedValue({
        date: '2026-09-12',
        total: 1,
        synthese: {
          controlees: 1, assurees: 1, absent: 0, retard: 0,
          heuresRealisees: 2, tauxPresence: 100,
        },
        lignes: [{
          horaire: '08:00 — 10:00', enseignant: '<script>alert(1)</script>', matricule: 'ENS-01',
          matiere: 'Analyse & algèbre', promotion: 'L1 <test>', salle: 'A-01', statut: 'PRESENT',
          heureArrivee: '08:00', heureFinReelle: '10:00', dureeMinutes: 120,
          effectifPresent: 24, thematiqueTraitee: '<img src=x onerror=alert(1)>',
          attestation: 'SIGNATURE', attestationValide: true, signatureBase64: null,
        }],
      }),
    };
    const { service } = creerService(rapports);

    const html = await service.registre({ dateDebut: '2026-09-12' } as any);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('@page { size: A4;');
    expect(html).toContain('<table>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Analyse &amp; algèbre');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('rend la fiche enseignant avec la période échappée et le cas sans séance', async () => {
    const rapports = {
      ficheEnseignant: jest.fn().mockResolvedValue({
        enseignant: { nom: 'Barry', prenom: 'Awa', matricule: 'ENS-02', grade: 'Maître', statut: 'ACTIF', departement: { nom: 'Sciences' } },
        seances: [],
        synthese: {
          planifiees: 0, controlees: 0, assurees: 0, absent: 0, retard: 0,
          heuresRealisees: 0, tauxPresence: 0,
        },
      }),
    };
    const { service } = creerService(rapports);

    const html = await service.ficheEnseignant('ens-1', {
      dateDebut: '<script>', dateFin: '2026-09-30',
    } as any);

    expect(html).toContain('Période du &lt;script&gt; au 2026-09-30');
    expect(html).toContain('@page { size: A4;');
    expect(html).toContain('Aucune séance.');
    expect(html).not.toContain('Période du <script> au');
  });

  it('rend l’état de paiement, son total et le cas vide', async () => {
    const rapports = {
      etatPaiement: jest.fn().mockResolvedValue({
        lignes: [{
          matricule: 'ENS-03', nom: 'Diallo & fils', departement: 'Mathématiques',
          statutEnseignant: 'VACATAIRE', seancesAssurees: 3, heuresRealisees: 4.5,
          tauxHoraire: 100000, montant: 450000,
        }],
        totalHeures: 4.5,
        totalMontant: 450000,
      }),
    };
    const { service } = creerService(rapports);

    const html = await service.etatPaiement({ dateDebut: '2026-09-01', dateFin: '2026-09-30' } as any);

    expect(html).toContain('Diallo &amp; fils');
    expect(html).toContain('@page { size: A4;');
    expect(html).toContain('450 000');
    expect(html).toContain('Période du 2026-09-01 au 2026-09-30');
  });

  it('rend les états vides du registre et du paiement avec leur format A4', async () => {
    const rapports = {
      registre: jest.fn().mockResolvedValue({
        date: '2026-09-12', total: 0, lignes: [],
        synthese: {
          controlees: 0, assurees: 0, absent: 0, retard: 0,
          heuresRealisees: 0, tauxPresence: 0,
        },
      }),
      etatPaiement: jest.fn().mockResolvedValue({ lignes: [], totalHeures: 0, totalMontant: 0 }),
    };
    const { service } = creerService(rapports);

    const registre = await service.registre({ dateDebut: '2026-09-12' } as any);
    const paiement = await service.etatPaiement({ dateDebut: '2026-09-01', dateFin: '2026-09-30' } as any);

    expect(registre).toContain('@page { size: A4;');
    expect(registre).toContain('Aucune séance sur la période.');
    expect(paiement).toContain('@page { size: A4;');
    expect(paiement).toContain('Aucune heure réalisée sur la période.');
  });
});
