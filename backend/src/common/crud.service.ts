import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { t } from './i18n';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Paginated, QueryDto } from './dto';

/**
 * Enveloppe une suppression dure. Sur les référentiels (années, structure,
 * salles), une ligne encore référencée fait échouer le DELETE côté PostgreSQL :
 * Prisma lève alors P2003 et, sans traitement, l'utilisateur reçoit une 500
 * illisible pour une situation parfaitement normale. On la traduit en 409 avec
 * un message qui dit quoi faire.
 */
export async function supprimerOuConflit<T>(
  suppression: () => Promise<T>,
  messageOrKey: string,
): Promise<T> {
  try {
    return await suppression();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      // Si la chaîne contient un point, on l'interprète comme une clé i18n ;
      // sinon on l'utilise telle quelle (rétrocompatibilité).
      const txt = messageOrKey.includes('.') ? t(messageOrKey) : messageOrKey;
      throw new ConflictException(txt);
    }
    throw e;
  }
}

export interface CrudOptions {
  /** Champs textuels balayés par `?search=`. */
  searchFields?: string[];
  /** Champs acceptés par `?sort=`. Par défaut, les clés de `orderBy`. */
  sortFields?: string[];
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
  /** Champs sensibles systématiquement omis dans les réponses CRUD. */
  omit?: Record<string, boolean>;
  orderBy?: Record<string, unknown> | Record<string, unknown>[];
  label?: string;
}

/**
 * Service CRUD générique sur un modèle Prisma. Les services métier en héritent
 * et ne redéfinissent que ce qui leur est spécifique.
 */
export class CrudService<T = any> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly model: string,
    protected readonly options: CrudOptions = {},
  ) {}

  protected get delegate(): any {
    return (this.prisma as any)[this.model];
  }

  protected searchWhere(search?: string) {
    const fields = this.options.searchFields ?? [];
    if (!search || !fields.length) return {};
    return {
      OR: fields.map((f) => ({ [f]: { contains: search, mode: 'insensitive' } })),
    };
  }

  async findAll(query: QueryDto = {}, where: Record<string, any> = {}): Promise<Paginated<T>> {
    const page = Number(query.page ?? 1);
    const all = query.all === 'true' || query.all === '1';
    const pageSize = Math.max(1, Math.min(1000, Number(query.pageSize ?? (all ? 1000 : 50))));
    const fullWhere = { ...where, ...this.searchWhere(query.search) };

    // `?sort=` part d'une liste blanche : un champ inconnu sur le modèle doit
    // rendre une 400 explicite, pas une PrismaClientValidationError en 500.
    const orderBy = this.orderByDe(query);

    const [data, total] = await Promise.all([
      this.delegate.findMany({
        where: fullWhere,
        ...(this.options.select ? { select: this.options.select } : { include: this.options.include }),
        ...(this.options.omit && !this.options.select ? { omit: this.options.omit } : {}),
        orderBy,
        ...(all ? { skip: 0, take: pageSize } : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.delegate.count({ where: fullWhere }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? Math.min(total, pageSize) : pageSize };
  }

  /** Traduit `?sort=&order=` en un `orderBy` validé contre le schéma du modèle. */
  protected orderByDe(query: QueryDto): Record<string, unknown> | Record<string, unknown>[] | undefined {
    const defaut = this.options.orderBy as any;
    if (!query.sort) return defaut;

    const autorises = this.sortFields();
    if (!autorises.includes(query.sort)) {
      throw new BadRequestException(
        t('common.crud.sortInconnu', { champ: query.sort, autorises: autorises.join(', ') || 'aucun' }),
      );
    }
    return { [query.sort]: query.order ?? 'asc' };
  }

  /**
   * Champs triables. Par défaut, l'unique source de vérité est le `orderBy` de
   * la configuration : le client ne peut donc jamais demander un tri qu'on ne
   * sait pas servir, et les services qui exposent davantage déclarent
   * `sortFields` explicitement.
   */
  protected sortFields(): string[] {
    if (this.options.sortFields?.length) return this.options.sortFields;
    const defaut = this.options.orderBy;
    if (Array.isArray(defaut)) return Object.keys(defaut[0] ?? {});
    return Object.keys(defaut ?? {});
  }

  async findOne(id: string): Promise<T> {
    const item = await this.delegate.findUnique({
      where: { id },
      ...(this.options.select ? { select: this.options.select } : { include: this.options.include }),
      ...(this.options.omit && !this.options.select ? { omit: this.options.omit } : {}),
    });
    if (!item) {
      throw new NotFoundException(
        t('common.crud.itemNotFound', { label: this.options.label ?? this.model }),
      );
    }
    return item;
  }

  async create(data: any): Promise<T> {
    return this.delegate.create({
      data,
      include: this.options.include,
      ...(this.options.omit ? { omit: this.options.omit } : {}),
    });
  }

  async update(id: string, data: any): Promise<T> {
    await this.findOne(id);
    return this.delegate.update({
      where: { id },
      data,
      include: this.options.include,
      ...(this.options.omit ? { omit: this.options.omit } : {}),
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.findOne(id);
    await this.delegate.delete({ where: { id } });
    return { id };
  }
}
