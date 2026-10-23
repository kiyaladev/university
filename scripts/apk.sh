#!/usr/bin/env bash
#
# Fabrique l'APK Android d'University et le publie au téléchargement.
#
#   scripts/apk.sh            → APK signé (release), publié
#   scripts/apk.sh debug      → APK de débogage, non publié
#
# La clé de signature vit dans /opt/apps/university/android-cle/, hors du
# dépôt. La perdre interdit toute mise à jour de l'application déjà installée :
# Android refuse une mise à jour signée par une autre clé.
#
# L'identifiant de l'application est gn.university.controle : il est distinct
# de celui de l'application UniPrésence (/opt/apps/unipresence), pour que les
# deux puissent coexister sur le même téléphone. La clé, elle, peut être la
# même — une même clé signe des applications d'identifiants différents.
#
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VARIANTE="${1:-release}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export API_URL="${API_URL:-https://university-api.naimba.com/api}"

APPLICATION_ID="gn.university.controle"
BUILD_TOOLS="$ANDROID_HOME/build-tools/35.0.0"

cd "$RACINE/frontend"

echo "→ construction de l'interface (API : $API_URL)"
bunx quasar build -m capacitor -T android --skip-pkg >/dev/null

echo "→ synchronisation Capacitor"
(cd src-capacitor && bunx cap sync android >/dev/null)

echo "sdk.dir=$ANDROID_HOME" > src-capacitor/android/local.properties

if [[ "$VARIANTE" == "debug" ]]; then
  (cd src-capacitor/android && ./gradlew assembleDebug -q)
  echo "APK de débogage : src-capacitor/android/app/build/outputs/apk/debug/app-debug.apk"
  exit 0
fi

if [[ ! -f "$RACINE/android-cle/cle.properties" ]]; then
  echo "ERREUR : clé de signature absente (android-cle/cle.properties)." >&2
  echo "Sans elle, l'APK serait signé avec la clé de débogage et ne pourrait" >&2
  echo "pas mettre à jour les installations existantes." >&2
  exit 1
fi

# La clé doit vivre dans ce projet, pas dans celui d'UniPrésence : le build
# échouerait le jour où l'autre application disparaît. On lit le chemin du
# keystore (jamais les mots de passe) pour le signaler.
STORE_FILE="$(sed -n 's/^storeFile=//p' "$RACINE/android-cle/cle.properties" | head -n 1)"
if [[ -n "$STORE_FILE" && "$STORE_FILE" != "$RACINE/android-cle/"* ]]; then
  echo "ATTENTION : la clé est lue dans $STORE_FILE, hors de ce projet." >&2
  echo "Pour la garder ici :" >&2
  echo "  cp $STORE_FILE $RACINE/android-cle/" >&2
  echo "  sed -i 's#^storeFile=.*#storeFile=$RACINE/android-cle/$(basename "$STORE_FILE")#' $RACINE/android-cle/cle.properties" >&2
fi

(cd src-capacitor/android && ./gradlew assembleRelease -q)

APK="src-capacitor/android/app/build/outputs/apk/release/app-release.apk"
"$BUILD_TOOLS"/apksigner verify "$APK"

# L'identifiant porté par l'APK est vérifié avant publication : avec
# l'identifiant d'UniPrésence, l'installation remplacerait UniPrésence sur le
# téléphone du contrôleur au lieu d'ajouter University à côté.
IDENTITE="$("$BUILD_TOOLS"/aapt2 dump packagename "$APK")"
if [[ "$IDENTITE" != "$APPLICATION_ID" ]]; then
  echo "ERREUR : l'APK porte l'identifiant « $IDENTITE » au lieu de « $APPLICATION_ID »." >&2
  echo "Il remplacerait l'application UniPrésence sur le téléphone." >&2
  exit 1
fi

mkdir -p "$RACINE/telechargement"
cp "$APK" "$RACINE/telechargement/university.apk"

# L'ancien APK porte l'identifiant d'UniPrésence : il doit disparaître du
# téléchargement, sinon c'est lui que l'on installerait sur un téléphone.
ANCIEN="$RACINE/telechargement/unipresence.apk"
if [[ -f "$ANCIEN" ]]; then
  rm -f "$ANCIEN"
  echo "→ retiré : telechargement/unipresence.apk (ancien identifiant UniPrésence)"
fi

TAILLE="$(stat -c %s "$RACINE/telechargement/university.apk")"
echo "→ publié : https://university.naimba.com/telechargement/university.apk ($(numfmt --to=iec "$TAILLE"))"
