/**
 * Chiffrement des données biométriques au repos.
 *
 * Le gabarit d'empreinte n'a jamais besoin d'être lu par un humain : il n'est
 * que comparé. Le garder en clair dans une colonne texte, c'est offrir à
 * quiconque obtient une copie de la base — un dump égaré, un accès psql, une
 * sauvegarde recopiée — la biométrie de tout le corps enseignant. Le risque
 * n'est pas seulement technique : un enseignant qui l'apprend a raison de
 * refuser le dispositif.
 *
 * AES-256-GCM, clé hors base (variable d'environnement), format :
 *
 *     v1.<iv base64url>.<tag base64url>.<chiffré base64url>
 *
 * Les valeurs sans préfixe « v1. » sont des gabarits historiques restés en
 * clair : ils sont acceptés en lecture le temps de la migration, jamais écrits.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { Logger } from '@nestjs/common';

const PREFIXE = 'v1';
const SEL = 'unipresence.biometrie.v1';
const journal = new Logger('Coffre');

let cleMemo: Buffer | null = null;

/**
 * La clé vient de BIOMETRIE_CHIFFREMENT_CLE : 64 caractères hexadécimaux
 * (clé brute) ou n'importe quelle phrase secrète, dérivée par scrypt.
 */
function cle(): Buffer {
  if (cleMemo) return cleMemo;

  const brut = process.env.BIOMETRIE_CHIFFREMENT_CLE;
  if (!brut) {
    throw new Error(
      'BIOMETRIE_CHIFFREMENT_CLE absente : impossible de chiffrer les gabarits ' +
        'd’empreinte. Générez-la avec `openssl rand -hex 32`.',
    );
  }

  cleMemo = /^[0-9a-f]{64}$/i.test(brut)
    ? Buffer.from(brut, 'hex')
    : scryptSync(brut, SEL, 32);
  return cleMemo;
}

/** Vrai si la valeur est déjà chiffrée par ce module. */
export function estChiffre(valeur: string | null | undefined): boolean {
  return typeof valeur === 'string' && valeur.startsWith(`${PREFIXE}.`);
}

export function chiffrer(clair: string): string {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv('aes-256-gcm', cle(), iv);
  const chiffre = Buffer.concat([chiffreur.update(clair, 'utf8'), chiffreur.final()]);
  return [
    PREFIXE,
    iv.toString('base64url'),
    chiffreur.getAuthTag().toString('base64url'),
    chiffre.toString('base64url'),
  ].join('.');
}

export function dechiffrer(valeur: string): string {
  if (!estChiffre(valeur)) {
    // Gabarit d'avant la mise en place du coffre. Toléré en lecture pour ne pas
    // invalider les enrôlements existants ; `scripts/chiffrer-empreintes.ts`
    // les reprend.
    journal.warn('Gabarit encore en clair en base — lancez scripts/chiffrer-empreintes.ts');
    return valeur;
  }

  const [, iv, tag, corps] = valeur.split('.');
  const dechiffreur = createDecipheriv('aes-256-gcm', cle(), Buffer.from(iv!, 'base64url'));
  dechiffreur.setAuthTag(Buffer.from(tag!, 'base64url'));
  return Buffer.concat([
    dechiffreur.update(Buffer.from(corps!, 'base64url')),
    dechiffreur.final(),
  ]).toString('utf8');
}

/** Pour les tests : oublie la clé mémorisée. */
export function oublierCle() {
  cleMemo = null;
}
