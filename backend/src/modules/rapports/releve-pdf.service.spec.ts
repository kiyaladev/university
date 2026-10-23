import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { deflateSync } from 'node:zlib';
import type { AuthUser } from '../../common/decorators';
import { RelevePdfService } from './releve-pdf.service';

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const octet of buffer) {
    crc ^= octet;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type);
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return result;
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
  pngChunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 255]))),
  pngChunk('IEND', Buffer.alloc(0)),
]);
const signatureBase64 = `data:image/png;base64,${png.toString('base64')}`;

describe('RelevePdfService', () => {
  const user: AuthUser = {
    id: 'user-1',
    role: Role.CHEF_DEPARTEMENT,
    departementId: '12345678-1234-1234-1234-123456789012',
  } as AuthUser;

  function service() {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: user.id,
          nom: 'Diallo',
          prenom: 'Aminata',
          role: Role.CHEF_DEPARTEMENT,
          actif: true,
          departementId: user.departementId,
        }),
      },
      departement: { findUnique: jest.fn().mockResolvedValue({ id: user.departementId, nom: 'Sciences' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const rapports = {
      registre: jest.fn().mockResolvedValue({
        lignes: [],
        synthese: { planifiees: 0, controlees: 0, tauxControle: 0, assurees: 0, tauxPresence: 0, heuresRealisees: 0 },
      }),
    };
    const parametres = { valeur: jest.fn().mockResolvedValue('Université test') };
    return {
      subject: new RelevePdfService(prisma as any, rapports as any, parametres as any),
      prisma,
      rapports,
    };
  }

  it('génère un PDF signé et journalise ses empreintes', async () => {
    const { subject, prisma, rapports } = service();
    const result = await subject.generer(
      {
        departementId: user.departementId!,
        dateDebut: '2026-09-28',
        dateFin: '2026-10-04',
        signatureBase64,
      },
      user,
    );

    expect(result.pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(result.numero).toMatch(/^RH-2026-/);
    expect(result.pdfHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rapports.registre).toHaveBeenCalledWith(
      expect.objectContaining({ departementId: user.departementId }),
      true,
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'RAPPORT_HEBDOMADAIRE_SIGNE', entiteId: result.numero }),
      }),
    );
  });

  it('refuse au chef de signer le relevé d’un autre département', async () => {
    const { subject, prisma } = service();
    await expect(
      subject.generer(
        {
          departementId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          dateDebut: '2026-09-28',
          dateFin: '2026-10-04',
          signatureBase64,
        },
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
