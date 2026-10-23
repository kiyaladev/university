#!/usr/bin/env bash
#
# Restauration d'une sauvegarde University.
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
if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$RACINE/backend/.env" | head -1 | tr -d '\"'"'"'"')"
fi
DATABASE_URL="${DATABASE_URL%%\?*}"
[[ -n "$DATABASE_URL" ]] || { echo "DATABASE_URL manquante" >&2; exit 1; }
[[ "$CIBLE" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || { echo "Nom de base cible invalide" >&2; exit 64; }
BASE_SOURCE="${DATABASE_URL##*/}"
BASE_URL="${DATABASE_URL%/*}"
URL_CIBLE="${BASE_URL}/${CIBLE}"

if [[ "$CIBLE" == "$BASE_SOURCE" || "$CIBLE" == "unipresence" || "$CIBLE" == "university" ]]; then
  read -rp "Écraser la base source/exploitation « $CIBLE » ? (tapez OUI) " reponse
  [[ "$reponse" == "OUI" ]] || { echo "annulé"; exit 1; }
fi
# Une archive illisible est refusée avant toute mutation de la cible.
pg_restore --list "$FICHIER" > /dev/null

echo "→ restauration de $FICHIER vers $CIBLE"
pg_restore --exit-on-error --single-transaction --clean --if-exists --no-owner --no-privileges --dbname="$URL_CIBLE" "$FICHIER"

# Contrôle de vraisemblance : une restauration « réussie » sur une base vide
# ne vaut rien, on compte ce qui est réellement arrivé.
psql "$URL_CIBLE" --set ON_ERROR_STOP=1 -t -A -F' ' -c 'select
  (select count(*) from "Enseignant") as enseignants,
  (select count(*) from "Seance")     as seances,
  (select count(*) from "Controle")   as controles;' \
  | awk '{ printf "→ restauré : %s enseignants, %s séances, %s contrôles\n", $1, $2, $3 }'
