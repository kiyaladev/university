#!/usr/bin/env bash
#
# Restauration d'une sauvegarde UniPrésence.
#
# Une sauvegarde qu'on n'a jamais restaurée n'existe pas. Ce script sert
# aussi bien à l'exercice de restauration (sur une base jetable) qu'au vrai
# incident.
#
#   scripts/restore-db.sh backups/unipresence-20260814-031500.dump unipresence_test
#
# La base cible est TOUJOURS explicite : on ne peut pas écraser la production
# par distraction, il faut nommer « unipresence » soi-même.
#
set -euo pipefail

FICHIER="${1:-}"
CIBLE="${2:-}"

if [[ -z "$FICHIER" || -z "$CIBLE" ]]; then
  echo "usage: $0 <fichier.dump> <base_cible>" >&2
  exit 64
fi
[[ -f "$FICHIER" ]] || { echo "fichier introuvable : $FICHIER" >&2; exit 66; }

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$RACINE/backend/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
DATABASE_URL="${DATABASE_URL%%\?*}"
BASE_URL="${DATABASE_URL%/*}"          # postgresql://user:pass@hote:port
URL_CIBLE="${BASE_URL}/${CIBLE}"

if [[ "$CIBLE" == "unipresence" ]]; then
  read -rp "Restaurer sur la base de PRODUCTION « unipresence » ? (tapez OUI) " reponse
  [[ "$reponse" == "OUI" ]] || { echo "annulé"; exit 1; }
fi

echo "→ restauration de $FICHIER vers $CIBLE"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$URL_CIBLE" "$FICHIER"

# Contrôle de vraisemblance : une restauration « réussie » sur une base vide
# ne vaut rien, on compte ce qui est réellement arrivé.
psql "$URL_CIBLE" -t -A -F' ' -c 'select
  (select count(*) from "Enseignant") as enseignants,
  (select count(*) from "Seance")     as seances,
  (select count(*) from "Controle")   as controles;' \
  | awk '{ printf "→ restauré : %s enseignants, %s séances, %s contrôles\n", $1, $2, $3 }'
