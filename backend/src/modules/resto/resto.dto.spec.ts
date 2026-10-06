import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RechargerPortefeuilleDto } from './resto.dto';

describe('confirmation immédiate des recharges', () => {
  it.each(['false', 'true', 0, 1])('refuse simuler=%p malgré la conversion implicite', async (simuler) => {
    const dto = plainToInstance(RechargerPortefeuilleDto, { montant: 1000, simuler }, { enableImplicitConversion: true });
    expect((await validate(dto)).some(error => error.property === 'simuler')).toBe(true);
  });

  it.each([false, true, undefined])('accepte le booléen explicite %p', async (simuler) => {
    const dto = plainToInstance(RechargerPortefeuilleDto, { montant: 1000, simuler }, { enableImplicitConversion: true });
    expect(await validate(dto)).toEqual([]);
    expect(dto.simuler).toBe(simuler);
  });
});
