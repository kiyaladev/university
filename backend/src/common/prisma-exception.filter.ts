import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { t } from './i18n';

/**
 * Traduit les erreurs Prisma que le code métier ne traite pas explicitement.
 *
 * Sans ce filtre, une `update({ where: { id } })` sur une ligne supprimée entre
 * -temps renvoie une 500 illisible à l'utilisateur, alors que la situation
 * demande un 404. C'est le cas par défaut pour les services qui n'utilisent pas
 * CrudService, qui vérifie déjà l'existence avant d'écrire.
 */
@Catch()
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  constructor(adapter: HttpAdapterHost) {
    super(adapter.httpAdapter);
  }

  /**
   * Traduit une exception en exception HTTP, sans encore écrire la réponse.
   *
   * La traduction est séparée de l'écriture pour qu'un filtre global puisse
   * ensuite normaliser le corps renvoyé au client dans un format unique
   * (voir `common/filters/erreur-http.filter.ts`).
   */
  protected verserException(exception: unknown): HttpException {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2025': // Required record not found
        case 'P2018': // Records not found
          return new NotFoundException(t('common.notFoundRecord'));
        case 'P2002': // Unique constraint failed
          return new ConflictException(t('common.duplicateRecord'));
        case 'P2034': // Transaction failed because of a write conflict
          return new ConflictException(t('common.concurrentWrite'));
        default:
          this.logger.error(`Erreur Prisma ${exception.code} non traduite`, exception.stack);
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return new BadRequestException(t('common.badRequest'));
    }

    if (exception instanceof HttpException) return exception;

    this.logger.error(`Erreur non gérée : ${(exception as Error)?.message ?? exception}`, (exception as Error)?.stack);
    return new InternalServerErrorException(t('common.internalError'));
  }

  catch(exception: unknown, host: ArgumentsHost) {
    return super.catch(this.verserException(exception), host);
  }
}
