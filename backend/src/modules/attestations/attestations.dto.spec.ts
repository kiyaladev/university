import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAttestationDto } from './attestations.dto';

describe('Rattachements immuables du DTO de modification', () => {
  it.each(['etudiantId', 'anneeId', 'promotionId', 'inscriptionId'])('exclut %s des champs modifiables', async (field) => {
    const dto = plainToInstance(UpdateAttestationDto, { type: 'SCOLARITE', [field]: '11111111-1111-4111-8111-111111111111' }, { enableImplicitConversion: true });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual(expect.arrayContaining([expect.objectContaining({ property: field, constraints: expect.objectContaining({ whitelistValidation: expect.any(String) }) })]));
  });
  it('accepte le type et le motif', async () => {
    expect(await validate(plainToInstance(UpdateAttestationDto, { type: 'SCOLARITE', motif: 'Correction' }), { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
  });
});
