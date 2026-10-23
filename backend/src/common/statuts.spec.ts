import { BadRequestException } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { StatutReclamation, StatutReservationSalle } from '@prisma/client';
import {
  JETONS_STATUT_LEGACY,
  ValidationPipeCompatStatuts,
  jetonStatutActuel,
  normaliserJetonsStatuts,
} from './statuts';

class StatutDto {
  @IsEnum(StatutReclamation)
  statut!: StatutReclamation;
}

describe('compatibilité des jetons d’état', () => {
  it('convertit chaque ancien jeton en son successeur', () => {
    expect(jetonStatutActuel('ANNULEE')).toBe('ANNULE');
    expect(jetonStatutActuel('VALIDEE')).toBe('VALIDE');
    expect(jetonStatutActuel('CLOTUREE')).toBe('CLOTURE');
    expect(jetonStatutActuel('RESOLUE')).toBe('RESOLU');
    expect(jetonStatutActuel('PRETE')).toBe('PRET');
    expect(jetonStatutActuel('EMISE')).toBe('EMIS');
  });

  it('laisse un jeton courant intact', () => {
    for (const jeton of Object.values(StatutReclamation)) expect(jetonStatutActuel(jeton)).toBe(jeton);
    for (const jeton of Object.values(StatutReservationSalle)) expect(jetonStatutActuel(jeton)).toBe(jeton);
  });

  it('n’a pas d’ancien jeton qui soit déjà un jeton courant', () => {
    const courants = new Set<string>([
      ...Object.values(StatutReclamation),
      ...Object.values(StatutReservationSalle),
      'ANNULE',
      'VALIDE',
      'CLOTURE',
      'RESOLU',
      'PRET',
      'EMIS',
      'REVOQUE',
      'CONFIRME',
      'OUVERT',
      'FERME',
      'REJETE',
      'PUBLIE',
      'COMPLET',
      'PAYE',
      'ACCORDE',
      'REFUSE',
      'RETIRE',
      'RESERVE',
      'OCCUPE',
      'ENVOYE',
      'CLOS',
      'PROCLAME',
      'PLANIFIE',
      'CONTROLE',
      'ENCAISSE',
    ]);
    for (const ancien of Object.keys(JETONS_STATUT_LEGACY)) {
      expect(courants.has(ancien)).toBe(false);
      expect(JETONS_STATUT_LEGACY[ancien]).not.toBe(ancien);
    }
  });

  it('convertit les jetons d’un corps de requête, quel que soit le niveau', () => {
    const corps = {
      statut: 'RESOLUE',
      filtres: { statut: 'OUVERTE', liste: ['FERMEE', 'EN_COURS'] },
      commentaire: 'La réclamation a été close par la commission',
    };
    expect(normaliserJetonsStatuts(corps)).toEqual({
      statut: 'RESOLU',
      filtres: { statut: 'OUVERT', liste: ['FERME', 'EN_COURS'] },
      commentaire: 'La réclamation a été close par la commission',
    });
  });

  it('ne réécrit pas un texte libre qui contient le mot', () => {
    expect(normaliserJetonsStatuts('ANNULEE')).toBe('ANNULE');
    expect(normaliserJetonsStatuts('dossier ANNULEE')).toBe('dossier ANNULEE');
    expect(normaliserJetonsStatuts('Annulée')).toBe('Annulée');
  });

  it('laisse un objet métier non JSON intact', () => {
    const date = new Date('2026-10-23T00:00:00.000Z');
    expect(normaliserJetonsStatuts({ date })).toEqual({ date });
  });

  it('accepte un ancien jeton sur une requête entrante', async () => {
    const pipe = new ValidationPipeCompatStatuts({ transform: true });
    const resultat = await pipe.transform({ statut: 'RESOLUE' }, { type: 'body', metatype: StatutDto });
    expect(resultat).toEqual({ statut: 'RESOLU' });
  });

  it('refuse toujours une valeur qui n’est pas un statut', async () => {
    const pipe = new ValidationPipeCompatStatuts({ transform: true });
    await expect(pipe.transform({ statut: 'INCONNU' }, { type: 'body', metatype: StatutDto })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
