#!/usr/bin/env bash
#
# Sauvegarde quotidienne de la base UniPrésence.
#
# Une base d'assiduité perdue, c'est un semestre de contrôle qui n'a jamais
# existé. Le dump est au format « custom » de pg_dump : compressé, et
# restaurable table par table avec pg_restore.
#
# Installation :  crontab -e   →   15 3 * * * /opt/apps/unipresence/scripts/backup-db.sh >> /var/log/unipresence-backup.log 2>&1
# Restauration :  scripts/restore-db.sh <fichier.dump> <base_cible>
#
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${UNIPRESENCE_BACKUP_DIR:-$RACINE/backups}"
KEEP="${UNIPRESENCE_BACKUP_KEEP:-30}"

# L'URL vit dans le .env du backend : une seule source de vérité, pas de
# mot de passe recopié dans un script.
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$RACINE/backend/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
DATABASE_URL="${DATABASE_URL%%\?*}"   # pg_dump refuse ?schema=public, propre à Prisma
if [[ -z "$DATABASE_URL" ]]; then
  echo "$(date -Is) ERREUR : DATABASE_URL introuvable dans backend/.env" >&2
  exit 1
fi

mkdir -p "$DEST"
STAMP="$(date +%Y%m%d-%H%M%S)"
FICHIER="$DEST/unipresence-$STAMP.dump"

pg_dump --format=custom --compress=9 --file="$FICHIER" "$DATABASE_URL"

# Un dump de quelques centaines d'octets est un dump raté : mieux vaut le
# savoir maintenant que le jour de la restauration.
TAILLE="$(stat -c %s "$FICHIER")"
if (( TAILLE < 10240 )); then
  echo "$(date -Is) ERREUR : dump suspect ($TAILLE octets), conservé pour inspection" >&2
  exit 1
fi

# Vérifie que l'archive est lisible et contient bien les tables attendues.
TABLES="$(pg_restore --list "$FICHIER" | grep -c 'TABLE DATA' || true)"
if (( TABLES < 5 )); then
  echo "$(date -Is) ERREUR : seulement $TABLES tables dans le dump" >&2
  exit 1
fi

find "$DEST" -name 'unipresence-*.dump' -mtime "+$KEEP" -delete

# Copie hors serveur si un dépôt distant est configuré (rsync/ssh).
if [[ -n "${UNIPRESENCE_BACKUP_REMOTE:-}" ]]; then
  rsync -a --delete "$DEST/" "$UNIPRESENCE_BACKUP_REMOTE/" \
    && echo "$(date -Is) copie distante vers $UNIPRESENCE_BACKUP_REMOTE" \
    || echo "$(date -Is) ATTENTION : copie distante échouée" >&2
fi

echo "$(date -Is) sauvegarde OK : $FICHIER ($(numfmt --to=iec "$TAILLE"), $TABLES tables)"
