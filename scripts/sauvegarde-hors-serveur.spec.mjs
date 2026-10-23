import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaire = mkdtempSync(path.join(tmpdir(), 'university-hors-serveur-test-'));
const bin = path.join(temporaire, 'bin');
const backups = path.join(temporaire, 'backups');
const cles = path.join(temporaire, 'android-cle');
mkdirSync(bin);
mkdirSync(backups);
mkdirSync(cles);

// rsync simulé : il journalise ses arguments et ne touche à rien.
writeFileSync(
  path.join(bin, 'rsync'),
  `#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' "$*" >> "\${FAKE_RSYNC_LOG:?}"\nexit "\${FAKE_RSYNC_STATUS:-0}"\n`,
);
chmodSync(path.join(bin, 'rsync'), 0o700);

const pathEnv = `${bin}:${process.env.PATH ?? ''}`;

function run(env = {}) {
  return spawnSync('bash', [path.join(root, 'scripts/sauvegarde-hors-serveur.sh')], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: pathEnv,
      UNIVERSITY_BACKUP_DIR: backups,
      UNIVERSITY_BACKUP_CLES_DIR: cles,
      ...env,
    },
  });
}

try {
  // Un dump et une clé à sauvegarder.
  const dump = path.join(backups, 'university-20261023-031500.dump');
  writeFileSync(dump, 'dump');
  writeFileSync(`${dump}.sha256`, 'sha256');
  writeFileSync(path.join(cles, 'unipresence.keystore'), 'keystore');
  writeFileSync(
    path.join(cles, 'cle.properties'),
    'storeFile=/tmp/universite/unipresence.keystore\nkeyPassword=secret\n',
  );

  // 1. Sans destination : la tâche doit échouer, pas copier à côté.
  const sansDestination = run({ UNIVERSITY_BACKUP_REMOTE: '' });
  assert.equal(sansDestination.status, 64, 'a missing destination must fail the task');
  assert.match(sansDestination.stderr, /UNIVERSITY_BACKUP_REMOTE n'est pas défini/);
  assert.match(sansDestination.stderr, /ce n'est pas une sauvegarde/);

  // 2. Une destination locale n'est pas une sauvegarde hors serveur.
  const locale = run({ UNIVERSITY_BACKUP_REMOTE: '/tmp/sauvegarde' });
  assert.equal(locale.status, 64, 'a local path cannot be reported as offsite');

  // 3. Copie effective : le dump et la clé partent vers la destination.
  const journal = path.join(temporaire, 'rsync.log');
  const copie = run({
    UNIVERSITY_BACKUP_REMOTE: 'mock:/offsite/university',
    FAKE_RSYNC_LOG: journal,
  });
  assert.equal(copie.status, 0, copie.stderr);
  const lignes = readFileSync(journal, 'utf8');
  assert.match(lignes, /university-20261023-031500\.dump/);
  assert.match(lignes, /mock:\/offsite\/university\/$/m);
  assert.match(lignes, /unipresence\.keystore/);
  assert.match(lignes, /cle\.properties/);
  assert.match(lignes, /mock:\/offsite\/university\/android-cle\/$/m);

  // 4. Une copie distante ratée doit faire échouer la tâche.
  const echec = run({
    UNIVERSITY_BACKUP_REMOTE: 'mock:/offsite/university',
    FAKE_RSYNC_LOG: path.join(temporaire, 'rsync-echec.log'),
    FAKE_RSYNC_STATUS: '23',
  });
  assert.equal(echec.status, 23, 'a failed remote copy should fail the task');

  // 5. Avec une phrase de passe, la clé est chiffrée avant de partir.
  const passfile = path.join(temporaire, 'passe.txt');
  writeFileSync(passfile, 'phrase-de-passe\n');
  chmodSync(passfile, 0o600);
  const journalChiffre = path.join(temporaire, 'rsync-chiffre.log');
  const chiffre = run({
    UNIVERSITY_BACKUP_REMOTE: 'mock:/offsite/university',
    UNIVERSITY_BACKUP_GPG_PASSFILE: passfile,
    FAKE_RSYNC_LOG: journalChiffre,
  });
  assert.equal(chiffre.status, 0, chiffre.stderr);
  const lignesChiffrees = readFileSync(journalChiffre, 'utf8');
  assert.match(lignesChiffrees, /unipresence\.keystore\.gpg/);
  assert.match(lignesChiffrees, /cle\.properties\.gpg/);
  assert.doesNotMatch(lignesChiffrees, /unipresence\.keystore(?!\.gpg)/);

  // 6. Une clé absente doit être signalée : c'est elle qu'on ne peut pas
  //    remplacer si le serveur disparaît.
  const sansCle = run({
    UNIVERSITY_BACKUP_REMOTE: 'mock:/offsite/university',
    UNIVERSITY_BACKUP_CLES_DIR: path.join(temporaire, 'cle-absente'),
    FAKE_RSYNC_LOG: path.join(temporaire, 'rsync-sans-cle.log'),
  });
  assert.equal(sansCle.status, 66, 'a missing signing key must fail the task');

  console.log(
    'sauvegarde-hors-serveur : destination obligatoire ; dump et clé copiés par rsync ; ' +
      'échec distant propagé ; keystore chiffré quand une phrase de passe est fournie ; ' +
      'clé absente refusée',
  );
} finally {
  rmSync(temporaire, { recursive: true, force: true });
}
