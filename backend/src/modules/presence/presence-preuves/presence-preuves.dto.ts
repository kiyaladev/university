import {
  IsBoolean,
  IsUUID,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class DefinirCodePinDto {
  @Matches(/^\d{4,6}$/, { message: 'Le code doit comporter 4 à 6 chiffres' })
  code: string;
}

/** Enrôlement d'une empreinte : le gabarit vient de la passerelle biométrique. */
export class EnrolerEmpreinteDto {
  @IsString() @IsNotEmpty() template: string;

  @IsOptional() @IsString() doigt?: string;

  /** Horodatage et signature HMAC produits par la passerelle. */
  @IsString() horodatage: string;
  @IsString() signature: string;

  @IsOptional() @IsInt() @Min(0) @Max(100) qualite?: number;

  /**
   * Consentement de l'enseignant, recueilli devant lui avant la lecture.
   * Sans lui, on ne conserve pas de biométrie : le refus est un droit, et il
   * laisse le code personnel et la signature comme moyens de plein exercice.
   */
  @IsBoolean() consentement: boolean;

  /** Appareil qui a produit la lecture, quand elle vient d'un lecteur embarqué. */
  @IsOptional() @IsUUID() appareilId?: string;
}

export class EnrolerAppareilDto {
  @IsString() @IsNotEmpty() libelle: string;
}

/** Résultat d'une vérification d'empreinte transmis lors du pointage. */
export class PreuveEmpreinteDto {
  @IsInt() @Min(0) @Max(100) score: number;
  @IsString() horodatage: string;
  @IsString() signature: string;
  @IsOptional() @IsUUID() appareilId?: string;

  /**
   * Nonce de la tentative : identifiant unique de la lecture. Quand la
   * passerelle le signe, il identifie la preuve consommée — deux envois de la
   * même tentative se rejoignent alors, même si la signature diffère. Une
   * passerelle plus ancienne ne le signe pas : l'API s'appuie alors sur
   * l'empreinte de la signature, qui change à chaque lecture.
   */
  @IsOptional() @IsString() @MaxLength(128) @Matches(/^[A-Za-z0-9._:-]{1,128}$/) tentativeId?: string;
}
