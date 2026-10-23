#!/usr/bin/env bash
#
# Sauvegarde quotidienne de la base University.
#
# Une base d'assiduité perdue, c'est un semestre de contrôle qui n'a jamais
# existé. Le dump est au format « custom » de pg_dump : compressé, et
# restaurable table par table avec pg_restore.
#
# Installation :  crontab -e   →   15 3 * * * /opt/apps/university/scripts/backup-db.sh >> /var/log/university-backup.log 2>&1
# Restauration :  scripts/restore-db.sh <fichier.dump> <base_cible>
#
set -euo pipefail
umask 077

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${UNIVERSITY_BACKUP_DIR:-${UNIPRESENCE_BACKUP_DIR:-$RACINE/backups}}"
KEEP="${UNIVERSITY_BACKUP_KEEP:-${UNIPRESENCE_BACKUP_KEEP:-30}}"
CONFIG="$RACINE/backend/.env"

# Les variables de sauvegarde portent le nom du produit. L'ancien nom
# UNIPRESENCE_BACKUP_* reste lu en repli, avec un avertissement : une
# installation existante continue de fonctionner, mais doit être migrée.
avertir_si_obsolete() {
  local ancien="$1" nouveau="$2" cle
  for cle in "$nouveau" "$ancien"; do
    if [[ -n "${!cle:-}" ]]; then
      if [[ "$cle" == "$ancien" ]]; then
        echo "$(date -Is) ATTENTION : $ancien est obsolète, utilisez $nouveau" >&2
      fi
      return 0
    fi
  done
}
avertir_si_obsolete UNIPRESENCE_BACKUP_DIR UNIVERSITY_BACKUP_DIR
avertir_si_obsolete UNIPRESENCE_BACKUP_KEEP UNIVERSITY_BACKUP_KEEP
avertir_si_obsolete UNIPRESENCE_BACKUP_REMOTE UNIVERSITY_BACKUP_REMOTE

# Lit une valeur dotenv sans l'évaluer comme du code shell : un cron peut ainsi
# utiliser une destination stockée dans le fichier protégé du backend.
lire_config() {
  local cle="$1" ligne valeur longueur
  [[ -f "$CONFIG" ]] || return 0
  ligne="$(grep -m1 "^${cle}=" "$CONFIG" || true)"
  [[ -n "$ligne" ]] || return 0
  valeur="${ligne#*=}"
  longueur="${#valeur}"
  if (( longueur >= 2 )); then
    if [[ "${valeur:0:1}" == '"' && "${valeur: -1}" == '"' ]] ||
       [[ "${valeur:0:1}" == "'" && "${valeur: -1}" == "'" ]]; then
      valeur="${valeur:1:longueur-2}"
    fi
  fi
  printf '%s' "$valeur"
}

# Une configuration injectée (recette, exploitation) prime sur le fichier local.
if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(lire_config DATABASE_URL)"
fi
if [[ -z "${UNIVERSITY_BACKUP_REMOTE:-}" && -z "${UNIPRESENCE_BACKUP_REMOTE:-}" ]]; then
  # Le cron n'a pas d'environnement interactif : la destination peut venir
  # du fichier protégé du backend.
  UNIVERSITY_BACKUP_REMOTE="$(lire_config UNIVERSITY_BACKUP_REMOTE)"
  if [[ -z "$UNIVERSITY_BACKUP_REMOTE" ]]; then
    UNIVERSITY_BACKUP_REMOTE="$(lire_config UNIPRESENCE_BACKUP_REMOTE)"
    if [[ -n "$UNIVERSITY_BACKUP_REMOTE" ]]; then
      echo "$(date -Is) ATTENTION : UNIPRESENCE_BACKUP_REMOTE est obsolète, utilisez UNIVERSITY_BACKUP_REMOTE" >&2
    fi
  fi
fi
DATABASE_URL="${DATABASE_URL%%\?*}"
[[ -n "$DATABASE_URL" ]] || { echo "DATABASE_URL manquante" >&2; exit 1; }
REMOTE="${UNIVERSITY_BACKUP_REMOTE:-${UNIPRESENCE_BACKUP_REMOTE:-}}"
if [[ -n "$REMOTE" ]] && ! [[ "$REMOTE" =~ ^[a-zA-Z0-9_.@-]+:/[^[:space:]]+$ ]]; then
  echo "Destination distante invalide : utilisez hôte:/dossier ou utilisateur@hôte:/dossier" >&2
  exit 64
fi
BASE="${DATABASE_URL##*/}"
[[ "$BASE" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || { echo "Nom de base invalide" >&2; exit 64; }
[[ "$KEEP" =~ ^[0-9]+$ ]] || { echo "Rétention invalide" >&2; exit 64; }

mkdir -p -m 700 "$DEST"
chmod 700 "$DEST"
# Le dossier peut préexister avec des droits trop ouverts ou contenir des
# archives créées par une ancienne version du script.
find "$DEST" -maxdepth 1 -type f -exec chmod 600 {} +
STAMP="$(date +%Y%m%d-%H%M%S-%N)"
FICHIER="$DEST/$BASE-$STAMP.dump"

TEMPORAIRE="$FICHIER.partial"
trap 'rm -f "$TEMPORAIRE"' EXIT
pg_dump --format=custom --compress=9 --file="$TEMPORAIRE" "$DATABASE_URL"

# Un dump de quelques centaines d'octets est un dump raté : mieux vaut le
# savoir maintenant que le jour de la restauration.
TAILLE="$(stat -c %s "$TEMPORAIRE")"
if (( TAILLE < 10240 )); then
  echo "$(date -Is) ERREUR : dump suspect ($TAILLE octets), conservé pour inspection" >&2
  exit 1
fi

# Vérifie que l'archive est lisible et contient bien les tables attendues.
TABLES="$(pg_restore --list "$TEMPORAIRE" | grep -c 'TABLE DATA' || true)"
if (( TABLES < 5 )); then
  echo "$(date -Is) ERREUR : seulement $TABLES tables dans le dump" >&2
  exit 1
fi

mv "$TEMPORAIRE" "$FICHIER"
(cd "$DEST" && sha256sum "$(basename "$FICHIER")") > "$FICHIER.sha256"

# La rotation ne concerne que les dumps de la base courante : les anciens
# fichiers « unipresence-* » éventuellement présents dans le même dossier
# appartiennent à l'ancienne application et ne sont ni supprimés ni
# réutilisés par ce script.
find "$DEST" \( -name "$BASE-*.dump" -o -name "$BASE-*.dump.sha256" \) -mtime "+$KEEP" -delete

# Copie hors serveur si un dépôt distant est configuré (rsync/ssh).
if [[ -n "$REMOTE" ]]; then
  # Ne supprime aucun fichier distant ; une copie échouée fait échouer la tâche.
  rsync -a --checksum "$FICHIER" "$FICHIER.sha256" "$REMOTE/"
  echo "$(date -Is) copie distante vérifiée par rsync"

fi

echo "$(date -Is) sauvegarde OK : $FICHIER ($(numfmt --to=iec "$TAILLE"), $TABLES tables)"
