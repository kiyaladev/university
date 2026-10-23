import { describe, expect, it } from 'vitest';
import { decoderCsv } from '../../src/utils/csv';

describe('decoderCsv', () => {
  it('lit l’UTF-8 courant', () => {
    expect(decoderCsv(new TextEncoder().encode('nom;salle\nDiallo;Amphi É'))).toBe('nom;salle\nDiallo;Amphi É');
  });

  it('se replie sur Windows-1252 pour les anciens exports Excel', () => {
    // « Médecine » encodé en Windows-1252 : 0xE9 n'est pas de l'UTF-8 valide.
    const octets = new Uint8Array([0x4d, 0xe9, 0x64, 0x65, 0x63, 0x69, 0x6e, 0x65]);
    expect(decoderCsv(octets)).toBe('Médecine');
  });

  it('reconnaît l’UTF-16 avec marque d’ordre des octets', () => {
    const octets = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0xe9, 0x00]);
    expect(decoderCsv(octets.buffer)).toBe('Aé');
  });
});
