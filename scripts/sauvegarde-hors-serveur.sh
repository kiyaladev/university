#!/usr/bin/env bash
#
# Copie hors serveur de la dernière sauvegarde de la base et de la clé de
# signature de l'APK.
#
# Une sauvegarde restée sur la même machine n'est pas une sauvegarde : elle
# disparaît avec le disque. La clé de signature, elle, est irremplaçable —
# Android refuse une mise à jour signée par une autre clé, donc chaque
# contrôleur devrait réinstaller l'application.
#
# Ce script copie donc, vers $UNIVERSITY_BACKUP_REMOTE :
#   • le dernier dump de la base (et son empreinte SHA-256) ;
#   • android-cle/ : le keystore et cle.properties.
#
# Il ÉCHOUE si la destination n'est pas configurée : mieux vaut une tâche
# cron en erreur qu'une sauvegarde que l'on croit hors serveur et qui ne
# l'est pas.
#
# Variables :
#   UNIVERSITY_BACKUP_DIR            dossier local des dumps (défaut : ./backups)
#   UNIVERSITY_BACKUP_REMOTE         destination rsync/SSH (obligatoire)
#   UNIVERSITY_BACKUP_GPG_PASSFILE   fichier contenant la phrase de passe gpg ;
#                                    s'il est défini, le keystore et
#                                    cle.properties sont chiffrés (AES 256)
#   UNIVERSITY_BACKUP_CLES_DIR       dossier de la clé de signature
#                                    (défaut : ./android-cle)
#
# Planification (cron) :
#   30 3 * * * /opt/apps/university/scripts/sauvegarde-hors-serveur.sh >> /var/log/university-backup.log 2>&1
#
set -euo pipefail
umask 077

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$RACINE/backend/.env"

# Lit une valeur dotenv sans l'évaluer comme du code shell.
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

# L'ancien nom UNIPRESENCE_BACKUP_* reste accepté, avec un avertissement.
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
avertir_si_obsolete UNIPRESENCE_BACKUP_REMOTE UNIVERSITY_BACKUP_REMOTE

DEST="${UNIVERSITY_BACKUP_DIR:-${UNIPRESENCE_BACKUP_DIR:-$RACINE/backups}}"
CLES="${UNIVERSITY_BACKUP_CLES_DIR:-$RACINE/android-cle}"

# --- destination : obligatoire, et hors serveur --------------------------------
REMOTE="${UNIVERSITY_BACKUP_REMOTE:-${UNIPRESENCE_BACKUP_REMOTE:-}}"
if [[ -z "$REMOTE" ]]; then
  REMOTE="$(lire_config UNIVERSITY_BACKUP_REMOTE)"
  if [[ -z "$REMOTE" ]]; then
    REMOTE="$(lire_config UNIPRESENCE_BACKUP_REMOTE)"
    if [[ -n "$REMOTE" ]]; then
      echo "$(date -Is) ATTENTION : UNIPRESENCE_BACKUP_REMOTE est obsolète, utilisez UNIVERSITY_BACKUP_REMOTE" >&2
    fi
  fi
fi
if [[ -z "$REMOTE" ]]; then
  echo "$(date -Is) ERREUR : UNIVERSITY_BACKUP_REMOTE n'est pas défini." >&2
  echo "La copie hors serveur est donc impossible : ce n'est pas une sauvegarde." >&2
  echo "Renseignez la destination (utilisateur@hôte:/dossier) dans l'environnement" >&2
  echo "du cron ou dans backend/.env — voir docs/exploitation.md." >&2
  exit 64
fi
if ! [[ "$REMOTE" =~ ^[a-zA-Z0-9_.@-]+:/[^[:space:]]+$ ]]; then
  echo "$(date -Is) ERREUR : destination distante invalide ($REMOTE)." >&2
  echo "Le format attendu est utilisateur@hôte:/dossier (un chemin local n'est" >&2
  echo "pas une sauvegarde hors serveur)." >&2
  exit 64
fi

# --- dernier dump local --------------------------------------------------------
BASE="university"
if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(lire_config DATABASE_URL)"
fi
if [[ -n "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="${DATABASE_URL%%\?*}"
  base_candidate="${DATABASE_URL##*/}"
  if [[ "$base_candidate" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
    BASE="$base_candidate"
  fi
fi

DERNIER="$(ls -1t "$DEST"/"$BASE"-*.dump 2>/dev/null | head -n 1 || true)"
if [[ -z "$DERNIER" ]]; then
  echo "$(date -Is) ERREUR : aucun dump « $BASE-*.dump » dans $DEST." >&2
  echo "Lancez scripts/backup-db.sh avant cette copie." >&2
  exit 66
fi
[[ -f "$DERNIER" ]] || { echo "$(date -Is) ERREUR : dump illisible : $DERNIER" >&2; exit 66; }

# --- clé de signature : obligatoire --------------------------------------------
if [[ ! -d "$CLES" ]]; then
  echo "$(date -Is) ERREUR : clé de signature absente ($CLES)." >&2
  echo "Sans elle, aucune mise à jour de l'application installée n'est possible." >&2
  echo "Renseignez UNIVERSITY_BACKUP_CLES_DIR si la clé vit ailleurs." >&2
  exit 66
fi

# Le keystore peut être nommé par le fichier de propriétés ; on le prend
# aussi par extension, pour ne rater aucune clé.
KEYSTORES=()
while IFS= read -r fichier; do
  [[ -n "$fichier" ]] && KEYSTORES+=("$fichier")
done < <(find "$CLES" -maxdepth 1 -type f \( -name "*.keystore" -o -name "*.jks" -o -name "*.p12" \) | sort)
STORE_FILE="$(sed -n 's/^storeFile=//p' "$CLES/cle.properties" 2>/dev/null | head -n 1 || true)"
if [[ -n "$STORE_FILE" && -f "$STORE_FILE" ]]; then
  deja_present=0
  for k in "${KEYSTORES[@]:-}"; do
    [[ "$k" == "$STORE_FILE" ]] && deja_present=1
  done
  if (( ! deja_present )); then
    KEYSTORES+=("$STORE_FILE")
  fi
fi
if (( ${#KEYSTORES[@]} == 0 )); then
  echo "$(date -Is) ERREUR : aucun keystore dans $CLES." >&2
  echo "La clé de signature n'a pas été trouvée : rien ne peut être sauvegardé." >&2
  exit 66
fi

# --- chiffrement éventuel du keystore ------------------------------------------
# La phrase de passe n'est jamais sur la ligne de commande : elle vit dans un
# fichier lisible par le seul compte qui lance la tâche.
PASSEFILE="${UNIVERSITY_BACKUP_GPG_PASSFILE:-}"
chiffrer=false
if [[ -n "$PASSEFILE" ]]; then
  if [[ ! -r "$PASSEFILE" ]]; then
    echo "$(date -Is) ERREUR : UNIVERSITY_BACKUP_GPG_PASSFILE illisible ($PASSEFILE)." >&2
    exit 66
  fi
  command -v gpg >/dev/null 2>&1 || {
    echo "$(date -Is) ERREUR : gpg est absent : le keystore ne peut pas être chiffré." >&2
    exit 69
  }
  chiffrer=true
fi

PREPARATION="$(mktemp -d)"
trap 'rm -rf "$PREPARATION"' EXIT

A_ENVOYER=()
for source in "$DERNIER" "$DERNIER.sha256"; do
  [[ -f "$source" ]] || continue
  A_ENVOYER+=("$source")
done

A_ENVOYER_CLES=()
for cle in "$CLES/cle.properties" "${KEYSTORES[@]}"; do
  [[ -f "$cle" ]] || continue
  if [[ "$chiffrer" == true ]]; then
    destination="$PREPARATION/$(basename "$cle").gpg"
    gpg --batch --yes --quiet --passphrase-file "$PASSEFILE" \
      --symmetric --cipher-algo AES256 --output "$destination" "$cle"
    A_ENVOYER_CLES+=("$destination")
  else
    A_ENVOYER_CLES+=("$cle")
  fi
done

if (( ${#A_ENVOYER[@]} == 0 || ${#A_ENVOYER_CLES[@]} == 0 )); then
  echo "$(date -Is) ERREUR : rien à copier." >&2
  exit 66
fi

# --- copie vérifiée ------------------------------------------------------------
# rsync ne supprime rien sur la destination : une copie échouée doit faire
# échouer la tâche, pas laisser croire à une sauvegarde.
rsync -a --checksum "${A_ENVOYER[@]}" "$REMOTE/"
rsync -a --checksum "${A_ENVOYER_CLES[@]}" "$REMOTE/android-cle/"

echo "$(date -Is) copie hors serveur vérifiée par rsync : $(basename "$DERNIER"), cle.properties et $((${#KEYSTORES[@]})) keystore(s) vers $REMOTE"
if [[ "$chiffrer" == true ]]; then
  echo "$(date -Is) keystore et cle.properties chiffrés en AES 256 (gpg symétrique)"
fi
exit 0
