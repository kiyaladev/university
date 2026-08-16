import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators';
import { RechercheDocumentDto } from './bibliotheque.dto';

const DOCUMENT_INCLUDE = {
  departement: true,
  enseignant: { include: { departement: true } },
  etudiant: true,
  deposePar: { select: { id: true, nom: true, prenom: true, role: true } },
} as const;

/**
 * Construit une chaîne `to_tsquery('french', ...)` sûre à partir d'une saisie
 * libre : on ne garde que lettres (accentuées comprises), chiffres et
 * espaces ; chaque token devient un préfixe `mot:*` (recherche large) et
 * l'ensemble est joint en ET. Les accents sont conservés car le dictionnaire
 * `french` ne les normalise pas — retirer l'accent ici empêcherait la
 * concordance avec « réseau » dans le tsvector. Une saisie vide ou
 * entièrement filtrée renvoie une chaîne vide — l'appelant doit alors
 * court-circuiter la requête.
 */
function construireTsQuery(saisie: string): string {
  const nettoye = saisie
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôöùûüçÿœæ\s]/gi, ' ')
    .trim();
  if (!nettoye) return '';
  const tokens = nettoye
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 12);
  if (!tokens.length) return '';
  return tokens.map((t) => `${t}:*`).join(' & ');
}

/**
 * Retire le champ `fichier` (data-url base64) et `contenuTexte` (potentiellement
 * volumineux) avant de renvoyer la ligne au front : ces colonnes ne sont utiles
 * qu'au téléchargement et à la détection locale, jamais à l'affichage.
 */
function sansLourdePayload<T extends { fichier?: unknown; contenuTexte?: unknown }>(doc: T): Omit<T, 'fichier' | 'contenuTexte'> {
  const { fichier: _f, contenuTexte: _c, ...reste } = doc as any;
  return reste;
}

interface LigneFts {
  id: string;
  rank: number;
}

interface DocumentAvecRang {
  id: string;
  rang: number;
  [cle: string]: unknown;
}

/**
 * Recherche plein texte (PostgreSQL FTS, dictionnaire `french`) sur le dépôt.
 * Service isolé pour ne pas alourdir `bibliotheque.service` : la requête passe
 * par `$queryRaw` (la colonne `recherche` est `tsvector` et n'est pas
 * modélisée par Prisma), puis on ré-hydrate les documents complets avec
 * `findMany({ id: { in: ids } })` pour conserver le même format JSON que la
 * liste classique.
 */
@Injectable()
export class RechercheService {
  private readonly logger = new Logger(RechercheService.name);

  constructor(private readonly prisma: PrismaService) {}

  async rechercher(query: RechercheDocumentDto, utilisateur: AuthUser | null) {
    const tsquery = construireTsQuery(query.q);
    if (!tsquery) {
      return { data: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 50 };
    }

    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 50);
    const all = query.all === 'true' || query.all === '1';
    const limit = all ? 1000 : Math.max(1, Math.min(200, pageSize));
    const offset = all ? 0 : (Math.max(1, page) - 1) * pageSize;

    const publicSeulement = !utilisateur;
    const publicFiltre = query.public ? query.public === 'true' : publicSeulement;

    const conditions: Prisma.Sql[] = [Prisma.sql`recherche @@ to_tsquery('french', ${tsquery})`];
    if (publicFiltre !== undefined) {
      conditions.push(Prisma.sql`"public" = ${publicFiltre}`);
    }
    if (query.type) {
      conditions.push(Prisma.sql`type = ${query.type}::"TypeDocument"`);
    }
    if (query.departementId) {
      conditions.push(Prisma.sql`"departementId" = ${query.departementId}`);
    }
    if (query.anneeEdition) {
      conditions.push(Prisma.sql`"anneeEdition" = ${query.anneeEdition}`);
    }
    const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    const ids = await this.prisma.$queryRaw<LigneFts[]>(Prisma.sql`
      SELECT id, ts_rank(recherche, to_tsquery('french', ${tsquery})) AS rank
      FROM "DocumentDepot"
      ${whereSql}
      ORDER BY rank DESC, "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const totalRow = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM "DocumentDepot" ${whereSql}
    `);
    const total = Number(totalRow[0]?.count ?? 0);

    if (!ids.length) {
      return { data: [], total, page: all ? 1 : page, pageSize: all ? total : pageSize };
    }

    const docs = await this.prisma.documentDepot.findMany({
      where: { id: { in: ids.map((l) => l.id) } },
      include: DOCUMENT_INCLUDE as any,
    });
    const rangParId = new Map<string, number>(ids.map((l) => [l.id, l.rank]));
    const ordonnes: DocumentAvecRang[] = docs
      .map((d) => {
        const nettoye = sansLourdePayload(d as any) as Record<string, unknown>;
        nettoye.rang = rangParId.get(d.id) ?? 0;
        return nettoye as DocumentAvecRang;
      })
      .sort((a, b) => (b.rang ?? 0) - (a.rang ?? 0));

    this.logger.log(
      `Recherche « ${query.q} » → ${total} document(s) ; ${ids.length} affiché(s).`,
    );

    return {
      data: ordonnes,
      total,
      page: all ? 1 : page,
      pageSize: all ? total : pageSize,
    };
  }
}
