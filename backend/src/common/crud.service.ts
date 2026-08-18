import { ConflictException, NotFoundException } from '@nestjs/common';
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
  message: string,
): Promise<T> {
  try {
    return await suppression();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ConflictException(message);
    }
    throw e;
  }
}

export interface CrudOptions {
  /** Champs textuels balayés par `?search=`. */
  searchFields?: string[];
  include?: Record<string, unknown>;
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
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';
    const fullWhere = { ...where, ...this.searchWhere(query.search) };

    const orderBy = query.sort
      ? { [query.sort]: query.order ?? 'asc' }
      : (this.options.orderBy as any);

    const [data, total] = await Promise.all([
      this.delegate.findMany({
        where: fullWhere,
        include: this.options.include,
        orderBy,
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      }),
      this.delegate.count({ where: fullWhere }),
    ]);

    return { data, total, page: all ? 1 : page, pageSize: all ? total : pageSize };
  }

  async findOne(id: string): Promise<T> {
    const item = await this.delegate.findUnique({
      where: { id },
      include: this.options.include,
    });
    if (!item) {
      throw new NotFoundException(`${this.options.label ?? this.model} introuvable`);
    }
    return item;
  }

  async create(data: any): Promise<T> {
    return this.delegate.create({ data, include: this.options.include });
  }

  async update(id: string, data: any): Promise<T> {
    await this.findOne(id);
    return this.delegate.update({ where: { id }, data, include: this.options.include });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.findOne(id);
    await this.delegate.delete({ where: { id } });
    return { id };
  }
}
