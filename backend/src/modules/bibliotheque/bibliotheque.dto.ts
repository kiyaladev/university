import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsBooleanString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TypeDocument } from '@prisma/client';
import { QueryDto } from '../../common/dto';

export class CreateDocumentDto {
  @IsString() @MinLength(1) titre: string;
  @IsOptional() @IsEnum(TypeDocument) type?: TypeDocument;
  /** Texte libre : « Nom1 ; Nom2 ». */
  @IsOptional() @IsString() auteurs?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) anneeEdition?: number;
  @IsOptional() @IsString() resume?: string;
  /** Data-url (base64) du PDF joint ; absent pour un dépôt de métadonnées seules.
   *  Le serveur plafonne le body JSON à 8 Mo : c'est LA limite du data-url. */
  @IsOptional() @IsString() fichier?: string;
  @IsOptional() @IsBoolean() public?: boolean;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @IsUUID() enseignantId?: string;
  @IsOptional() @IsUUID() etudiantId?: string;
  /** Mots-clés saisis manuellement par le déposant. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  motsClefs?: string[];
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}

export class DocumentQueryDto extends QueryDto {
  @IsOptional() @IsEnum(TypeDocument) type?: TypeDocument;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @Type(() => Number) @IsInt() anneeEdition?: number;
  /** « 1 » ou « 0 » : ne s'applique qu'à la liste connectée (staff). Le
   *  visiteur public ne reçoit jamais un document non publié. */
  @IsOptional() @IsBooleanString() public?: string;
}

/**
 * Recherche plein texte (PostgreSQL FTS, dictionnaire `french`) sur la colonne
 * tsvector `recherche` du DocumentDepot. Les filtres classiques s'appliquent en
 * sus du score. La requête accepte le préfixe : `mem*` équivaut à `mémoire`,
 * `recherche*`, etc. Les caractères spéciaux tsquery (`! & | ( ) : *`) sont
 * neutralisés avant construction de la requête.
 */
export class RechercheDocumentDto extends QueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q: string;
  @IsOptional() @IsEnum(TypeDocument) type?: TypeDocument;
  @IsOptional() @IsUUID() departementId?: string;
  @IsOptional() @Type(() => Number) @IsInt() anneeEdition?: number;
  @IsOptional() @IsBooleanString() public?: string;
}

/** Décision d'arbitrage d'une suspicion de plagiat. */
export class AcquitterPlagiatDto {
  @IsIn(['ACQUITTE', 'CONFIRME'])
  decision: 'ACQUITTE' | 'CONFIRME';
  @IsOptional() @IsString() @MaxLength(1000) commentaire?: string;
}
