import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from './decorators';

/** Au-delà, la base est jugée indisponible : une sonde doit répondre vite. */
export const DELAI_SONDE_BASE_MS = 2_000;

const SERVICE = 'university-api';

@ApiTags('Santé')
@Controller()
export class HealthController {
  private readonly journal = new Logger('Santé');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 200 avec le même corps qu'avant quand la base répond à `SELECT 1` ;
   * 503 sinon (panne, ou pas de réponse dans le délai), pour que la
   * supervision et le proxy voient réellement l'API hors service.
   */
  @Public()
  @Get('health')
  async health() {
    try {
      await this.sonderBase();
    } catch (erreur) {
      this.journal.warn(`Base de données indisponible : ${(erreur as Error)?.message ?? erreur}`);
      throw new ServiceUnavailableException({
        status: 'error',
        service: SERVICE,
        database: 'unavailable',
        date: new Date().toISOString(),
      });
    }
    return { status: 'ok', service: SERVICE, date: new Date().toISOString() };
  }

  private async sonderBase() {
    let minuteur: NodeJS.Timeout | undefined;
    const delai = new Promise<never>((_, rejeter) => {
      minuteur = setTimeout(
        () => rejeter(new Error(`pas de réponse en ${DELAI_SONDE_BASE_MS} ms`)),
        DELAI_SONDE_BASE_MS,
      );
    });
    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, delai]);
    } finally {
      clearTimeout(minuteur);
    }
  }
}
