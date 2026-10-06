import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTirageDto, ImprimerTirageDto } from './tirage.dto';

describe('empreinte source des tirages', () => {
  it.each(['abc', 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)])('refuse une empreinte mal formée %p', async empreinteSource => {
    const data = { examenId: '1b621af8-7d89-4cc3-ad43-24bef1550f45', dateTirage: '2026-10-06', nbExemplaires: 1, empreinteSource };
    for (const dto of [plainToInstance(CreateTirageDto, data), plainToInstance(ImprimerTirageDto, data)]) {
      expect((await validate(dto)).some(error => error.property === 'empreinteSource')).toBe(true);
    }
  });
  it.each(['a'.repeat(64), 'A'.repeat(64)])('accepte le SHA-256 hexadécimal %p', async empreinteSource => {
    expect(await validate(plainToInstance(ImprimerTirageDto, { empreinteSource }))).toEqual([]);
  });
});
