import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { t } from './i18n';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Paginated, QueryDto } from './dto';
import { paginer, pagine } from './pagination';

/**
 * Enveloppe une suppression dure. Sur les référentiels (années, structure,
 * salles), une ligne encore référencée fait échouer le DELETE côté PostgreSQL :
 * Prisma lève alors P2003 et, sans traitement, l'utilisateur reçoit une 500
 * illisible pour une situation parfaitement normale. On la traduit en 409 avec
 * un message qui dit quoi faire.
 */
export async function supprimerOuConflit<T>(suppression: () => Promise<T>, messageOrKey: string): Promise<T> {
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
 *
 * Les cinq méthodes portent les verbes français de la convention du projet
 * (`lister`, `lire`, `creer`, `modifier`, `supprimer`) : les services métier
 * les surchargent avec leurs propres paramètres (utilisateur, transaction…).
 * Les signatures de base sont donc volontairement larges (`unknown`,
 * `...contexte`) pour rester compatibles avec ces surcharges.
 *
 * Le type du modèle reste `any` par défaut : les services qui l'héritent sans
 * le préciser s'appuient sur le delegate Prisma résolu à l'exécution, dont la
 * forme exacte n'est connue qu'au moment de l'appel.
 */
export class CrudService<T = any> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly model: string,
    protected readonly options: CrudOptions = {},
  ) {}

  /**
   * Delegate Prisma du modèle configuré : il est résolu à l'exécution, le type
   * exact dépend du modèle et n'est connu qu'au moment de l'appel.
   */
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

  async lister(query: QueryDto = {}, where: unknown = {}): Promise<Paginated<T>> {
    return this.listerModele(query, where);
  }

  /**
   * @deprecated Alias de migration : `lister` le remplace. Conservé le temps
   * que tous les modules passent à la convention française. Il délègue à
   * `lister` : la surcharge métier d'un service reste donc atteinte.
   */
  async findAll(query: QueryDto = {}, where: unknown = {}, ..._contexte: unknown[]): Promise<Paginated<T>> {
    return this.lister(query, where);
  }

  private async listerModele(query: QueryDto, where: unknown): Promise<Paginated<T>> {
    const pagination = paginer(query);
    const fullWhere = { ...(where as Record<string, unknown>), ...this.searchWhere(query.search) };

    // `?sort=` part d'une liste blanche : un champ inconnu sur le modèle doit
    // rendre une 400 explicite, pas une PrismaClientValidationError en 500.
    const orderBy = this.orderByDe(query);

    const [data, total] = await Promise.all([
      this.delegate.findMany({
        where: fullWhere,
        ...(this.options.select ? { select: this.options.select } : { include: this.options.include }),
        ...(this.options.omit && !this.options.select ? { omit: this.options.omit } : {}),
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.delegate.count({ where: fullWhere }),
    ]);

    return pagine(data, total, pagination);
  }

  /** Traduit `?sort=&order=` en un `orderBy` validé contre le schéma du modèle. */
  protected orderByDe(query: QueryDto): Record<string, unknown> | Record<string, unknown>[] | undefined {
    const defaut = this.options.orderBy as Record<string, unknown> | Record<string, unknown>[] | undefined;
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

  async lire(id: string, ..._contexte: unknown[]): Promise<T> {
    return this.lireModele(id);
  }

  /**
   * @deprecated Alias de migration : `lire` le remplace. Conservé le temps que
   * tous les modules passent à la convention française. Il délègue à `lire` :
   * la surcharge métier d'un service reste donc atteinte.
   */
  async findOne(id: string, ..._contexte: unknown[]): Promise<T> {
    return this.lire(id);
  }

  private async lireModele(id: string): Promise<T> {
    const item = await this.delegate.findUnique({
      where: { id },
      ...(this.options.select ? { select: this.options.select } : { include: this.options.include }),
      ...(this.options.omit && !this.options.select ? { omit: this.options.omit } : {}),
    });
    if (!item) {
      throw new NotFoundException(t('common.crud.itemNotFound', { label: this.options.label ?? this.model }));
    }
    return item;
  }

  async creer(data: unknown, ..._contexte: unknown[]): Promise<T> {
    return this.creerModele(data);
  }

  /**
   * @deprecated Alias de migration : `creer` le remplace. Conservé le temps
   * que tous les modules passent à la convention française. Il délègue à
   * `creer` : la surcharge métier d'un service reste donc atteinte.
   */
  async create(data: unknown, ..._contexte: unknown[]): Promise<T> {
    return this.creer(data);
  }

  private async creerModele(data: unknown): Promise<T> {
    return this.delegate.create({
      data,
      include: this.options.include,
      ...(this.options.omit ? { omit: this.options.omit } : {}),
    });
  }

  async modifier(id: string, data: unknown, ..._contexte: unknown[]): Promise<T> {
    return this.modifierModele(id, data);
  }

  /**
   * @deprecated Alias de migration : `modifier` le remplace. Conservé le temps
   * que tous les modules passent à la convention française. Il délègue à
   * `modifier` : la surcharge métier d'un service reste donc atteinte.
   */
  async update(id: string, data: unknown, ..._contexte: unknown[]): Promise<T> {
    return this.modifier(id, data);
  }

  private async modifierModele(id: string, data: unknown): Promise<T> {
    await this.lireModele(id);
    return this.delegate.update({
      where: { id },
      data,
      include: this.options.include,
      ...(this.options.omit ? { omit: this.options.omit } : {}),
    });
  }

  async supprimer(id: string, ..._contexte: unknown[]): Promise<{ id: string }> {
    return this.supprimerModele(id);
  }

  /**
   * @deprecated Alias de migration : `supprimer` le remplace. Conservé le temps
   * que tous les modules passent à la convention française. Il délègue à
   * `supprimer` : la surcharge métier d'un service reste donc atteinte.
   */
  async remove(id: string, ..._contexte: unknown[]): Promise<{ id: string }> {
    return this.supprimer(id);
  }

  private async supprimerModele(id: string): Promise<{ id: string }> {
    await this.lireModele(id);
    await this.delegate.delete({ where: { id } });
    return { id };
  }
}
