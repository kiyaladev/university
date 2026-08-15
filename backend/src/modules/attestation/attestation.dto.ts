import {
  IsBoolean,
  IsUUID,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
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
}

export class OuvrirDemandeDto {
  @IsString() seanceId: string;
}

export class VerifierPasskeyDto {
  @IsObject() reponse: Record<string, any>;
}

export class EnregistrerPasskeyDto {
  @IsObject() reponse: Record<string, any>;
  @IsOptional() @IsString() appareil?: string;
}
