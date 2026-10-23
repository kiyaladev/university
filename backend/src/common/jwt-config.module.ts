import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { JWT_SECRET_EXEMPLE } from './configuration';

export { JWT_SECRET_EXEMPLE };

/** Options de signature du module JWT, dont la durée de vie attendue. */
type OptionsSignature = NonNullable<JwtModuleOptions['signOptions']>;

/** Forme minimale du service de configuration, pour rester testable. */
interface LectureConfig {
  get<T = string>(cle: string): T | undefined;
}

/**
 * Résolution du secret et de la durée de vie. Exportée pour être testée
 * directement : c'est ici que se joue le bug décrit plus bas, pas dans la
 * déclaration du module.
 */
export function optionsJwt(config: LectureConfig) {
  const secret = config.get<string>('JWT_SECRET');
  // En production, l'absence de secret doit arrêter le démarrage. Avec un repli,
  // l'application démarrait normalement et signait *et* vérifiait tous les
  // jetons avec une constante écrite en clair dans le dépôt : une
  // authentification entièrement contournable, sans le moindre signal.
  // La valeur d'exemple de `.env.example` est publique : l'accepter revient
  // au même contournement qu'un secret absent.
  if (process.env.NODE_ENV === 'production' && (!secret || secret === JWT_SECRET_EXEMPLE)) {
    throw new Error('JWT_SECRET est obligatoire en production. Générez-en une : openssl rand -hex 32');
  }
  return {
    secret: secret ?? JWT_SECRET_EXEMPLE,
    signOptions: {
      expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '12h') as OptionsSignature['expiresIn'],
    },
  };
}

/**
 * Source unique du secret de signature des jetons.
 *
 * Le piège que ce module ferme : `JwtModule.register({ secret: process.env.X })`
 * est évalué au moment où Nest lit le décorateur `@Module`, c'est-à-dire quand
 * le fichier est importé — donc **avant** que `ConfigModule.forRoot()` n'ait
 * chargé le `.env`. La variable était alors `undefined` et les jetons étaient
 * signés avec la valeur de repli, écrite en clair dans le dépôt. Ça ne
 * fonctionnait que parce qu'un autre module importait `@prisma/client`, qui lit
 * le `.env` en effet de bord ; réordonner un seul import suffisait à tout
 * casser, sans le moindre signal.
 *
 * `registerAsync` avec `ConfigService` s'exécute au moment de l'injection,
 * donc après le chargement de la configuration. `global: true` rend le
 * `JwtService` disponible partout : les 21 modules qui réenregistraient le
 * leur n'ont plus rien à déclarer, et il ne peut plus y avoir deux secrets en
 * circulation entre la signature et la vérification.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => optionsJwt(config),
    }),
  ],
  exports: [JwtModule],
})
export class JwtConfigModule {}
