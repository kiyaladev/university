#!/usr/bin/env bash
#
# Fabrique l'APK Android d'UniPrésence et le publie au téléchargement.
#
#   scripts/apk.sh            → APK signé (release), publié
#   scripts/apk.sh debug      → APK de débogage, non publié
#
# La clé de signature vit dans /opt/apps/unipresence/android-cle/, hors du
# dépôt. La perdre interdit toute mise à jour de l'application déjà installée :
# Android refuse une mise à jour signée par une autre clé.
#
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VARIANTE="${1:-release}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export API_URL="${API_URL:-https://presence-api.naimba.com/api}"

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

(cd src-capacitor/android && ./gradlew assembleRelease -q)

APK="src-capacitor/android/app/build/outputs/apk/release/app-release.apk"
"$ANDROID_HOME"/build-tools/35.0.0/apksigner verify "$APK"

mkdir -p "$RACINE/telechargement"
cp "$APK" "$RACINE/telechargement/unipresence.apk"

TAILLE="$(stat -c %s "$RACINE/telechargement/unipresence.apk")"
echo "→ publié : https://presence.naimba.com/telechargement/unipresence.apk ($(numfmt --to=iec "$TAILLE"))"
