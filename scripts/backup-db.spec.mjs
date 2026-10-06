import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, statSync, utimesSync, writeFileSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(path.join(tmpdir(), 'university-backup-test-'));
const bin = path.join(temporary, 'bin');
const backups = path.join(temporary, 'backups');
mkdirSync(bin);

function executable(name, content) {
  const target = path.join(bin, name);
  writeFileSync(target, `#!/usr/bin/env bash\nset -euo pipefail\n${content}\n`);
  chmodSync(target, 0o700);
}

executable('pg_dump', `
  output=''
  for arg in "$@"; do case "$arg" in --file=*) output="\${arg#--file=}" ;; esac; done
  [[ -n "$output" ]]
  head -c "\${FAKE_DUMP_BYTES:-20480}" /dev/zero > "$output"
`);
executable('pg_restore', `
  [[ "\${1:-}" == --list ]] || exit 64
  for n in 1 2 3 4 5 6; do echo "TABLE DATA public table_$n owner"; done
`);
executable('rsync', `
  if [[ -n "\${FAKE_RSYNC_LOG:-}" ]]; then printf '%s\\n' "$*" >> "$FAKE_RSYNC_LOG"; fi
  exit "\${FAKE_RSYNC_STATUS:-0}"
`);

const pathEnv = `${bin}:${process.env.PATH ?? ''}`;
function run({ bytes = 20480, remote, rsyncStatus = 0, rsyncLog, keep = 30 } = {}) {
  return spawnSync('bash', [path.join(root, 'scripts/backup-db.sh')], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: pathEnv,
      DATABASE_URL: 'postgresql://backup-test:secret@127.0.0.1:5432/university?schema=public',
      UNIPRESENCE_BACKUP_DIR: backups,
      UNIPRESENCE_BACKUP_KEEP: String(keep),
      FAKE_DUMP_BYTES: String(bytes),
      FAKE_RSYNC_STATUS: String(rsyncStatus),
      ...(rsyncLog ? { FAKE_RSYNC_LOG: rsyncLog } : {}),
      ...(remote ? { UNIPRESENCE_BACKUP_REMOTE: remote } : {}),
    },
  });
}

try {
  mkdirSync(backups);
  const ancien = path.join(backups, 'university-ancienne.dump');
  const ancienHash = `${ancien}.sha256`;
  writeFileSync(ancien, 'old');
  writeFileSync(ancienHash, 'old');
  const vieux = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  utimesSync(ancien, vieux, vieux);
  utimesSync(ancienHash, vieux, vieux);

  const success = run({ keep: 1 });
  assert.equal(success.status, 0, success.stderr);
  const names = await readdir(backups);
  const dumpName = names.find(name => name.endsWith('.dump') && !name.endsWith('.dump.sha256'));
  assert.ok(dumpName, 'a completed archive should be present');
  assert.ok(names.includes(`${dumpName}.sha256`), 'the matching checksum should be present');
  assert.ok(!names.includes(path.basename(ancien)), 'expired archives should be pruned');
  assert.equal(statSync(path.join(backups, dumpName)).mode & 0o777, 0o600);
  assert.equal(statSync(path.join(backups, `${dumpName}.sha256`)).mode & 0o777, 0o600);
  const checksum = spawnSync('sha256sum', ['-c', `${dumpName}.sha256`], { cwd: backups, encoding: 'utf8' });
  assert.equal(checksum.status, 0, checksum.stderr);

  const shortDir = path.join(temporary, 'short');
  mkdirSync(shortDir);
  const short = spawnSync('bash', [path.join(root, 'scripts/backup-db.sh')], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, PATH: pathEnv, DATABASE_URL: 'postgresql://u:p@localhost/university',
      UNIPRESENCE_BACKUP_DIR: shortDir, FAKE_DUMP_BYTES: '128' },
  });
  assert.notEqual(short.status, 0, 'a suspiciously small dump should fail');
  assert.equal((await readdir(shortDir)).length, 0,
    'failed partial dumps should be removed');

  const remoteFailure = run({ remote: 'mock:/backup', rsyncStatus: 23 });
  for (const remote of ['/tmp/backup', 'mock:/backup with spaces']) {
    assert.equal(run({ remote }).status, 64, 'a local or malformed destination cannot be reported as offsite');
  }
  assert.equal(remoteFailure.status, 23, 'a failed remote copy should fail the backup job');
  const afterRemoteFailure = await readdir(backups);
  assert.ok(afterRemoteFailure.some(name => name.endsWith('.dump') && !name.endsWith('.dump.sha256')),
    'the verified local archive should remain available after a remote failure');

  const isolatedRoot = path.join(temporary, 'cron-project');
  const isolatedScripts = path.join(isolatedRoot, 'scripts');
  const isolatedBackend = path.join(isolatedRoot, 'backend');
  const isolatedBackups = path.join(temporary, 'cron-backups');
  const remoteLog = path.join(temporary, 'rsync-args.log');
  mkdirSync(isolatedScripts, { recursive: true });
  mkdirSync(isolatedBackend);
  mkdirSync(isolatedBackups);
  const scriptCopie = path.join(isolatedScripts, 'backup-db.sh');
  writeFileSync(scriptCopie, readFileSync(path.join(root, 'scripts/backup-db.sh')));
  chmodSync(scriptCopie, 0o700);
  writeFileSync(path.join(isolatedBackend, '.env'), [
    'DATABASE_URL="postgresql://cron-test:secret@127.0.0.1:5432/university?schema=public"',
    'UNIPRESENCE_BACKUP_REMOTE="mock:/offsite/university"',
  ].join('\n'));
  const cronRun = spawnSync('bash', [scriptCopie], {
    cwd: isolatedRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: pathEnv,
      DATABASE_URL: '',
      UNIPRESENCE_BACKUP_REMOTE: '',
      UNIPRESENCE_BACKUP_DIR: isolatedBackups,
      FAKE_RSYNC_STATUS: '0',
      FAKE_RSYNC_LOG: remoteLog,
    },
  });
  assert.equal(cronRun.status, 0, cronRun.stderr);
  assert.match(readFileSync(remoteLog, 'utf8'), /mock:\/offsite\/university\//,
    'cron mode should load the offsite destination from backend/.env without an interactive shell');

  console.log('backup-db: checksum/modes/rétention ; dumps incomplets refusés ; échec distant propagé ; destination .env chargée par cron');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
