import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Role, StatutEncadrement, TypeEncadrement } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AuthUser } from '../../../common/decorators';
import { StagesService } from './stages.service';

const CLE_CONFLIT = 'stages.ce_travail_a_change_d_etat_pendant_la_transition_recharge';

/** Un dossier complet, textes compris : le journal ne doit rien en reprendre. */
const DOSSIER = {
  id: 'travail-1',
  type: TypeEncadrement.MEMOIRE,
  statut: StatutEncadrement.VALIDE,
  etudiantId: 'etudiant-1',
  encadrantId: 'prof-1',
  rapportRendu: false,
  dateDebut: new Date('2026-01-05T00:00:00.000Z'),
  dateFin: new Date('2026-06-30T00:00:00.000Z'),
  entreprise: 'SIRUBA-CONFIDENTIEL',
  tuteurEntreprise: 'M. Tuteur Secret',
  intitule: 'Mémoire sur le plan de_diplacement secret',
  description: 'Description confidentielle du dossier',
  lieu: 'Laboratoire confidentiel',
  soutenance: null,
};

/** Projection minimale réellement attendue dans le journal. */
const INSTANTANE = {
  id: 'travail-1',
  type: TypeEncadrement.MEMOIRE,
  statut: StatutEncadrement.VALIDE,
  etudiantId: 'etudiant-1',
  encadrantId: 'prof-1',
  rapportRendu: false,
  dateDebut: '2026-01-05T00:00:00.000Z',
  dateFin: '2026-06-30T00:00:00.000Z',
  entreprisePresente: true,
  tuteurEntreprisePresent: true,
};

function detailsDe(auditCreate: jest.Mock) {
  return JSON.parse(auditCreate.mock.calls[0][0].data.details);
}

/**
 * Fausse transaction fidèle sur un point : les écritures ne sont visibles dans
 * `base` qu'après le commit. Si l'opération lève, l'état validé reste intact —
 * c'est ce qui permet d'affirmer qu'un échec de journal ne laisse pas de
 * mutation fantôme.
 */
function baseAtomique(options: { auditEchoue?: boolean } = {}) {
  const base: any = { ...DOSSIER };
  const journal: any[] = [];
  let tampon: any = {};
  const tx: any = {
    travailEncadre: {
      findUnique: async () => ({ ...tampon }),
      update: async ({ data }: any) => {
        Object.assign(tampon, data);
        return { ...tampon };
      },
      delete: async () => {
        delete tampon.id;
        return {};
      },
      updateMany: async ({ data }: any) => {
        Object.assign(tampon, data);
        return { count: 1 };
      },
    },
    soutenance: {
      create: async ({ data }: any) => ({ id: 'sout-1', note: null, mention: null, ...data }),
      findUnique: async () => null,
      update: async ({ data }: any) => data,
    },
    auditLog: {
      create: async (args: any) => {
        if (options.auditEchoue) throw new Error('journal indisponible');
        journal.push(args);
        return {};
      },
    },
  };
  const prisma: any = {
    travailEncadre: { findUnique: async () => ({ ...base }) },
    $transaction: async (operation: any) => {
      tampon = { ...base };
      try {
        const resultat = await operation(tx);
        for (const cle of Object.keys(tampon)) base[cle] = tampon[cle];
        return resultat;
      } catch (e) {
        tampon = {};
        throw e;
      }
    },
  };
  return { prisma, journal, base };
}

describe('StagesService — journal d’audit avant/après', () => {
  const auditCreate = jest.fn().mockResolvedValue({});

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Opération refusée' } as never);
  });
  afterEach(() => jest.restoreAllMocks());

  // ------------------------------------------------------------------
  // Acteur
  // ------------------------------------------------------------------

  it('rattribue la création du dossier à l’utilisateur qui l’a proposée', async () => {
    const tx = {
      travailEncadre: { create: jest.fn().mockResolvedValue(DOSSIER) },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new StagesService(prisma);
    const etudiant = { id: 'user-etu', role: Role.ETUDIANT, etudiantId: 'etudiant-1' } as AuthUser;

    await service.creer({ intitule: 'Mémoire', etudiantId: 'etudiant-1' } as any, etudiant);

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-etu',
        action: 'TRAVAIL_ENCADRE_CREE',
        entite: 'TravailEncadre',
        entiteId: 'travail-1',
      }),
    });
    // Un étudiant propose son dossier : il n'est jamais porteur d'un encadrant.
    expect(detailsDe(auditCreate).avant).toBeNull();
  });

  it('rattribue la suppression à l’administrateur qui l’a décidée', async () => {
    const tx = {
      travailEncadre: {
        findUnique: jest.fn().mockResolvedValue(DOSSIER),
        delete: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      travailEncadre: { findUnique: jest.fn().mockResolvedValue(DOSSIER) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new StagesService(prisma);
    const admin = { id: 'admin-1', role: Role.ADMIN } as AuthUser;

    await service.supprimer('travail-1', admin);

    expect(auditCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'admin-1',
      action: 'TRAVAIL_ENCADRE_SUPPRIME',
      entiteId: 'travail-1',
    });
  });

  it('rattribue la décision du jury (note, mention) à son auteur', async () => {
    const soutenance = {
      id: 'sout-1',
      travailEncadreId: 'travail-1',
      date: new Date('2026-06-20T09:00:00.000Z'),
      salleId: 'salle-1',
      presidentId: 'prof-2',
      assesseurs: 'Pr. Jury ; Dr. Jury',
      note: 14,
      mention: 'Très bien',
    };
    const tx = {
      soutenance: {
        findUnique: jest.fn().mockResolvedValue(soutenance),
        update: jest.fn().mockResolvedValue({ ...soutenance, note: 16 }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new StagesService(prisma);
    const direction = { id: 'dir-1', role: Role.DIRECTION } as AuthUser;

    await service.noter('sout-1', { note: 16 } as any, direction);

    expect(auditCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'dir-1',
      action: 'SOUTENANCE_NOTEE',
      entite: 'Soutenance',
      entiteId: 'sout-1',
    });
  });

  // ------------------------------------------------------------------
  // États avant / après
  // ------------------------------------------------------------------

  it('journalise les deux encadrants autour d’une réaffectation', async () => {
    const apres = { ...DOSSIER, encadrantId: 'prof-9', rapportRendu: true };
    const tx = {
      travailEncadre: {
        findUnique: jest.fn().mockResolvedValue(DOSSIER),
        update: jest.fn().mockResolvedValue(apres),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      travailEncadre: { findUnique: jest.fn().mockResolvedValue(DOSSIER) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new StagesService(prisma);
    const scolarite = { id: 'scol-1', role: Role.SCOLARITE } as AuthUser;

    await service.modifier('travail-1', { encadrantId: 'prof-9', rapportRendu: true } as any, scolarite);

    const { avant, apres: etatApres } = detailsDe(auditCreate);
    expect(avant).toEqual(INSTANTANE);
    expect(etatApres).toEqual({ ...INSTANTANE, encadrantId: 'prof-9', rapportRendu: true });
  });

  it('journalise l’état de départ et l’état atteint par la machine à états', async () => {
    const apres = { ...DOSSIER, statut: StatutEncadrement.EN_COURS };
    const tx = {
      travailEncadre: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(DOSSIER) // état relu dans la transaction
          .mockResolvedValueOnce(apres), // ligne renvoyée à l'appelant
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      travailEncadre: { findUnique: jest.fn().mockResolvedValue(DOSSIER) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new StagesService(prisma);
    const prof = { id: 'user-prof', role: Role.ENSEIGNANT, enseignantId: 'prof-1' } as AuthUser;

    await service.transition('travail-1', StatutEncadrement.EN_COURS, prof);

    expect(auditCreate.mock.calls[0][0].data.action).toBe('TRAVAIL_VALIDE_EN_COURS');
    const { avant, apres: etatApres } = detailsDe(auditCreate);
    expect(avant.statut).toBe(StatutEncadrement.VALIDE);
    expect(etatApres.statut).toBe(StatutEncadrement.EN_COURS);
  });

  it('journalise la soutenance et le passage en SOUTENU dans le même acte', async () => {
    const enCours = { ...DOSSIER, statut: StatutEncadrement.EN_COURS, rapportRendu: true };
    const soutenance = {
      id: 'sout-1',
      travailEncadreId: 'travail-1',
      date: new Date('2026-06-20T09:00:00.000Z'),
      salleId: 'salle-1',
      presidentId: 'prof-2',
      assesseurs: 'Pr. Jury ; Dr. Jury',
    };
    const tx = {
      travailEncadre: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(enCours) // contrôle avant
          .mockResolvedValueOnce({ ...enCours, statut: StatutEncadrement.SOUTENU }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      soutenance: { create: jest.fn().mockResolvedValue(soutenance) },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new StagesService(prisma);
    const scolarite = { id: 'scol-1', role: Role.SCOLARITE } as AuthUser;

    await service.enregistrerSoutenance(
      { travailEncadreId: 'travail-1', date: '2026-06-20T09:00:00.000Z' } as any,
      scolarite,
    );

    const { avant, apres } = detailsDe(auditCreate);
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({ action: 'SOUTENANCE_CREEE', entiteId: 'travail-1' });
    expect(avant.statut).toBe(StatutEncadrement.EN_COURS);
    expect(avant.soutenance).toBeNull();
    expect(apres.statut).toBe(StatutEncadrement.SOUTENU);
    expect(apres.soutenance).toEqual({
      id: 'sout-1',
      travailEncadreId: 'travail-1',
      date: '2026-06-20T09:00:00.000Z',
      salleId: 'salle-1',
      presidentId: 'prof-2',
      assesseursPresents: true,
      note: null,
      mentionPresente: false,
    });
  });

  it('conserve l’état terminal dans l’après d’une soutenance enregistrée', async () => {
    const enCours = { ...DOSSIER, statut: StatutEncadrement.EN_COURS, rapportRendu: true };
    const apres = { ...enCours, statut: StatutEncadrement.SOUTENU };
    const tx = {
      travailEncadre: {
        findUnique: jest.fn().mockResolvedValueOnce(enCours).mockResolvedValueOnce(apres),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      soutenance: {
        create: jest.fn().mockResolvedValue({
          id: 'sout-1',
          travailEncadreId: 'travail-1',
          date: new Date('2026-06-20T09:00:00.000Z'),
        }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new StagesService(prisma);

    await service.enregistrerSoutenance(
      { travailEncadreId: 'travail-1', date: '2026-06-20T09:00:00.000Z' } as any,
      { id: 'scol-1', role: Role.SCOLARITE } as AuthUser,
    );

    expect(detailsDe(auditCreate).apres.statut).toBe(StatutEncadrement.SOUTENU);
  });

  // ------------------------------------------------------------------
  // Minimisation
  // ------------------------------------------------------------------

  it('ne recopie ni le sujet, ni le rapport, ni les coordonnées de l’entreprise', async () => {
    const apres = { ...DOSSIER, encadrantId: 'prof-9' };
    const tx = {
      travailEncadre: {
        findUnique: jest.fn().mockResolvedValue(DOSSIER),
        update: jest.fn().mockResolvedValue(apres),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      travailEncadre: { findUnique: jest.fn().mockResolvedValue(DOSSIER) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new StagesService(prisma);

    await service.modifier(
      'travail-1',
      { encadrantId: 'prof-9' } as any,
      { id: 'scol-1', role: Role.SCOLARITE } as AuthUser,
    );

    const { avant, apres: etatApres } = detailsDe(auditCreate);
    expect(avant).toEqual(INSTANTANE);
    expect(etatApres).toEqual({ ...INSTANTANE, encadrantId: 'prof-9' });
    // Aucune clé de texte libre, ni avant ni après.
    for (const etat of [avant, etatApres]) {
      expect(Object.keys(etat)).not.toEqual(
        expect.arrayContaining(['intitule', 'description', 'entreprise', 'tuteurEntreprise', 'lieu']),
      );
      expect(etat.entreprisePresente).toBe(true);
      expect(etat.entreprise).toBeUndefined();
      expect(etat.tuteurEntreprisePresent).toBe(true);
      expect(etat.tuteurEntreprise).toBeUndefined();
    }
    const brut = auditCreate.mock.calls[0][0].data.details;
    expect(brut).not.toContain('SIRUBA-CONFIDENTIEL');
    expect(brut).not.toContain('plan de_diplacement secret');
    expect(brut).not.toContain('M. Tuteur Secret');
  });

  it('journalise la note chiffrée mais jamais la mention ni les assesseurs', async () => {
    const avant = {
      id: 'sout-1',
      travailEncadreId: 'travail-1',
      date: new Date('2026-06-20T09:00:00.000Z'),
      salleId: 'salle-1',
      presidentId: 'prof-2',
      assesseurs: 'Pr. Jury ; Dr. Jury',
      note: 12,
      mention: 'Assez bien',
    };
    const tx = {
      soutenance: {
        findUnique: jest.fn().mockResolvedValue(avant),
        update: jest.fn().mockResolvedValue({ ...avant, note: 16, mention: 'Félicitations du jury' }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new StagesService(prisma);

    await service.noter(
      'sout-1',
      { note: 16, mention: 'Félicitations du jury' } as any,
      { id: 'dir-1', role: Role.DIRECTION } as AuthUser,
    );

    const { avant: etatAvant, apres: etatApres } = detailsDe(auditCreate);
    expect(etatAvant.note).toBe(12);
    expect(etatApres.note).toBe(16);
    expect(etatAvant.mention).toBeUndefined();
    expect(etatAvant.mentionPresente).toBe(true);
    const brut = auditCreate.mock.calls[0][0].data.details;
    expect(brut).not.toContain('Assez bien');
    expect(brut).not.toContain('Félicitations du jury');
    expect(brut).not.toContain('Pr. Jury');
  });

  it('marque l’absence de rapport rendu par un booléen plutôt que par son texte', async () => {
    const sansRapport = { ...DOSSIER, rapportRendu: false, entreprise: null, tuteurEntreprise: null };
    const tx = {
      travailEncadre: {
        findUnique: jest.fn().mockResolvedValue(sansRapport),
        update: jest.fn().mockResolvedValue({ ...sansRapport, rapportRendu: true }),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      travailEncadre: { findUnique: jest.fn().mockResolvedValue(sansRapport) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new StagesService(prisma);

    await service.modifier(
      'travail-1',
      { rapportRendu: true } as any,
      { id: 'scol-1', role: Role.SCOLARITE } as AuthUser,
    );

    const { avant, apres } = detailsDe(auditCreate);
    expect(avant.rapportRendu).toBe(false);
    expect(apres.rapportRendu).toBe(true);
    expect(avant.entreprisePresente).toBe(false);
    expect(avant.tuteurEntreprisePresent).toBe(false);
  });

  // ------------------------------------------------------------------
  // Atomicité et retour arrière
  // ------------------------------------------------------------------

  it('n’y laisse aucune trace quand le journal de la modification échoue (retour arrière)', async () => {
    const { prisma, journal, base } = baseAtomique({ auditEchoue: true });
    const service = new StagesService(prisma);
    const scolarite = { id: 'scol-1', role: Role.SCOLARITE } as AuthUser;

    await expect(
      service.modifier('travail-1', { encadrantId: 'prof-9', rapportRendu: true } as any, scolarite),
    ).rejects.toThrow('journal indisponible');
    // La réaffectation est passée par la transaction avant l'échec du journal :
    // c'est l'annulation de l'ensemble, pas l'ordre des appels, qui protège
    // l'état.
    expect(base.encadrantId).toBe('prof-1');
    expect(base.rapportRendu).toBe(false);
    expect(journal).toHaveLength(0);
  });

  it('ne laisse pas un dossier SOUTENU sans journal si l’enregistrement du jury échoue', async () => {
    const enCours = { ...DOSSIER, statut: StatutEncadrement.EN_COURS, rapportRendu: true };
    const { prisma, journal, base } = baseAtomique({ auditEchoue: true });
    base.statut = StatutEncadrement.EN_COURS;
    base.rapportRendu = true;
    const service = new StagesService(prisma);
    const scolarite = { id: 'scol-1', role: Role.SCOLARITE } as AuthUser;

    await expect(
      service.enregistrerSoutenance(
        { travailEncadreId: 'travail-1', date: '2026-06-20T09:00:00.000Z' } as any,
        scolarite,
      ),
    ).rejects.toThrow('journal indisponible');
    expect(enCours.statut).toBe(StatutEncadrement.EN_COURS);
    expect(base.statut).toBe(StatutEncadrement.EN_COURS);
    expect(journal).toHaveLength(0);
  });

  it('commite ensemble l’état et sa trace quand tout se passe bien', async () => {
    const { prisma, journal, base } = baseAtomique();
    const service = new StagesService(prisma);
    const scolarite = { id: 'scol-1', role: Role.SCOLARITE } as AuthUser;

    await service.modifier('travail-1', { encadrantId: 'prof-9' } as any, scolarite);

    expect(base.encadrantId).toBe('prof-9');
    expect(journal).toHaveLength(1);
    expect(JSON.parse(journal[0].data.details).apres.encadrantId).toBe('prof-9');
  });

  it('n’écrit ni soutenance ni journal quand l’état a bougé pendant l’enregistrement', async () => {
    const enCours = { ...DOSSIER, statut: StatutEncadrement.EN_COURS, rapportRendu: true };
    const create = jest.fn();
    const tx = {
      travailEncadre: {
        findUnique: jest.fn().mockResolvedValue(enCours),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      soutenance: { create },
      auditLog: { create: auditCreate },
    };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };
    const service = new StagesService(prisma);

    await expect(
      service.enregistrerSoutenance(
        { travailEncadreId: 'travail-1', date: '2026-06-20T09:00:00.000Z' } as any,
        { id: 'scol-1', role: Role.SCOLARITE } as AuthUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('refuse de sauter une étape de la machine quand l’état a changé entre-temps', async () => {
    // Le dossier a été abandonné par un autre acteur : passer de ce nouvel
    // état à EN_COURS n'est pas une transition de la machine.
    const abandonne = { ...DOSSIER, statut: StatutEncadrement.ABANDONNE };
    const tx = {
      travailEncadre: {
        findUnique: jest.fn().mockResolvedValue(abandonne),
        updateMany: jest.fn(),
      },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      travailEncadre: { findUnique: jest.fn().mockResolvedValue(DOSSIER) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new StagesService(prisma);
    const prof = { id: 'user-prof', role: Role.ENSEIGNANT, enseignantId: 'prof-1' } as AuthUser;

    await expect(service.transition('travail-1', StatutEncadrement.EN_COURS, prof)).rejects.toThrow();
    expect(tx.travailEncadre.updateMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('refuse la transition d’un encadrant qui vient d’être remplacé', async () => {
    const reaffecte = { ...DOSSIER, encadrantId: 'prof-9' };
    const tx = {
      travailEncadre: { findUnique: jest.fn().mockResolvedValue(reaffecte), updateMany: jest.fn() },
      auditLog: { create: auditCreate },
    };
    const prisma: any = {
      travailEncadre: { findUnique: jest.fn().mockResolvedValue(DOSSIER) },
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new StagesService(prisma);
    const ancienProf = { id: 'user-prof', role: Role.ENSEIGNANT, enseignantId: 'prof-1' } as AuthUser;

    await expect(service.transition('travail-1', StatutEncadrement.EN_COURS, ancienProf)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('n’écrit rien et ne journalise pas une transition déjà atteinte', async () => {
    const enCours = { ...DOSSIER, statut: StatutEncadrement.EN_COURS };
    const prisma: any = {
      travailEncadre: { findUnique: jest.fn().mockResolvedValue(enCours) },
      $transaction: jest.fn(),
    };
    const service = new StagesService(prisma);
    const prof = { id: 'user-prof', role: Role.ENSEIGNANT, enseignantId: 'prof-1' } as AuthUser;

    await expect(service.transition('travail-1', StatutEncadrement.EN_COURS, prof)).resolves.toBe(enCours);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('expose une clé i18n pour le conflit de concurrence, en français et en anglais', () => {
    // Le catalogue est indexé par clé nue : le préfixe de namespace est posé
    // par nestjs-i18n au chargement.
    const cle = CLE_CONFLIT.replace('stages.', '');
    const catalogue = (langue: string) =>
      JSON.parse(fs.readFileSync(path.join(__dirname, '../../../i18n', langue, 'stages.json'), 'utf8')) as Record<
        string,
        unknown
      >;
    const fr = catalogue('fr');
    const en = catalogue('en');
    expect(fr[cle]).toBeTruthy();
    expect(en[cle]).toBeTruthy();
  });
});
