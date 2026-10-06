import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { EncaisserRecetteDto, RecetteQueryDto } from './recettes.dto';

describe('EncaisserRecetteDto', () => {
  it.each(['ESPECES', 'VIREMENT', 'MOBILE_MONEY'])('accepte le mode %s', mode => {
    const dto = Object.assign(new EncaisserRecetteDto(), { mode });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('refuse un mode de paiement non pris en charge', () => {
    const dto = Object.assign(new EncaisserRecetteDto(), { mode: 'CHEQUE' });
    expect(validateSync(dto).map(error => error.property)).toContain('mode');
  });
});

describe('RecetteQueryDto', () => {
  it('accepte le filtre explicite des recettes non encaissées', () => {
    const dto = Object.assign(new RecetteQueryDto(), { paiementStatut: 'A_ENCAISSER' });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejette un filtre d’encaissement inconnu', () => {
    const dto = Object.assign(new RecetteQueryDto(), { paiementStatut: 'EN_ATTENTE_INCONNU' });
    expect(validateSync(dto).map(error => error.property)).toContain('paiementStatut');
  });
});
