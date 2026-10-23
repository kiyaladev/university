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

# --- numéro de version : incrément automatique -------------------------------
# Android n'accepte une mise à jour que si le versionCode de l'APK est
# supérieur à celui de l'application installée. Le numéro ne doit donc pas
# dépendre de l'oubli de le changer à la main :
#
#   versionCode = max(versionCode du dépôt + 1, date du jour, dernier publié + 1)
#
# Le dernier numéro publié est mémorisé hors du dépôt (android-cle/version-code.txt),
# car le dépôt est réinitialisé entre deux publications. La clé de signature
# n'est pas touchée : la signature ne dépend pas du numéro de version.
GRADLE="$RACINE/frontend/src-capacitor/android/app/build.gradle"
COMPTEUR_VERSION="$RACINE/android-cle/version-code.txt"
SAUVEGARDE_GRADLE=""

restaurer_gradle() {
  if [[ -n "$SAUVEGARDE_GRADLE" && -f "$SAUVEGARDE_GRADLE" ]]; then
    cp "$SAUVEGARDE_GRADLE" "$GRADLE"
    rm -f "$SAUVEGARDE_GRADLE"
  fi
}
trap restaurer_gradle EXIT

COURANT="$(sed -n 's/^[[:space:]]*versionCode[[:space:]][[:space:]]*\([0-9]\+\).*/\1/p' "$GRADLE" | head -n 1)"
[[ "$COURANT" =~ ^[0-9]+$ ]] || COURANT=0
PRECEDENT=0
if [[ -f "$COMPTEUR_VERSION" ]]; then
  PRECEDENT="$(tr -dc '0-9' < "$COMPTEUR_VERSION" || true)"
  [[ "$PRECEDENT" =~ ^[0-9]+$ ]] || PRECEDENT=0
fi
DATE_CODE="$(date +%Y%m%d)"
VERSION_CODE=$(( COURANT + 1 ))
if (( DATE_CODE > VERSION_CODE )); then
  VERSION_CODE="$DATE_CODE"
fi
if (( PRECEDENT + 1 > VERSION_CODE )); then
  VERSION_CODE=$(( PRECEDENT + 1 ))
fi
VERSION_NAME="$(date +%Y.%m.%d)"

# Le fichier gradle est modifié le temps du build, puis restauré : le dépôt
# reste propre, seule la publication compte.
SAUVEGARDE_GRADLE="$(mktemp)"
cp "$GRADLE" "$SAUVEGARDE_GRADLE"
sed -i -E "s|^([[:space:]]*)versionCode[[:space:]]+[0-9]+[[:space:]]*$|\1versionCode $VERSION_CODE|; s|^([[:space:]]*)versionName[[:space:]]+\"[^\"]*\"[[:space:]]*$|\1versionName \"$VERSION_NAME\"|" "$GRADLE"
echo "→ versionCode $VERSION_CODE (version $VERSION_NAME)"

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

# Le numéro de version publié est vérifié : Android refuse d'installer par
# par-dessus une application dont le versionCode n'a pas augmenté.
VERSION_PUBLIEE="$("$BUILD_TOOLS"/aapt2 dump badging "$APK" | sed -n "s/.*versionCode='\([0-9]\+\)'.*/\1/p" | head -n 1)"
if [[ "$VERSION_PUBLIEE" != "$VERSION_CODE" ]]; then
  echo "ERREUR : l'APK porte le versionCode $VERSION_PUBLIEE au lieu de $VERSION_CODE." >&2
  echo "Une mise à jour par-dessus l'application installée serait refusée." >&2
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

# La publication est vérifiée : le seul fichier téléchargeable doit être
# university.apk, et l'URL annoncée doit pointer dessus.
if [[ ! -f "$RACINE/telechargement/university.apk" ]]; then
  echo "ERREUR : telechargement/university.apk est absent après publication." >&2
  exit 1
fi
if [[ -f "$ANCIEN" ]]; then
  echo "ERREUR : telechargement/unipresence.apk est toujours présent." >&2
  exit 1
fi

# Le compteur n'avance qu'après une publication vérifiée : une compilation
# interrompue ne doit pas « brûler » un numéro.
printf '%s\n' "$VERSION_CODE" > "$COMPTEUR_VERSION"
chmod 600 "$COMPTEUR_VERSION"

TAILLE="$(stat -c %s "$RACINE/telechargement/university.apk")"
echo "→ publié : https://university.naimba.com/telechargement/university.apk ($(numfmt --to=iec "$TAILLE"), versionCode $VERSION_CODE, version $VERSION_NAME)"
