---
name: UniPrésence
description: Le registre de contrôle des séances comme panneau d'emploi du temps peint à la main.
# Valeurs alignées sur `frontend/src/css/quasar.variables.scss`, seule source
# appliquée à l'exécution : le document annonçait quatre teintes que le code
# n'employait pas (outremer notamment, jamais présent dans le code).
colors:
  encre: "#10251E"
  encre-douce: "#33463F"
  chaux: "#E4E6DE"
  plaque: "#F2F3EE"
  craie: "#FAFAF7"
  vert-peint: "#0F7A45"
  vert-clair: "#3E9E6C"
  jaune-signal: "#EFB700"
  ocre: "#C98A00"
  minium: "#C4122E"
  minium-clair: "#E0574F"
  encre-nuit: "#0D1F18"
  encre-sombre: "#12291F"
typography:
  display:
    fontFamily: "Anton, 'Archivo Variable', sans-serif"
    fontSize: "clamp(2.6rem, 2rem + 3.6vw, 4rem)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Anton, 'Archivo Variable', sans-serif"
    fontSize: "clamp(1.5rem, 1.1rem + 1.6vw, 2.1rem)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "0.01em"
  title:
    fontFamily: "Anton, 'Archivo Variable', sans-serif"
    fontSize: "1.22rem"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "0.01em"
  body:
    fontFamily: "'Archivo Variable', Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "'Archivo Variable', Archivo, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.09em"
  chiffres:
    fontFamily: "'Archivo Variable', Archivo, sans-serif"
    fontSize: "inherit"
    fontWeight: 700
    fontFeature: "'tnum' 1"
rounded:
  aucun: "0"
spacing:
  up-1: "4px"
  up-2: "8px"
  up-3: "14px"
  up-4: "22px"
  up-5: "34px"
  up-6: "52px"
components:
  plaque:
    backgroundColor: "{colors.plaque}"
    textColor: "{colors.encre}"
    rounded: "{rounded.aucun}"
  champ-present:
    backgroundColor: "{colors.vert-peint}"
    textColor: "#FFFFFF"
    rounded: "{rounded.aucun}"
  champ-retard:
    backgroundColor: "{colors.jaune-signal}"
    textColor: "{colors.encre}"
    rounded: "{rounded.aucun}"
  champ-absent:
    backgroundColor: "{colors.minium}"
    textColor: "#FFFFFF"
    rounded: "{rounded.aucun}"
  champ-excuse:
    backgroundColor: "{colors.minium-clair}"
    textColor: "#FFFFFF"
    rounded: "{rounded.aucun}"
  champ-remplace:
    backgroundColor: "{colors.vert-clair}"
    textColor: "#FFFFFF"
    rounded: "{rounded.aucun}"
  champ-attente:
    backgroundColor: "transparent"
    textColor: "{colors.encre-douce}"
    rounded: "{rounded.aucun}"
  button-primary:
    backgroundColor: "{colors.encre}"
    textColor: "#FFFFFF"
    rounded: "{rounded.aucun}"
    typography: "{typography.body}"
    height: "48px"
  button-disabled:
    backgroundColor: "#CDD0C8"
    textColor: "rgba(16, 37, 30, 0.55)"
    rounded: "{rounded.aucun}"
  input-outlined:
    backgroundColor: "{colors.craie}"
    textColor: "{colors.encre}"
    rounded: "{rounded.aucun}"
    height: "48px"
  chip:
    backgroundColor: "{colors.plaque}"
    textColor: "{colors.encre}"
    rounded: "{rounded.aucun}"
    typography: "{typography.label}"
    padding: "4px 8px"
    height: "24px"
  bandeau:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.craie}"
    rounded: "{rounded.aucun}"
    padding: "22px 14px 0"
  table-header:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.craie}"
    typography: "{typography.label}"
    rounded: "{rounded.aucun}"
  tab-active:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.craie}"
    rounded: "{rounded.aucun}"
---

# Design System: UniPrésence

## Overview

**Creative North Star: « Le panneau peint »**

L'application est un panneau d'emploi du temps peint à la main, pas un tableau de bord. Le monde vient des couloirs de faculté où l'horaire est peint sur un mur chaulé, et de la signalétique émaillée des gares routières ouest-africaines : aplats saturés tracés à la règle, filets d'encre épais, angles vifs, aucune ombre portée. Chaque surface est une plaque ; chaque statut est un champ peint sur toute la hauteur de la plaque, jamais une pastille posée sur du blanc.

La densité est celle d'un registre de terrain : le contrôleur travaille debout, une main occupée, sur un téléphone d'entrée de gamme en plein soleil. Rien ne décore. Une couleur qui apparaît porte un statut de séance ou une action ; un chiffre géant est un chiffre que quelqu'un cherche en levant les yeux. Le seul geste animé du monde est le balayage de 260 ms qui peint le champ au moment où le pointage est accepté.

Refus explicites portés par le code : la carte arrondie à ombre douce, le bandeau coloré en bordure gauche, les fonds pastel de la palette Material, les dégradés CSS comme matière. Là où une texture est nécessaire, elle vient d'un fichier dessiné pour ça (`public/matiere/email-panneau.svg`, grain de brosse + usure d'émail), posé deux fois à deux échelles.

**Key Characteristics:**
- Angles vifs partout : tous les rayons Quasar sont ramenés à 0.
- Aucune ombre portée : les `box-shadow` de Quasar sont neutralisés ; la seule ombre du monde est un liséré intérieur clair de 1 px sur les champs peints.
- Filets tracés à la règle : filet épais 2 px d'encre, filet fin 1 px à 38 % pour les subdivisions.
- Lettrage Anton en capitales pour les mots, Archivo à chiffres tabulaires pour les grandeurs.
- Palette de peintures, non de teintes : cinq peintures, une par statut, plus l'encre et la chaux.
- Cibles tactiles minimales de 48 px sous 600 px de large.

## Colors

Une palette de peintures d'atelier : deux neutres (mur chaulé, encre vert-noir) et cinq aplats saturés dont chacun porte un statut ou une action, jamais une humeur.

### Primary
- **Encre** (#10251E) : la couleur de l'action. Elle peint tout ce sur quoi on appuie — le champ « Pointer » vierge d'une plaque non contrôlée, le bouton de soumission, le bloc d'heure d'une séance en cours, la bordure de focus des champs de saisie et l'anneau `:focus-visible` (3 px, en retrait). L'action ne prend aucune des trois peintures du drapeau : si elle le faisait, on ne distinguerait plus « à faire » de « fait ».

### Secondary — les trois peintures, réservées aux états
- **Vert peinture** (#0F7A45) : la séance assurée. Champ de statut « Présent », jauge de taux de contrôle remplie, cachet de tournée complète.
- **Jaune signal** (#EFB700) : le retard et l'attente. Texte en encre, jamais en blanc.
- **Minium** (#C4122E) : l'absence. Champ « Absent », filet et texte des notes d'erreur, bordure des champs de saisie en erreur.

Chaque peinture n'a qu'une variante, nuance de la même famille et jamais une quatrième teinte : **vert clair** (#3E9E6C) pour la séance assurée par un remplaçant, **ocre** (#C98A00) pour le départ anticipé, **minium clair** (#E0574F) pour l'absence excusée — excusée ou non, une absence reste une absence, elle garde donc la famille du rouge.

### Tertiary
- **Ocre** (#C98A00) : le départ anticipé et le filet des notes d'avertissement. Porteur d'encre en texte ; en blanc, réservé aux libellés en capitales de 11 px gras, jamais au corps de texte.

### Neutral
- **Encre vert-noir** (#10251E) : le trait du monde. Tout le texte courant, tous les filets, le fond du bandeau de tournée, l'en-tête des registres, l'onglet actif, l'élément de navigation actif, la barre de défilement des registres. C'est aussi la `theme-color` du document.
- **Encre douce** (#33463F) : le seul registre de texte secondaire. Les gris Material (`text-grey-5` à `text-grey-8`) sont redirigés vers cette valeur, parce que le gris de la librairie tombait sous le seuil de contraste en plein jour. Encre douce sur plaque : 9,02:1.
- **Chaux** (#E4E6DE) : le mur du panneau, fond de page.
- **Plaque** (#F2F3EE) : la surface de toute carte, de tout tiroir, de tout groupe d'onglets. Encre sur plaque : 14,42:1.
- **Craie** (#FAFAF7) : l'intérieur des champs de saisie et le fond des notes ; le texte posé sur l'encre.
- **Encre de nuit** (#0D1F18) : fond du thème sombre ; en sombre, encre et craie s'échangent et les filets passent en craie.

### Named Rules
**La règle des deux palettes.** `framework.config.brand` dans `quasar.config.ts` surcharge les variables Sass à l'exécution. Les deux listes doivent porter exactement les mêmes hexadécimaux : toute peinture ajoutée ou modifiée dans `quasar.variables.scss` se réplique dans `brand`, sinon deux palettes se disputent l'interface.

**La règle du sans-pastel.** Aucune classe utilitaire de teinte Material (`bg-red-1`, `text-blue-2`, `bg-grey-3`) n'entre dans ce monde. Une note porte sa couleur sur son filet et son texte, sur fond de craie : `.note--valide`, `.note--info`, `.note--alerte`, `.note--erreur`.

**La règle du statut peint.** Un statut se rend en aplat plein sur toute la hauteur de son conteneur (`.champ--*`), cerné du filet d'encre. Jamais une pastille colorée posée sur du blanc, jamais un point de couleur devant un libellé.

## Typography

**Display Font:** Anton (avec Archivo Variable en secours) — embarquée dans le bundle via `@fontsource/anton`, aucun appel réseau au chargement.
**Body Font:** Archivo Variable (avec Archivo, Helvetica Neue, Arial) — `@fontsource-variable/archivo`, axe `wdth` réglé à 100.

**Character:** Anton est le pinceau du peintre d'enseignes : une seule graisse, très large, en capitales, tracée d'un geste. Archivo tient le corps du registre : neutre, robuste, à chiffres tabulaires pour que les colonnes d'heures s'alignent.

### Hierarchy
- **Display** (Anton 400, clamp 2,6→4 rem, interligne 1) : le chiffre qui commande la tournée — combien de salles restent à visiter. Un seul par écran.
- **Headline** (Anton 400, clamp 1,5→2,1 rem) : titres de page (`.page-titre`), jour de la tournée, marque sur l'écran d'accès (jusqu'à 5,2 rem sur l'enseigne de connexion).
- **Title** (Anton 400, 1,22 rem) : titres de fiches et de dialogues ; `.text-h6` hérite directement du lettrage.
- **Body** (Archivo 400, 15 px) : corps du registre. Les paragraphes explicatifs sont bridés à 72ch (`.page-sous-titre`), l'accroche de l'écran d'accès à 46ch.
- **Label / Pochoir** (Archivo 700, 11 px, interlettrage 0,09em, capitales) : mentions peintes au pochoir — libellés de champs, en-têtes de registre, étiquettes, plaques de salle, sous-actions.

### Named Rules
**La règle de l'unité en minuscule.** Le lettrage crie les mots, pas les grandeurs. Un nombre porteur d'unité prend `.lettrage.avec-unite` pour garder « 85,3 h » et non « 85,3 H ». De même, une mention au pochoir contenant une heure ou une durée prend `.pochoir--brut` (casse d'origine, interlettrage réduit).

**La règle des chiffres alignés.** Toute grandeur, heure ou compteur porte `.chiffres` (`tabular-nums` + `tnum`), pour que les colonnes ne dansent pas d'une ligne à l'autre.

**La règle du français écrit.** Les nombres, heures et pourcentages passent par `nombreLisible`, `heuresLisibles`, `pourcentLisible` de `src/utils/libelles.ts` ; les dates passent par le composant `ChampDate`, jamais par un `type="date"` natif qui affiche MM/JJ/AAAA hors locale française. L'interlignage du lettrage est fixé à 1,06 pour que les accents (É, Û) ne soient jamais rognés.

## Layout

Le rythme d'espacement est unique et à six pas : 4, 8, 14, 22, 34, 52 px (`--up-1` à `--up-6`). Aucune valeur d'espacement hors de cette échelle n'est reprise ailleurs qu'en ajustement optique local (2 à 6 px sur une marge de texte).

La surface maîtresse — la tournée — s'organise en trois régions horizontales : bandeau d'encre en haut (date, reste à pointer), barre de tri repliée, puis la pile de plaques. Chaque plaque est une grille de trois colonnes : champ d'heure peint à gauche (88 px), identité au centre (`minmax(0, 1fr)`), champ d'action ou de statut à droite (116 px) sur toute la hauteur — la cible du pouce. Hauteur minimale de plaque : 104 px.

Trois seuils responsives, tous exprimés en largeur maximale de contenu plutôt qu'en étirement :
- **≤ 599 px (téléphone)** : la plaque passe à deux colonnes, le champ d'action bascule sous le corps sur toute la largeur (56 px de haut minimum), les boutons prennent 48 px, les items de liste 52 px, les champs de saisie 48 px.
- **≤ 767 px** : un registre large se rend en pile de plaques plutôt qu'en tableau (voir `MesSeancesPage.vue`) ; quand un tableau subsiste, ses cellules restent sur une ligne et s'élident à 42vw.
- **≥ 1024 px** : le panneau passe à deux colonnes de plaques, plafonné à 1180 px, avec un retrait latéral de 22 px. Le panneau ne s'étire jamais sur toute la largeur d'un écran de bureau.

Les registres qui débordent défilent horizontalement et le disent : la barre de défilement est une réglette d'encre de 11 px sur rail teinté, visible quelle que soit la couleur des lignes.

## Elevation & Depth

**Ce monde n'a aucune ombre portée.** `box-shadow: none !important` est appliqué aux cartes et aux boutons Quasar ; les conteneurs de tableau perdent la leur. La profondeur se lit à trois choses seulement : le filet (2 px d'encre) qui cerne une plaque, l'aplat de peinture qui distingue un champ de son support, et la matière (grain de brosse + usure d'émail) posée sur les surfaces peintes.

L'appui ne s'enfonce pas : un bouton actionné s'assombrit (`filter: brightness(0.88)`), comme une plaque qu'on touche au soleil ; un champ d'action survolé s'éclaircit (`brightness(1.08)`).

### Shadow Vocabulary
- **Liséré d'émail** (`box-shadow: inset 0 0 0 1px rgba(255,255,255,0.28)`) : seule ombre du système, portée par `.champ`. C'est la double règle claire en retrait des plaques émaillées, pas une élévation.

### Named Rules
**La règle du grain sans position.** Le mixin `grain($intensite)` empile deux passages de `--up-matiere` à 320 px et 780 px, en modes de fusion. Il ne pose jamais `position: relative` et n'utilise aucun pseudo-élément : un positionnement forcé ici casse l'en-tête fixe de Quasar. La matière vient du SVG dessiné, jamais d'un dégradé CSS.

## Shapes

Rayon zéro, sans exception : `$generic-border-radius`, `$button-border-radius`, `$chip-border-radius` et `$card-border-radius` valent tous 0, et les surcharges reprennent `border-radius: 0` sur cartes, boutons, champs, étiquettes, onglets, items, notes, barres de progression et infobulles Chart.js. La peinture suit la règle.

Deux épaisseurs de trait, et deux seulement : le **filet** (`2px solid` encre) sépare les régions, cerne les plaques, sépare le champ d'action de son corps ; le **filet fin** (`1px` encre à 38 %) subdivise à l'intérieur d'une région — lignes de registre, liens du tiroir, onglets voisins. Un troisième poids de 3 px marque deux seuils structurels seulement : le bas de l'en-tête et le pied collant d'une fiche de pointage.

Les formes récurrentes du monde : la **plaque** (rectangle de chaux claire cerné d'un filet), le **champ** (aplat de peinture pleine hauteur, texte centré), la **plaque de salle** (rectangle de 2 px d'encre autour d'un code au pochoir), la **bande** (quatre aplats de peinture juxtaposés en enseigne). Une séance annulée est hachurée à 45° plutôt que grisée.

## Components

### Buttons
- **Shape:** angle vif (rayon 0), sans ombre, capitales non forcées (`text-transform: none`), graisse 700, interlettrage 0,04em.
- **Primary:** aplat d'encre, texte craie, hauteur minimale 48 px sur téléphone (56 px pour le bouton d'accès plein largeur).
- **Appui / survol:** assombrissement à 88 % de luminosité à l'appui ; pas de relief, pas d'élévation, pas de transformation.
- **Outline:** trait de 2 px, angle vif.
- **Désactivé:** opacité pleine mais peinture retirée — fond gris chaux (#CDD0C8) et texte d'encre à 55 %. Un bouton inerte doit se voir inerte, pas se voir translucide.

### Chips
- **Style:** plaquette peinte de 24 px de haut, angle vif, 11 px en capitales grasses, remplissage 4/8 px. Pas de pastille arrondie.

### Cards / Containers
- **Corner Style:** angle vif.
- **Background:** chaux claire (`plaque`).
- **Shadow Strategy:** aucune ; voir Elevation & Depth.
- **Border:** filet d'encre de 2 px sur les cartes bordées et sur toute carte de dialogue.
- **Internal Padding:** 14 px (`--up-3`) par défaut, 22 px pour un en-tête de fiche.

### Inputs / Fields
- **Style:** fond de craie, contour de 2 px à 34 % d'encre, angle vif ; libellé en pochoir 11 px capitales grasses.
- **Focus:** le contour passe en encre pleine, 2 px. Aucun halo.
- **Erreur:** contour minium 2 px.
- **Sombre:** fond blanc à 6 %, contour craie à 38 %.
- **Cibles:** 48 px de hauteur minimale sous 600 px.

### Navigation
- **En-tête:** bandeau d'encre grainé, filet de 3 px en bas, marque en lettrage Anton, titre de page au pochoir séparé par un filet clair.
- **Tiroir:** fond de plaque, filet de 2 px à droite, titres de groupe en pochoir sur encre douce, liens à 600 de graisse séparés par un filet fin.
- **Actif:** l'item courant s'inverse — fond d'encre, texte de craie. Pas de barre latérale colorée, pas de fond teinté.
- **Onglets:** languettes sur plaque, cernées d'un filet, séparées par un filet fin ; l'onglet actif s'inverse en encre et l'indicateur coulissant de Quasar est supprimé.

### Tableaux et registres
En-tête sur fond d'encre, texte de craie en pochoir ; lignes séparées par un filet fin, corps à 14 px ; survol de ligne à 6 % d'encre ; pied séparé par un filet épais. Une ligne de détail dépliée est teintée à 5 % d'encre, jamais grise.

### La plaque de séance (composant signature)
L'unité du monde. Trois zones dans un même rectangle cerné : bloc d'heure peint en encre à gauche (heure de début en Anton 1,5 rem, heure de fin précédée d'une flèche, mention « en cours » sous un filet clair — le bloc s'assombrit en encre nuit quand la séance est en cours), corps d'identité au centre (enseignant en lettrage, matière, promotion, plaque de salle, constat en chiffres tabulaires), champ d'action à droite sur toute la hauteur : encre « Pointer » tant que rien n'est constaté, puis la peinture du statut constaté. Le champ d'action est un `<button>` natif, avec anneau de focus en encre de 3 px en retrait de 6 px.

### Le champ de statut (`ChampStatut`)
Même grammaire partout — tournée, registres, relevés : aplat de peinture, filet d'encre de 2 px, libellé au pochoir. L'état « non contrôlé » est le seul champ sans peinture : transparent, texte en encre douce, filet en pointillé.

### Graphiques
Chart.js est réaligné sur le panneau à l'import : famille Archivo, texte en encre douce, quadrillage à 16 % d'encre, infobulle en encre à angle vif avec titre en Anton, barres à rayon 0, jonctions de lignes en pointe (`miter`), légendes en carrés de 12 px.

### Motion
Un seul geste : `.se-peint` — un balayage `clip-path` de 260 ms (`cubic-bezier(0.16, 1, 0.3, 1)`) qui peint le champ sur toute sa hauteur au moment où le pointage est accepté. Il est neutralisé sous `prefers-reduced-motion`. Les transitions d'état utilisent `--up-transition` (220 ms, même courbe) ou 120 ms linéaire pour l'assombrissement d'appui.

## Do's and Don'ts

### Do:
- **Do** répliquer toute peinture nouvelle ou modifiée à la fois dans `quasar.variables.scss` et dans `framework.config.brand` (règle des deux palettes).
- **Do** rendre un statut en champ peint pleine hauteur cerné d'un filet de 2 px, en réutilisant `.champ--present / --retard / --absent / --excuse / --remplace / --depart / --attente`.
- **Do** n'employer que les deux poids de trait du monde — filet 2 px d'encre, filet fin 1 px à 38 % — et réserver le 3 px aux deux seuils structurels existants.
- **Do** faire porter aux notes leur couleur sur le filet et le texte via `.note--valide / --info / --alerte / --erreur`, sur fond de craie.
- **Do** poser `.chiffres` sur toute grandeur, `.lettrage.avec-unite` sur un nombre porteur d'unité, `.pochoir--brut` sur une mention au pochoir contenant une heure.
- **Do** passer les nombres et durées par `nombreLisible` / `heuresLisibles` / `pourcentLisible`, et les dates par `ChampDate`.
- **Do** tenir 48 px de cible tactile minimale sous 600 px, et rendre un registre large en pile de plaques sur téléphone.
- **Do** vérifier tout nouveau couple couleur/texte contre les contrastes mesurés du monde ; l'ocre sur blanc (4,32:1) ne porte que du grand texte ou du pochoir gras.

### Don't:
- **Don't** arrondir un angle : aucun `border-radius` non nul n'appartient à ce monde.
- **Don't** poser une ombre portée, une élévation Quasar ou un relief simulé ; l'appui s'exprime par assombrissement.
- **Don't** utiliser une classe utilitaire de teinte Material (`bg-*-1`, `text-*-2`, `rounded-borders`) ni un gris Material comme texte secondaire : l'unique registre secondaire est l'encre douce.
- **Don't** fabriquer la matière avec un `linear-gradient` décoratif ; le grain vient de `public/matiere/email-panneau.svg` via le mixin `grain`.
- **Don't** ajouter `position: relative` (ni un pseudo-élément) dans le mixin `grain` : cela casse l'en-tête fixe de Quasar.
- **Don't** signaler un statut par une pastille colorée posée sur du blanc, ni par une bordure latérale colorée sur une carte.
- **Don't** poser du blanc sur le jaune signalétique : ce champ porte de l'encre.
- **Don't** étirer le panneau sur toute la largeur d'un grand écran ; il reste plafonné à 1180 px en deux colonnes.
- **Don't** retirer `htmlMinifyOptions.removeComments: false` de `quasar.config.ts` : le contrat de direction en commentaire d'`index.html` doit survivre au build.
