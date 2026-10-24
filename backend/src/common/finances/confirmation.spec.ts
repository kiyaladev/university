/**
 * Moteur commun de confirmation de paiement.
 *
 * Ce que ces tests verrouillent :
 *  - une seule transaction pour la transition, l'effet et le journal ;
 *  - le verrou optimiste : `updateMany where { id, statut }`, et rien d'autre
 *    quand le statut a changé entre-temps ;
 *  - l'idempotence : une confirmation déjà appliquée ne rejoue ni l'effet ni
 *    le journal ;
 *  - l'échec de l'effet annule tout : le paiement n'est pas confirmé.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { StatutPaiement } from '@prisma/client';
import {
  confirmerPaiement,
  type ContexteEffetPaiement,
  type EffetConfirmationPaiement,
  type PreparationConfirmation,
} from './confirmation';

jest.mock('nestjs-i18n', () => ({ I18nContext: { current: () => ({ t: (key: string) => key }) } }));

const ACTEUR = { id: 'agent-1' };

/**
 * Faux Prisma : une table de paiements, un verrou optimiste fidèle et un
 * retour arrière de la transaction quand le callback échoue.
 */
function fauxPrisma(statuts: Record<string, StatutPaiement>) {
  const table = new Map(Object.entries(statuts));
  const ecrits: any[] = [];

  const tx: any = {
    paiement: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (table.get(where.id) !== where.statut) return { count: 0 };
        table.set(where.id, data.statut);
        return { count: 1 };
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        ecrits.push(data);
        return {};
      }),
    },
  };

  const prisma: any = {
    $transaction: jest.fn(async (operation: (client: any) => unknown) => {
      const copie = new Map(table);
      try {
        return await operation(tx);
      } catch (erreur) {
        table.clear();
        for (const [cle, valeur] of copie) table.set(cle, valeur);
        throw erreur;
      }
    }),
  };

  return { prisma, tx, table, ecrits };
}

/** Effet d'exemple : il compte ses applications et peut échouer. */
function effet(
  options: { dejaConfirme?: boolean; echec?: Error; valeur?: string } = {},
): EffetConfirmationPaiement<string, { marque: string }> & { appels: number } {
  const eff: any = {
    appels: 0,
    async preparer(_ctx: ContexteEffetPaiement): Promise<PreparationConfirmation<{ marque: string }>> {
      return {
        transition: {
          modele: 'paiement',
          id: 'pay-1',
          statutAttendu: StatutPaiement.EN_ATTENTE,
          erreur: () => new ConflictException('le paiement a changé entre-temps'),
        },
        objet: { marque: 'avant' },
        confirme: options.dejaConfirme ?? false,
      };
    },
    async appliquer() {
      eff.appels += 1;
      if (options.echec) throw options.echec;
      return { valeur: options.valeur ?? 'confirme', audit: { solde: 100 } };
    },
    async dejaConfirme() {
      eff.appels += 1;
      return 'deja-confirme';
    },
  };
  return eff;
}

describe('Confirmation de paiement — moteur commun', () => {
  it('passe le paiement à RÉUSSI, applique l’effet et journalise dans la seule transaction', async () => {
    const { prisma, tx, table, ecrits } = fauxPrisma({ 'pay-1': StatutPaiement.EN_ATTENTE });
    const effetScolarite = effet();

    const resultat = await confirmerPaiement({
      prisma,
      user: ACTEUR,
      effet: effetScolarite,
      journal: {
        action: 'PAIEMENT_CONFIRME',
        entite: 'Paiement',
        entiteId: 'pay-1',
        details: ({ preparation, resultat: effetResultat }) => ({
          avant: preparation.objet.marque,
          apres: effetResultat.valeur,
          complement: effetResultat.audit,
        }),
      },
    });

    expect(resultat).toBe('confirme');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.paiement.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', statut: StatutPaiement.EN_ATTENTE },
      data: { statut: StatutPaiement.REUSSI, completeLe: expect.any(Date) },
    });
    expect(table.get('pay-1')).toBe(StatutPaiement.REUSSI);
    expect(effetScolarite.appels).toBe(1);
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0]).toMatchObject({
      userId: 'agent-1',
      action: 'PAIEMENT_CONFIRME',
      entite: 'Paiement',
      entiteId: 'pay-1',
    });
    expect(JSON.parse(ecrits[0].details)).toEqual({
      avant: 'avant',
      apres: 'confirme',
      complement: { solde: 100 },
    });
  });

  it('ne rejoue ni l’effet ni le journal quand la confirmation est déjà appliquée', async () => {
    const { prisma, tx, ecrits } = fauxPrisma({ 'pay-1': StatutPaiement.REUSSI });
    const effetScolarite = effet({ dejaConfirme: true });

    const resultat = await confirmerPaiement({
      prisma,
      user: ACTEUR,
      effet: effetScolarite,
      journal: {
        action: 'PAIEMENT_CONFIRME',
        entite: 'Paiement',
        entiteId: 'pay-1',
        details: () => ({}),
      },
    });

    expect(resultat).toBe('deja-confirme');
    expect(tx.paiement.updateMany).not.toHaveBeenCalled();
    expect(ecrits).toHaveLength(0);
  });

  it('refuse une confirmation concurrente et n’applique aucun effet', async () => {
    const { prisma, tx, table, ecrits } = fauxPrisma({ 'pay-1': StatutPaiement.EN_ATTENTE });
    // La confirmation concurrente a déjà pris le paiement : le verrou
    // optimiste ne trouve plus la ligne attendue.
    tx.paiement.updateMany.mockResolvedValueOnce({ count: 0 });
    const effetScolarite = effet();

    await expect(
      confirmerPaiement({
        prisma,
        user: ACTEUR,
        effet: effetScolarite,
        journal: {
          action: 'PAIEMENT_CONFIRME',
          entite: 'Paiement',
          entiteId: 'pay-1',
          details: () => ({}),
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(effetScolarite.appels).toBe(0);
    expect(table.get('pay-1')).toBe(StatutPaiement.EN_ATTENTE);
    expect(ecrits).toHaveLength(0);
  });

  it('n’écrit rien quand le statut attendu n’est plus le sien', async () => {
    const { prisma, tx, table } = fauxPrisma({ 'pay-1': StatutPaiement.ECHOUE });

    await expect(
      confirmerPaiement({
        prisma,
        user: ACTEUR,
        effet: effet(),
        journal: {
          action: 'PAIEMENT_CONFIRME',
          entite: 'Paiement',
          entiteId: 'pay-1',
          details: () => ({}),
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(table.get('pay-1')).toBe(StatutPaiement.ECHOUE);
  });

  it('annule tout quand l’effet échoue : le paiement reste en attente', async () => {
    const { prisma, tx, table, ecrits } = fauxPrisma({ 'pay-1': StatutPaiement.EN_ATTENTE });
    const effetScolarite = effet({ echec: new BadRequestException('effet métier refusé') });

    await expect(
      confirmerPaiement({
        prisma,
        user: ACTEUR,
        effet: effetScolarite,
        journal: {
          action: 'PAIEMENT_CONFIRME',
          entite: 'Paiement',
          entiteId: 'pay-1',
          details: () => ({}),
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // La transaction est revenue en arrière : ni confirmation, ni trace.
    expect(table.get('pay-1')).toBe(StatutPaiement.EN_ATTENTE);
    expect(ecrits).toHaveLength(0);
  });

  it('écrit une recharge sans date de completion et journalise l’effet', async () => {
    const { prisma, tx, ecrits } = fauxPrisma({});
    const recharge: any = {
      updateMany: jest.fn(async ({ data }: any) => {
        expect(data).toEqual({ statut: StatutPaiement.REUSSI });
        return { count: 1 };
      }),
    };
    tx.recharge = recharge;

    await confirmerPaiement({
      prisma,
      user: ACTEUR,
      effet: {
        preparer: async () => ({
          transition: {
            modele: 'recharge',
            id: 'rec-1',
            statutAttendu: StatutPaiement.EN_ATTENTE,
            erreur: () => new BadRequestException('recharge close'),
          },
          objet: { montant: 100 },
          confirme: false,
        }),
        appliquer: async () => ({ valeur: 'solde crédité' }),
        dejaConfirme: async () => 'deja-confirme',
      },
      journal: {
        action: (statut) => (statut === StatutPaiement.REUSSI ? 'RECHARGE_CONFIRMEE' : 'RECHARGE_ECHOUEE'),
        entite: 'Recharge',
        entiteId: 'rec-1',
        details: () => ({ montant: 100 }),
      },
    });

    expect(recharge.updateMany).toHaveBeenCalledWith({
      where: { id: 'rec-1', statut: StatutPaiement.EN_ATTENTE },
      data: { statut: StatutPaiement.REUSSI },
    });
    expect(ecrits[0].action).toBe('RECHARGE_CONFIRMEE');
  });
});
