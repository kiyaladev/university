import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  ancien: string;

  @IsString()
  @MinLength(6, { message: 'Le nouveau mot de passe doit faire au moins 6 caractères' })
  nouveau: string;
}
