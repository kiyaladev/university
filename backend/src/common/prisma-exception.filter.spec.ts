import { ArgumentsHost, ForbiddenException, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('PrismaExceptionFilter — réponses HTTP', () => {
  const response = {};
  const adapter = { isHeadersSent: jest.fn(() => false), reply: jest.fn(), end: jest.fn() };
  const host = { getArgByIndex: () => response } as unknown as ArgumentsHost;
  const filter = new PrismaExceptionFilter({ httpAdapter: adapter } as unknown as HttpAdapterHost);

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['P2002', 409],
    ['P2034', 409],
    ['P2025', 404],
    ['P2018', 404],
  ])('répond à %s sans relancer une exception depuis le filtre', (code, status) => {
    const error = new Prisma.PrismaClientKnownRequestError('Détail interne', { code, clientVersion: '6' });
    expect(() => filter.catch(error, host)).not.toThrow();
    expect(adapter.reply).toHaveBeenCalledWith(response, expect.objectContaining({ statusCode: status }), status);
  });

  it('conserve le refus métier et termine la réponse', () => {
    filter.catch(new ForbiddenException('Lecture seule'), host);
    expect(adapter.reply).toHaveBeenCalledWith(response, expect.objectContaining({ message: 'Lecture seule' }), 403);
  });

  it('répond aux erreurs inconnues sans divulguer leur détail', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter.catch(new Error('Secret interne à ne pas exposer'), host);
    expect(adapter.reply).toHaveBeenCalledWith(response, expect.anything(), 500);
    expect(JSON.stringify(adapter.reply.mock.calls[0][1])).not.toContain('Secret interne');
    logger.mockRestore();
  });
});
