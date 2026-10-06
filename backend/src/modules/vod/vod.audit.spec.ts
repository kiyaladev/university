import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, StatutVOD, TypeRessourceVOD } from '@prisma/client';
import { I18nContext } from 'nestjs-i18n';
import type { AuthUser } from '../../common/decorators';
import { VodService } from './vod.service';

/**
 * Une ressource VOD complète, contenus et secrets compris : le journal ne
 * doit rien en reprendre. Les relations sont présentes parce que le service
 * les joint systématiquement — un `enseignant.nom` ou une `matiere.intitule`
 * qui fuite dans le journal serait une donnée personnelle de plus.
 */
const VOD = {
  id: 'vod-1',
  titre: 'Cours magistral CONFIDENTIEL',
  description: 'Description confidentielle du cours',
  transcription: 'Transcription confidentielle du cours',
  matiereId: 'matiere-1',
  seanceId: 'seance-1',
  enseignantId: 'prof-1',
  type: TypeRessourceVOD.VIDEO,
  url: 'https://cdn.example.com/vod/media.mp4?token=JETON-SECRET-123',
  thumbnailUrl: 'https://cdn.example.com/vod/vignette.png?token=JETON-SECRET-123',
  dureeSecondes: 3600,
  tailleKo: 204800,
  nbVues: 12,
  nbComplets: 3,
  public: true,
  inscriptionId: null,
  creeParId: 'user-prof',
  statut: StatutVOD.BROUILLON,
  dateMiseEnLigne: null,
  createdAt: new Date('2026-09-01T08:00:00.000Z'),
  updatedAt: new Date('2026-09-01T08:00:00.000Z'),
  matiere: { id: 'matiere-1', code: 'MATH101', intitule: 'Analyse CONFIDENTIELLE' },
  enseignant: { id: 'prof-1', matricule: 'ENS-CONFIDENTIEL', nom: 'Nom', prenom: 'Prenom' },
  creePar: { id: 'user-prof', nom: 'Nom', prenom: 'Prenom' },
  _count: { vues: 12 },
};

/** Projection minimale réellement attendue dans le journal. */
const INSTANTANE = {
  id: 'vod-1',
  type: TypeRessourceVOD.VIDEO,
  statut: StatutVOD.BROUILLON,
  public: true,
  matiereId: 'matiere-1',
  seanceId: 'seance-1',
  enseignantId: 'prof-1',
  inscriptionId: null,
  creeParId: 'user-prof',
  dateMiseEnLigne: null,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  dureeSecondes: 3600,
  tailleKo: 204800,
  titreFourni: true,
  descriptionFournie: true,
  transcriptionFournie: true,
  mediaPresent: true,
  vignettePresente: true,
};

const PROFS = { id: 'user-prof', role: Role.ENSEIGNANT, enseignantId: 'prof-1' } as AuthUser;
const ADMIN = { id: 'admin-1', role: Role.ADMIN } as AuthUser;
const ETUDIANT = { id: 'user-etu', role: Role.ETUDIANT, etudiantId: 'etudiant-1' } as AuthUser;

function detailsDe(auditCreate: jest.Mock) {
  return JSON.parse(auditCreate.mock.calls[0][0].data.details);
}

/** Projection attendue : rien d'autre que ces clés, ni valeur de contenu. */
/**
 * Fausse transaction fidèle sur un point : les écritures ne deviennent
 * visibles dans `base` qu'après le commit. Si l'opération lève, l'état validé
 * reste intact — c'est ce qui permet d'affirmer qu'un échec de journal
 * n laisse pas de ressource modifiée sans trace.
 */
function baseAtomique(options: { auditEchoue?: boolean } = {}) {
  const base: any = { ...VOD };
  const journal: any[] = [];
  let tampon: any = {};
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: VOD.id }]),
    coursVOD: {
      findUnique: async () => ({ ...tampon }),
      create: jest.fn(async ({ data }: any) => {
        tampon = { ...VOD, ...data, id: 'vod-creee' };
        return { ...tampon };
      }),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(tampon, data);
        return { ...tampon };
      }),
    },
    seance: { findUnique: jest.fn().mockResolvedValue({ anneeId: 'annee-1' }) },
    inscription: { findUnique: jest.fn().mockResolvedValue({ anneeId: 'annee-1' }) },
    auditLog: {
      create: async (args: any) => {
        if (options.auditEchoue) throw new Error('journal indisponible');
        journal.push(args);
        return {};
      },
    },
  };
  const prisma: any = {
    coursVOD: { findUnique: async () => ({ ...base }) },
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
  return { prisma, journal, base, tx };
}

describe('VodService — journal d’audit avant/après', () => {
  const auditCreate = jest.fn().mockResolvedValue({});

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(I18nContext, 'current').mockReturnValue({ t: () => 'Opération refusée' } as never);
  });
  afterEach(() => jest.restoreAllMocks());

  // ------------------------------------------------------------------
  // Acteur et projection
  // ------------------------------------------------------------------

  it('rattribue la création à son auteur et journalise l’état atteint', async () => {
    const { prisma, journal } = baseAtomique();
    const service = new VodService(prisma);

    await service.creer({ titre: 'Cours', type: TypeRessourceVOD.VIDEO, url: 'local://media.mp4' } as any, PROFS);

    expect(journal).toHaveLength(1);
    expect(journal[0].data).toMatchObject({
      userId: 'user-prof',
      action: 'VOD_CREE',
      entite: 'CoursVOD',
      entiteId: 'vod-creee',
    });
    const { avant, apres } = JSON.parse(journal[0].data.details);
    expect(avant).toBeNull();
    expect(apres).toMatchObject({
      id: 'vod-creee',
      statut: StatutVOD.BROUILLON,
      creeParId: 'user-prof',
      mediaPresent: true,
      titreFourni: true,
      descriptionFournie: false,
      transcriptionFournie: false,
      vignettePresente: false,
    });
  });

  it('refuse la création si séance et inscription appartiennent à des années différentes', async () => {
    const { prisma, tx, journal } = baseAtomique();
    tx.inscription.findUnique.mockResolvedValue({ anneeId: 'annee-2' });
    const service = new VodService(prisma);

    await expect(service.creer({
      titre: 'Cours', type: TypeRessourceVOD.VIDEO, url: 'local://media.mp4',
      seanceId: 'seance-1', inscriptionId: 'inscription-1',
    } as any, PROFS)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.coursVOD.create).not.toHaveBeenCalled();
    expect(journal).toEqual([]);
  });

  it('refuse une modification qui rattache le cours à une inscription d’une autre année', async () => {
    const { prisma, tx, journal } = baseAtomique();
    tx.inscription.findUnique.mockResolvedValue({ anneeId: 'annee-2' });
    const service = new VodService(prisma);

    await expect(service.modifier('vod-1', { inscriptionId: 'inscription-1' } as any, PROFS))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(tx.coursVOD.update).not.toHaveBeenCalled();
    expect(journal).toEqual([]);
  });

  it('ne recopie ni titre, ni description, ni URL, ni nom d’enseignant, ni transcription', async () => {
    const { prisma, journal } = baseAtomique();
    const service = new VodService(prisma);

    await service.modifier('vod-1', { titre: 'Nouveau titre CONFIDENTIEL', url: 'https://cdn.example.com/nouveau.mp4?token=JETON-AUTRE' } as any, PROFS);

    const brut = journal[0].data.details;
    for (const fuite of [
      'CONFIDENTIEL', 'JETON-SECRET-123', 'JETON-AUTRE',
      'ENS-CONFIDENTIEL', 'media.mp4', 'vignette.png',
    ]) {
      expect(brut).not.toContain(fuite);
    }
    const { avant, apres } = JSON.parse(brut);
    // Le média reste identifié, son adresse jamais recopiée.
    expect(avant.mediaPresent).toBe(true);
    expect(avant.url).toBeUndefined();
    expect(apres.mediaPresent).toBe(true);
    expect(apres.url).toBeUndefined();
    // Aucun nom de personne ni intitulé de matière parmi les clés projetées.
    for (const etat of [avant, apres]) {
      expect(Object.keys(etat)).not.toEqual(expect.arrayContaining([
        'titre', 'description', 'transcription', 'url', 'thumbnailUrl',
        'matiere', 'enseignant', 'creePar', 'nbVues', 'nbComplets', 'ipAppareil',
      ]));
    }
  });

  it('journalise les deux états autour d’une modification, champs nommés', async () => {
    const { prisma, journal } = baseAtomique();
    const service = new VodService(prisma);

    await service.modifier('vod-1', { type: TypeRessourceVOD.TRANSCRIPTION, public: false } as any, PROFS);

    const { avant, apres, champsModifies } = JSON.parse(journal[0].data.details);
    expect(avant).toEqual(INSTANTANE);
    expect(apres).toEqual({
      ...INSTANTANE,
      type: TypeRessourceVOD.TRANSCRIPTION,
      public: false,
    });
    expect(champsModifies).toEqual(['type', 'public']);
  });

  it('journalise la publication et sa date de mise en ligne', async () => {
    const { prisma, journal, base } = baseAtomique();
    const service = new VodService(prisma);

    await service.publier('vod-1', PROFS);

    const { avant, apres, champsModifies } = JSON.parse(journal[0].data.details);
    expect(journal[0].data).toMatchObject({ action: 'VOD_PUBLIE', entiteId: 'vod-1' });
    expect(avant.statut).toBe(StatutVOD.BROUILLON);
    expect(avant.dateMiseEnLigne).toBeNull();
    expect(apres.statut).toBe(StatutVOD.EN_LIGNE);
    expect(apres.dateMiseEnLigne).toEqual(expect.any(String));
    expect(champsModifies).toEqual(['statut', 'dateMiseEnLigne']);
    expect(base.statut).toBe(StatutVOD.EN_LIGNE);
  });

  it('journalise l’archivage d’une ressource retirée de la vitrine', async () => {
    const { prisma, journal, base } = baseAtomique();
    base.statut = StatutVOD.EN_LIGNE;
    const service = new VodService(prisma);

    await service.archiver('vod-1', { motif: 'Fin de session' } as any, ADMIN);

    const { avant, apres, champsModifies } = JSON.parse(journal[0].data.details);
    expect(journal[0].data).toMatchObject({ action: 'VOD_ARCHIVE', entiteId: 'vod-1' });
    expect(avant.statut).toBe(StatutVOD.EN_LIGNE);
    expect(apres.statut).toBe(StatutVOD.ARCHIVE);
    expect(champsModifies).toEqual(['statut']);
    // Le motif d'archivage est un texte libre : jamais recopié.
    expect(journal[0].data.details).not.toContain('Fin de session');
  });

  // ------------------------------------------------------------------
  // Atomicité et retour arrière
  // ------------------------------------------------------------------

  it('n’y laisse aucune trace quand le journal d’une modification échoue', async () => {
    const { prisma, journal, base } = baseAtomique({ auditEchoue: true });
    const service = new VodService(prisma);

    await expect(
      service.modifier('vod-1', { type: TypeRessourceVOD.NOTES, public: false } as any, PROFS),
    ).rejects.toThrow('journal indisponible');
    // L'écriture est passée par la transaction avant l'échec du journal :
    // c'est l'annulation de l'ensemble, pas l'ordre des appels, qui protège.
    expect(base.type).toBe(TypeRessourceVOD.VIDEO);
    expect(base.public).toBe(true);
    expect(journal).toHaveLength(0);
  });

  it('ne laisse pas une ressource publiée sans journal si la trace échoue', async () => {
    const { prisma, journal, base } = baseAtomique({ auditEchoue: true });
    const service = new VodService(prisma);

    await expect(service.publier('vod-1', PROFS)).rejects.toThrow('journal indisponible');
    expect(base.statut).toBe(StatutVOD.BROUILLON);
    expect(base.dateMiseEnLigne).toBeNull();
    expect(journal).toHaveLength(0);
  });

  it('ne laisse pas une ressource archivée sans journal si la trace échoue', async () => {
    const { prisma, journal, base } = baseAtomique({ auditEchoue: true });
    base.statut = StatutVOD.EN_LIGNE;
    const service = new VodService(prisma);

    await expect(service.archiver('vod-1', {}, ADMIN)).rejects.toThrow('journal indisponible');
    expect(base.statut).toBe(StatutVOD.EN_LIGNE);
    expect(journal).toHaveLength(0);
  });

  it('commite ensemble l’état et sa trace quand tout se passe bien', async () => {
    const { prisma, journal, base } = baseAtomique();
    const service = new VodService(prisma);

    await service.modifier('vod-1', { matiereId: 'matiere-9' } as any, PROFS);

    expect(base.matiereId).toBe('matiere-9');
    expect(journal).toHaveLength(1);
    expect(JSON.parse(journal[0].data.details).apres.matiereId).toBe('matiere-9');
  });

  it('écrit la création et sa trace dans la même transaction', async () => {
    const tx = { coursVOD: { create: jest.fn().mockResolvedValue(VOD) }, auditLog: { create: auditCreate } };
    const prisma: any = { $transaction: jest.fn((operation) => operation(tx)) };

    await new VodService(prisma).creer({ titre: 'Cours', type: TypeRessourceVOD.VIDEO, url: 'local://media.mp4' } as any, PROFS);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].data.action).toBe('VOD_CREE');
  });

  // ------------------------------------------------------------------
  // Refus : ni écriture, ni trace
  // ------------------------------------------------------------------

  it('n’écrit ni ne journalise la ressource d’un autre auteur', async () => {
    const { prisma, journal, base } = baseAtomique();
    base.creeParId = 'user-autre';
    const service = new VodService(prisma);

    await expect(service.modifier('vod-1', { public: false } as any, PROFS)).rejects.toThrow(ForbiddenException);
    await expect(service.publier('vod-1', PROFS)).rejects.toThrow(ForbiddenException);
    await expect(service.archiver('vod-1', {}, PROFS)).rejects.toThrow(ForbiddenException);
    expect(base.public).toBe(true);
    expect(base.statut).toBe(StatutVOD.BROUILLON);
    expect(journal).toHaveLength(0);
  });

  it('ne journalise pas une publication refusée par le cycle de vie', async () => {
    const { prisma, journal, base } = baseAtomique();
    base.statut = StatutVOD.EN_LIGNE;
    const service = new VodService(prisma);

    await expect(service.publier('vod-1', ADMIN)).rejects.toThrow(BadRequestException);
    expect(base.dateMiseEnLigne).toBeNull();
    expect(journal).toHaveLength(0);
  });

  it('ne journalise pas un archivage déjà effectué', async () => {
    const { prisma, journal, base } = baseAtomique();
    base.statut = StatutVOD.ARCHIVE;
    const service = new VodService(prisma);

    await expect(service.archiver('vod-1', {}, ADMIN)).rejects.toThrow(BadRequestException);
    expect(journal).toHaveLength(0);
  });

  it.each(['modifier', 'publier', 'archiver'])('refuse %s si le cours a été archivé après le premier contrôle', async method => {
    const { prisma, tx, journal, base } = baseAtomique();
    base.statut = StatutVOD.ARCHIVE;
    prisma.coursVOD.findUnique = jest.fn().mockResolvedValue(VOD);
    const service = new VodService(prisma);
    const operation = method === 'publier'
      ? service.publier('vod-1', PROFS)
      : (service as any)[method]('vod-1', { titre: 'Tentative tardive' }, PROFS);
    await expect(operation).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.coursVOD.update).not.toHaveBeenCalled();
    expect(base.statut).toBe(StatutVOD.ARCHIVE);
    expect(journal).toHaveLength(0);
  });

  it('refuse une seconde publication après un premier contrôle sur un brouillon', async () => {
    const { prisma, tx, base, journal } = baseAtomique();
    base.statut = StatutVOD.EN_LIGNE;
    prisma.coursVOD.findUnique = jest.fn().mockResolvedValue(VOD);
    await expect(new VodService(prisma).publier('vod-1', PROFS)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.coursVOD.update).not.toHaveBeenCalled();
    expect(journal).toHaveLength(0);
  });

  it('refuse une progression si la ressource n’est plus accessible dans la transaction', async () => {
    const create = jest.fn();
    const update = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: VOD.id }]),
      coursVOD: { findUnique: jest.fn().mockResolvedValue(VOD), findFirst: jest.fn().mockResolvedValue(null), update },
      vueVOD: { create },
    };
    const prisma: any = {
      coursVOD: { findFirst: jest.fn().mockResolvedValue(VOD) },
      $transaction: operation => operation(tx),
    };
    await expect(new VodService(prisma).enregistrerVue('vod-1', { positionSecondes: 95, dureeSecondes: 100 }, ETUDIANT))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Lectures et vues : hors journal
  // ------------------------------------------------------------------

  it('les lectures ne produisent aucune entrée de journal', async () => {
    const prisma: any = {
      coursVOD: {
        // `vues` est la relation que seule `maCollecte` joint en plus.
        findMany: jest.fn().mockResolvedValue([{ ...VOD, vues: [] }]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue(VOD),
        findUnique: jest.fn().mockResolvedValue(VOD),
      },
      inscription: { findMany: jest.fn().mockResolvedValue([{ id: 'inscription-1' }]) },
      vueVOD: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _avg: { dureeSecondes: null } }),
      },
      auditLog: { create: auditCreate },
    };
    const service = new VodService(prisma);

    await service.liste({} as any, PROFS);
    await service.trouverPour('vod-1', PROFS);
    await service.recherche('cours', ETUDIANT);
    await service.maCollecte(ETUDIANT);
    await service.statistiques('vod-1', ADMIN);

    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('une vue ne produit aucune entrée de journal et n’identifie pas le spectateur', async () => {
    const vueCreate = jest.fn().mockResolvedValue({});
    const coursUpdate = jest.fn().mockResolvedValue({ nbVues: 13 });
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: VOD.id }]),
      coursVOD: { update: coursUpdate, findUnique: jest.fn().mockResolvedValue(VOD), findFirst: jest.fn().mockResolvedValue(VOD) },
      vueVOD: { create: vueCreate },
    };
    const prisma: any = {
      coursVOD: {
        findFirst: jest.fn().mockResolvedValue(VOD),
      },
      $transaction: jest.fn((operation) => operation(tx)),
      auditLog: { create: auditCreate },
    };
    const service = new VodService(prisma);

    const resultat = await service.enregistrerVue('vod-1', { positionSecondes: 3300, dureeSecondes: 3600 } as any, ETUDIANT, '10.0.0.1');

    // Le décompte reste inchangé : la vue alimente toujours ses compteurs.
    expect(resultat).toEqual({ ok: true, termine: true, nbVues: 13 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(vueCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ vodId: 'vod-1', etudiantId: ETUDIANT.etudiantId, termine: true }),
    });
    expect(coursUpdate).toHaveBeenCalledWith({
      where: { id: 'vod-1' },
      data: { nbVues: { increment: 1 }, nbComplets: { increment: 1 } },
      select: { nbVues: true },
    });
    // Aucune trace d'audit : ni la vue, ni l'étudiant, ni son adresse.
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
