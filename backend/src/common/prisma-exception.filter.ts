import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  HttpStatus,
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
 *-temps renvoie une 500 illisible à l'utilisateur, alors que la situation
 * demande un 404. C'est le cas par défaut pour les services qui n'utilisent pas
 * CrudService, qui vérifie déjà l'existence avant d'écrire.
 */
@Catch()
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  constructor(adapter: HttpAdapterHost) {
    super(adapter.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2025': // Required record not found
        case 'P2018': // Records not found
          exception = new NotFoundException(t('common.notFoundRecord'));
          break;
        case 'P2002': // Unique constraint failed
          exception = new ConflictException(t('common.duplicateRecord'));
          break;
        case 'P2034': // Transaction failed because of a write conflict
          exception = new ConflictException(t('common.concurrentWrite'));
          break;
        default:
          this.logger.error(`Erreur Prisma ${exception.code} non traduite`, exception.stack);
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      exception = new HttpException(t('common.badRequest'), HttpStatus.BAD_REQUEST);
    }

    if (exception instanceof HttpException) return super.catch(exception, host);

    this.logger.error(`Erreur non gérée : ${(exception as Error)?.message ?? exception}`, (exception as Error)?.stack);
    return super.catch(new HttpException(t('common.internalError'), HttpStatus.INTERNAL_SERVER_ERROR), host);
  }
}
