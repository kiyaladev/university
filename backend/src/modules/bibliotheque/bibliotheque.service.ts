import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CrudService } from '../../common/crud.service';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDocumentDto,
  DocumentQueryDto,
  UpdateDocumentDto,
} from './bibliotheque.dto';
import { PlagiatService } from './plagiat.service';

/**
 * Dépôt institutionnel & bibliothèque numérique. En pilote : archivage natif
 * des fichiers chargés dans l'application. La numérisation des fonds papier
 * sera facturée à part (marché AUF/UNESCO) et n'a pas de représentation ici.
 *
 * À la création / mise à jour d'un document, le service déclenche :
 *  - l'extraction du texte PDF et le calcul d'empreinte (cf. PlagiatService) ;
 *  - la recherche de doublons parmi tous les autres documents du dépôt.
 *
 * La détection est asynchrone dans le sens où elle ne fait pas échouer la
 * création si elle échoue : on loggue et on continue. Une suspicion peut être
 * levée plus tard via le recalcul global.
 */
const LIMITE_DATA_URL_OCTETS = 8 * 1024 * 1024;

const DOCUMENT_INCLUDE = {
  departement: true,
  enseignant: { include: { departement: true } },
  etudiant: true,
  deposePar: { select: { id: true, nom: true, prenom: true, role: true } },
};

export interface FichierDocument {
  octets: Buffer;
  mime: string;
  nom: string;
}

@Injectable()
export class BibliothequeService extends CrudService {
  constructor(prisma: PrismaService, private readonly plagiat: PlagiatService) {
    super(prisma, 'documentDepot', {
      searchFields: ['titre', 'auteurs', 'resume'],
      orderBy: { createdAt: 'desc' },
      include: DOCUMENT_INCLUDE,
      label: 'Document',
    });
  }

  /** Catégorisation automatique : l'année d'édition, sinon l'année de dépôt. */
  static anneeDuDocument(doc: { anneeEdition?: number | null; createdAt: Date | string }): number {
    return doc.anneeEdition ?? new Date(doc.createdAt).getFullYear();
  }

  /** Le JSON de réponse ne transporte jamais le fichier : la lourde charge
   *  base64 ne circule que sur la route de téléchargement dédiée. */
  private sansFichier<T extends { fichier?: unknown }>(doc: T): Omit<T, 'fichier'> {
    if (!doc) return doc;
    const { fichier: _fichier, ...reste } = doc as any;
    return reste;
  }

  /** Extrait le type MIME déclaré et les octets bruts d'un data-url. */
  private decouperDataUrl(dataUrl: string): { mime?: string; octets: Buffer } {
    const virgule = dataUrl.indexOf(',');
    const enTete = virgule === -1 ? '' : dataUrl.slice(0, virgule);
    const base64 = virgule === -1 ? dataUrl : dataUrl.slice(virgule + 1);
    return { mime: /^data:([^;]+)/.exec(enTete)?.[1], octets: Buffer.from(base64, 'base64') };
  }

  /**
   * Calcule les métadonnées du fichier joint et vérifie la taille. La limite de
   * 8 Mo porte sur le data-url lui-même (le body JSON d'express est plafonné à
   * 8 Mo dans main.ts) — en pratique express refuse avant nous au-delà.
   * Retourne systématiquement un objet avec `typeMime` et `tailleKo` (nuls si
   * pas de fichier) pour faciliter l'appel en aval.
   */
  private preparerFichier(
    dto: CreateDocumentDto | UpdateDocumentDto,
  ): (CreateDocumentDto | UpdateDocumentDto) & { typeMime: string | null; tailleKo: number | null } {
    if (!dto.fichier) {
      return { ...(dto as any), typeMime: null, tailleKo: null } as any;
    }
    const longueur = Buffer.byteLength(dto.fichier, 'utf8');
    if (longueur >= LIMITE_DATA_URL_OCTETS) {
      const mo = (longueur / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(
        `Le fichier joint dépasse la limite de 8 Mo (data-url base64 de ${mo} Mo). ` +
          'Compressez le PDF ou réduisez sa résolution avant de le re-déposer.',
      );
    }
    const { mime, octets } = this.decouperDataUrl(dto.fichier);
    return {
      ...(dto as any),
      typeMime: mime ?? null,
      tailleKo: Math.max(1, Math.round(octets.length / 1024)),
    } as any;
  }

  /**
   * Lance la détection de doublons en arrière-plan via la variante
   * silencieuse : un échec ne compromet pas la création du document, et le
   * recalcul global ADMIN rattrapera l'oubli.
   */
  private async analyserDoublons(documentId: string): Promise<void> {
    await this.plagiat.detecterSilencieusement(documentId);
  }

  /**
   * Liste accessible partout. Sans jeton valide : seuls les documents publiés.
   * Avec un jeton (staff) : tout le fonds, et le filtre « publié / non » via
   * ?public=. La page publique et la page du staff partagent donc l'URL.
   */
  async liste(query: DocumentQueryDto, utilisateur: AuthUser | null) {
    const filtres = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.departementId ? { departementId: query.departementId } : {}),
      ...(query.anneeEdition ? { anneeEdition: query.anneeEdition } : {}),
    };
    const where = utilisateur
      ? { ...filtres, ...(query.public ? { public: query.public === 'true' } : {}) }
      : { ...filtres, public: true };
    const resultat = await this.findAll(query, where);
    return { ...resultat, data: (resultat.data as any[]).map((d) => this.sansFichier(d)) };
  }

  /** Top 10 de l'année en cours par téléchargements — pour la page d'accueil. */
  async populaires() {
    const annee = new Date().getFullYear();
    const docs = await this.prisma.documentDepot.findMany({
      where: {
        public: true,
        OR: [
          { anneeEdition: annee },
          { anneeEdition: null, createdAt: { gte: new Date(annee, 0, 1) } },
        ],
      },
      orderBy: [{ telechargements: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      include: DOCUMENT_INCLUDE,
    });
    return (docs as any[]).map((d) => this.sansFichier(d));
  }

  /**
   * Dépôt d'un nouveau document : extrait le texte du PDF (s'il y a lieu),
   * calcule l'empreinte, persiste, puis lance la détection de doublons.
   */
  async deposer(dto: CreateDocumentDto, utilisateur: AuthUser) {
    const prepare = this.preparerFichier(dto);
    const { contenuTexte, empreinteHash } = await this.plagiat.preparerContenu(
      prepare.fichier ?? null,
      prepare.typeMime ?? null,
    );
    const document = await this.create({
      ...prepare,
      contenuTexte: contenuTexte ?? null,
      empreinteHash: empreinteHash ?? null,
      deposeParId: utilisateur.id,
    });
    void this.analyserDoublons(document.id);
    return this.sansFichier(document);
  }

  async modifier(id: string, dto: UpdateDocumentDto, utilisateur: AuthUser) {
    const document: any = await super.findOne(id);
    if (utilisateur.role !== Role.ADMIN && document.deposeParId !== utilisateur.id) {
      throw new ForbiddenException(
        'Seul le déposant initial peut modifier ce document (sauf administrateur)',
      );
    }
    const prepare = this.preparerFichier(dto);
    // Si un nouveau fichier est fourni, on relance extraction + empreinte.
    // Sinon, on conserve les valeurs existantes : le déposant n'est pas obligé
    // de ré-uploader le PDF pour corriger un titre ou un résumé.
    let contenuTexte = document.contenuTexte ?? null;
    let empreinteHash = document.empreinteHash ?? null;
    if (prepare.fichier) {
      const extrait = await this.plagiat.preparerContenu(prepare.fichier, prepare.typeMime ?? null);
      contenuTexte = extrait.contenuTexte;
      empreinteHash = extrait.empreinteHash;
    }
    const miseAJour = await this.update(id, {
      ...prepare,
      contenuTexte,
      empreinteHash,
    });
    void this.analyserDoublons(id);
    return this.sansFichier(miseAJour);
  }

  async supprimer(id: string, utilisateur: AuthUser) {
    const document: any = await super.findOne(id);
    if (utilisateur.role !== Role.ADMIN && document.deposeParId !== utilisateur.id) {
      throw new ForbiddenException(
        'Seul le déposant initial peut supprimer ce document (sauf administrateur)',
      );
    }
    return this.remove(id);
  }

  /**
   * Fichier à télécharger (data-url décodé). Le compteur de téléchargements
   * n'augmente qu'ici, jamais sur les lectures de métadonnées. Un document non
   * publié n'est accessible qu'à un porteur de jeton valide.
   */
  async fichier(id: string, utilisateur: AuthUser | null): Promise<FichierDocument> {
    const document: any = await super.findOne(id);
    if (!document.fichier) {
      throw new NotFoundException('Ce document est déposé sans fichier (métadonnées seules)');
    }
    if (!document.public && !utilisateur) {
      throw new NotFoundException('Document introuvable');
    }
    await this.prisma.documentDepot.update({
      where: { id },
      data: { telechargements: { increment: 1 } },
    });

    const { mime, octets } = this.decouperDataUrl(document.fichier);
    const type = document.typeMime ?? mime ?? 'application/octet-stream';
    return { octets, mime: type, nom: this.nomFichier(document.titre, type) };
  }

  /** Nom à la française, sans retour de ligne, pour l'en-tête Content-Disposition. */
  private nomFichier(titre: string, mime: string): string {
    const base = (titre as string)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'document';
    const extensions: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
    };
    return `${base}.${extensions[mime] ?? (mime.includes('pdf') ? 'pdf' : 'bin')}`;
  }
}
