---
name: University
description: La plateforme de gestion universitaire — présences, scolarité, finances, campus, documents — dans la grammaire d'Apple : sobre et aéré, aux trois couleurs du drapeau guinéen, employées en touches.
# Valeurs relevées sur `frontend/src/css/quasar.variables.scss` et
# `frontend/src/css/app.scss`, seules sources appliquées à l'exécution.
# Les neutres viennent des variables `--sk-*` de `main.built.css` d'apple.com,
# lues sur la feuille de style. Les couleurs sont celles du drapeau guinéen —
# rouge #CE1126, jaune #FCD116, vert #009460 — assombries là où elles doivent
# porter du texte, pour tenir le contraste AA.
colors:
  encre: "#1D1D1F"
  encre-douce: "#6E6E73"
  encre-tertiaire: "#86868B"
  gris-fond: "#F5F5F7"
  gris-inerte: "#E8E8ED"
  gris-filet: "#D2D2D7"
  blanc: "#FFFFFF"
  vert-action: "#007A4D"
  vert-lien: "#007A4D"
  vert-nuit: "#35C88A"
  vert-drapeau: "#009460"
  vert: "#007A4D"
  jaune: "#FCD116"
  jaune-texte: "#8A6300"
  rouge: "#CE1126"
  vert-fond: "#EFF7F2"
  jaune-fond: "#FFF8E1"
  rouge-fond: "#FDF0F2"
  noir-page: "#000000"
  surface-nuit: "#1D1D1F"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(2.6rem, 2rem + 3.6vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.07
    letterSpacing: "-0.024em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1.75rem, 1.2rem + 2.2vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.07
    letterSpacing: "-0.024em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.019em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.47059
    letterSpacing: "-0.012em"
  lede:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.47059
    letterSpacing: "-0.022em"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.33337
    letterSpacing: "-0.003em"
  rubrique:
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
    textTransform: "uppercase"
  chiffres:
    fontSize: "inherit"
    fontFeature: "'tnum' 1"
    letterSpacing: "-0.01em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "28px"
  pilule: "980px"
spacing:
  up-1: "4px"
  up-2: "8px"
  up-3: "16px"
  up-4: "24px"
  up-5: "40px"
  up-6: "64px"
components:
  plaque:
    backgroundColor: "{colors.blanc}"
    textColor: "{colors.encre}"
    border: "1px solid {colors.gris-filet}"
    rounded: "{rounded.lg}"
  champ-present:
    backgroundColor: "{colors.vert-fond}"
    textColor: "{colors.vert}"
    rounded: "{rounded.sm}"
  champ-retard:
    backgroundColor: "{colors.jaune-fond}"
    textColor: "{colors.jaune-texte}"
    rounded: "{rounded.sm}"
  champ-absent:
    backgroundColor: "{colors.rouge-fond}"
    textColor: "{colors.rouge}"
    rounded: "{rounded.sm}"
  champ-excuse:
    backgroundColor: "{colors.rouge-fond}"
    textColor: "#E05A6B"
    rounded: "{rounded.sm}"
  champ-remplace:
    backgroundColor: "{colors.vert-fond}"
    textColor: "#2E9E70"
    rounded: "{rounded.sm}"
  champ-attente:
    backgroundColor: "transparent"
    textColor: "{colors.encre-tertiaire}"
    rounded: "{rounded.sm}"
  button-primary:
    backgroundColor: "{colors.vert-action}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pilule}"
    typography: "{typography.body}"
    height: "36px"
  button-flat:
    backgroundColor: "transparent"
    textColor: "{colors.vert-lien}"
    rounded: "{rounded.pilule}"
  button-disabled:
    opacity: 0.36
  input-outlined:
    backgroundColor: "{colors.gris-fond}"
    textColor: "{colors.encre}"
    rounded: "{rounded.md}"
    focusRing: "0 0 0 3px rgba(0, 122, 77, 0.25)"
  chip:
    backgroundColor: "{colors.gris-inerte}"
    textColor: "{colors.encre}"
    rounded: "{rounded.pilule}"
    typography: "{typography.label}"
    padding: "4px 12px"
    height: "24px"
  chrome:
    backgroundColor: "rgba(255, 255, 255, 0.72)"
    backdropFilter: "saturate(180%) blur(20px)"
    textColor: "{colors.encre}"
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
  bandeau:
    backgroundColor: "{colors.blanc}"
    textColor: "{colors.encre}"
    border: "1px solid {colors.gris-filet}"
    rounded: "{rounded.lg}"
  table-header:
    backgroundColor: "transparent"
    textColor: "{colors.encre-douce}"
    typography: "{typography.label}"
    borderBottom: "1px solid {colors.gris-filet}"
  segmented:
    trackColor: "{colors.gris-inerte}"
    thumbColor: "{colors.blanc}"
    thumbShadow: "0 1px 2px rgba(0, 0, 0, 0.04)"
    rounded: "{rounded.md}"
---

# Design System: University

## Overview

**Creative North Star : la sobriété d'Apple, aux couleurs du drapeau**

L'application se lit sans effort et sans bruit. Du blanc, un gris, de l'encre. La couleur ne sert qu'à dire un état — jamais à décorer une surface, jamais à signaler qu'un élément est important. Une page entière peut n'avoir aucune couleur, et c'est le cas normal, pas un manque.

Cette grammaire couvre **toute la plateforme**, pas seulement le registre : la tournée du contrôleur comme le guichet de la scolarité, la feuille de paie comme le portail de l'étudiant, la bibliothèque comme le rectorat. Un même écran de notes, une même plaque, un même champ de statut — du terrain au bureau, d'une rubrique à l'autre. Ce qui change d'un écran à l'autre n'est jamais sa matière, seulement sa densité.

Les neutres sont relevés sur apple.com plutôt que devinés : ils viennent des variables `--sk-*` de `main.built.css` — l'encre `#1D1D1F`, le gris secondaire `#6E6E73`, le gris de section `#F5F5F7`, le filet `#D2D2D7`. Le principe qu'on en retient tient en une observation : sur une page d'Apple, la seule teinte saturée est le bouton d'achat.

Les **couleurs**, elles, sont celles du drapeau guinéen — rouge `#CE1126`, jaune `#FCD116`, vert `#009460` — reprises comme *touches*. Le vert est l'unique couleur d'action de l'application ; le rouge et le jaune ne disent que des états. Une seule décoration existe : un filet tricolore de 4 px et 72 px de large, posé en tête des écrans publics. C'est tout.

Les teintes officielles ne tiennent pas toujours le contraste : `#009460` avec du texte blanc ne donne que 3,88:1. Le vert d'action est donc descendu d'un cran à `#007A4D` (5,40:1), et le jaune — impossible en texte, 1,4:1 sur blanc — s'écrit en ocre `#8A6300` (5,43:1). La teinte officielle reste employée telle quelle partout où elle ne porte pas de texte : le filet tricolore, le remplissage d'une barre, une pastille de légende.

La structure, c'est l'air. Ce qui était séparé par un trait épais l'est désormais par du vide ; le filet — un cheveu de 1 px — ne reste que là où le vide ne suffit pas. La page est grise et les surfaces posées dessus sont blanches, l'inverse du réflexe habituel, et c'est ce qui fait respirer un écran de gestion.

La densité reste celle d'un registre de terrain : le contrôleur travaille debout, une main occupée, sur un téléphone d'entrée de gamme. Un chiffre géant est un chiffre que quelqu'un cherche en levant les yeux. Mais il se lit en encre, pas en couleur. Les écrans de bureau — scolarité, finances, rectorat — gardent la même matière et la même aération ; ils serrent simplement la grille au lieu d'étaler les registres en grandes plaques.

Refus explicites portés par le code : l'aplat saturé pleine largeur, le filet de 2 px qui structure, la capitale criée, l'angle vif, et la carte cernée sans ombre. Le monde précédent — le panneau émaillé peint à la main — n'a plus cours ; ses noms de classes survivent (`.plaque`, `.champ`, `.lettrage`, `.pochoir`, `.bandeau`) parce qu'ils désignent toujours les mêmes rôles, mais leur matière a entièrement changé. Les trois couleurs reviennent de ce monde-là ; leur emploi, lui, n'a rien à voir : elles ponctuent au lieu de couvrir.

**Key Characteristics :**
- La couleur dit un état, jamais une décoration. Un seul vert d'action dans toute l'application.
- Le tracking suit le corps (§15 du guide Apple) : `-0.024em` sur un grand titre, `-0.012em` sur le corps, `-0.003em` sur une légende. Jamais une valeur unique pour toutes les tailles.
- La fonte système d'abord : SF Pro sur un appareil Apple par `-apple-system`, Inter en relais ailleurs.
- Rayons doux et gradués : pilule pour un bouton, 12 px pour un champ, 18 px pour une carte, 28 px pour un dialogue.
- Ombres presque invisibles : trois niveaux, dont le premier se devine plus qu'il ne se voit.
- Chrome translucide (`backdrop-filter`) sous laquelle le contenu défile.
- Retour sur l'appui et non sur le relâchement ; ressorts critiquement amortis, sans dépassement.
- Cibles tactiles de 44 px sous 600 px de large, et le zoom reste permis.

## Colors

Deux neutres portent tout — l'encre et le gris. Trois couleurs, celles du drapeau, ponctuent : le vert porte l'action, le rouge et le jaune disent les états. Elles ne couvrent jamais une surface ; elles vivent dans le texte, sur un fond très dilué, ou dans un trait de 4 px.

### Primary
- **Vert d'action** (#007A4D) : la seule couleur d'action de l'application. Le bouton plein, le bouton flottant, le lien, l'anneau de focus des champs, l'icône de l'élément de navigation courant, la pastille d'étape en cours, le remplissage d'une jauge. Survol #008856, appui #006B43. **Un seul bouton plein par écran.** C'est le vert du drapeau (#009460) descendu d'un cran pour tenir 5,40:1 avec du texte blanc.
- **Vert de nuit** (#35C88A) : le même rôle en thème sombre, où #007A4D deviendrait illisible sur du noir.

### Secondary — les états
- **Vert** (#007A4D) : la séance assurée. Champ « Présent », part de couronne, cachet de tournée complète. C'est le même vert que l'action — ce qui les distingue est le traitement, pas la teinte : l'action est un aplat plein à texte blanc, l'état est un fond dilué dont le texte porte la couleur.
- **Jaune** (#FCD116) : le retard et l'attente. **Il ne porte jamais de texte** — sur blanc il tombe à 1,4:1. Il ne sert que de repère coloré : filet tricolore, remplissage de barre, pastille de légende. Toute mention écrite passe par l'ocre **#8A6300** (5,43:1).
- **Rouge** (#CE1126) : l'absence et le refus. Il tient le contraste dans les deux sens — 5,64:1 en texte sur blanc, 5,64:1 en blanc sur lui.

Chaque couleur n'a qu'une variante, nuance de la même famille : **vert clair** (#2E9E70) pour la séance assurée par un remplaçant, **ocre** (#8A6300) pour le départ anticipé, **rouge clair** (#E05A6B) pour l'absence excusée — excusée ou non, une absence reste une absence.

Les trois fonds dilués sont les seuls fonds colorés du système : **vert-fond** #EFF7F2, **jaune-fond** #FFF8E1, **rouge-fond** #FDF0F2.

### Neutral
- **Encre** (#1D1D1F, `--sk-body-text-color`) : titres et texte principal ; aussi le fond des surfaces en thème sombre.
- **Encre douce** (#6E6E73, `--sk-fill-gray-secondary`) : le seul registre de texte secondaire. Les gris Material (`text-grey-5` à `text-grey-8`) y sont redirigés. Sur blanc : **5,01:1**.
- **Encre tertiaire** (#86868B) : légendes, rubriques d'index, mentions inertes. Sur blanc : **3,62:1** — grand texte et libellés gras uniquement.
- **Gris de fond** (#F5F5F7) : fond de page, fond d'un champ au repos, colonne d'index.
- **Gris inerte** (#E8E8ED) : gouttière d'un segmented control, pastille neutre, jauge vide.
- **Gris filet** (#D2D2D7) : le filet d'un cheveu. Il ne structure pas — il termine.
- **Blanc** (#FFFFFF) : la surface. Encre sur blanc : **16,64:1**.
- **Noir** (#000000) : le fond du thème sombre. Les surfaces y **montent** en gris #1D1D1F au lieu de descendre.

### Named Rules
**La règle du filet tricolore.** La seule décoration du système : 4 px de haut, 72 px de large, rayon pilule, rouge–jaune–vert en trois tiers égaux. Posé par le mixin `filetDrapeau` en `::before` — donc sans rien demander au gabarit — en tête des écrans publics (connexion, portail étudiant, préinscription, formations, 404). Il ne se répète pas ailleurs : trois bandes pleine largeur, c'était le monde précédent, et elles criaient.

**La règle des deux palettes.** `quasar.variables.scss` et `framework.config.brand` dans `quasar.config.ts` portent exactement les mêmes hexadécimaux : toute teinte modifiée dans l'un se réplique dans l'autre, sinon deux palettes se disputent l'interface.

**La règle du fond dilué.** Un état ne se rend jamais en aplat saturé à texte blanc. Fond très dilué, couleur portée par le texte. Une règle globale d'`app.scss` rattrape à elle seule la quarantaine d'écrans qui posent encore `color="positive" text-color="white"` sur une `q-chip` ou un `q-badge`. Seule exception commentée : le badge de comptage flottant, trop petit pour survivre à la dilution, garde son aplat rouge.

**La règle du jaune muet.** Le jaune du drapeau ne porte pas de texte, jamais. Tout libellé qui devrait être « jaune » s'écrit en ocre #8A6300.

**La règle du vert à deux traitements.** Action et « présent » partagent la teinte. Ce qui les sépare est la forme : aplat plein + texte blanc pour ce sur quoi on appuie ; fond dilué + texte vert pour ce qui est constaté. Ne jamais rendre un état en aplat plein — il deviendrait un bouton.

**La règle du gris terminal.** Ce qui est *clos* (dossier archivé, étape franchie) se rend en gris et encre, pas en vert. Le vert dit « en cours d'aboutissement », pas « rangé » — sans quoi « validé » et « clos » deviennent indiscernables.

**La règle du sans-pastel Material.** Aucune classe utilitaire de teinte Material (`bg-red-1`, `text-blue-2`, `bg-grey-3`) n'entre dans ce monde.

**La règle des anciens noms.** `quasar.variables.scss` conserve `$chaux`, `$blanc-craie`, `$orange`, `$bleu`… comme alias pointant vers la palette du drapeau. Une cinquantaine de feuilles `scoped` les nommaient au fil des deux bascules successives ; les garder vivants évite qu'un oubli casse la compilation *ou* réintroduise du bleu. Ne pas en ajouter de nouveaux.

**La règle du rôle neutre.** `secondary` est l'encre — un rôle *neutre*, donc il doit basculer avec le thème. Un hexadécimal figé y disparaît en sombre.

## Typography

**Font Stack :** `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter Variable', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif`.

Sur un appareil Apple, `-apple-system` attrape SF Pro : rien à charger, et le tracking optique du système est déjà réglé — c'est exactement ce que demande le §15 du guide (« default to the platform's system font »). Ailleurs — Android, Windows — **Inter Variable** prend le relais, embarquée dans le bundle via `@fontsource-variable/inter` : même grotesque néo, même hauteur d'x, et aucun appel réseau au chargement, ce qui compte sur une connexion de campus intermittente.

**Character :** une seule voix. Du poids et du serrage font la hiérarchie ; les capitales n'y participent pas.

### Hierarchy
- **Display** (600, clamp 2,6→4 rem, interligne 1,07, tracking −0,024em) : le chiffre qui commande la tournée. Un seul par écran.
- **Headline** (600, clamp 1,75→2,75 rem, tracking −0,024em) : titres de page (`.page-titre`), jour de la tournée, marque de l'écran d'accès.
- **Title** (600, 1,25 rem, tracking −0,019em) : titres de fiches et de dialogues ; `.text-h6` hérite de `.lettrage`.
- **Lede** (400, 17 px, interligne 1,47, tracking −0,022em) : l'accroche sous un titre de page (`.page-sous-titre`), bridée à 66ch. C'est le corps de texte d'Apple, au chiffre près.
- **Body** (400, 15 px, interligne 1,47, tracking −0,012em) : corps du registre.
- **Label** (`.pochoir`, 500, 12 px, tracking −0,003em) : mentions et légendes. **Ce n'est plus une capitale.**
- **Rubrique** (`.pochoir--rubrique`, 600, 11 px, capitales, tracking **+0,06em**) : le seul endroit où la capitale subsiste — rubrique d'index, intitulé qui doit se distinguer sans grossir. Elle prend alors le tracking *positif* que réclament les petites capitales.

### Named Rules
**La règle du tracking par corps.** Une valeur de `letter-spacing` unique est fausse quelque part. Elle est négative et serrée sur les grands titres (les lettres se lisent trop écartées à mesure qu'elles grandissent), proche de zéro sur les petits corps, positive sur les capitales. Tout nouveau niveau typographique choisit son tracking en fonction de son corps.

**La règle de la mise en mesure par le texte.** `html` est réglé en `font: 100%/1.5` et le `<meta name="viewport">` ne bride plus le zoom : `user-scalable=no` retirait à l'utilisateur son réglage de taille de texte, ce que le §15 interdit. La mise en page suit la police plutôt que de la brider.

**La règle de l'unité en minuscule.** Un nombre porteur d'unité prend `.lettrage.avec-unite` : « 85,3 h », jamais « 85,3 H ». Une mention contenant une heure prend `.pochoir--brut`.

**La règle des chiffres alignés.** Toute grandeur, heure ou compteur porte `.chiffres` (`tabular-nums` + `tnum`), pour que les colonnes ne dansent pas d'une ligne à l'autre.

**La règle du français écrit.** Les nombres, heures et pourcentages passent par `nombreLisible`, `heuresLisibles`, `pourcentLisible` de `src/shared/utils/libelles/` ; les dates par le composant `ChampDate`, jamais par un `type="date"` natif qui affiche MM/JJ/AAAA hors locale française.

## Layout

Le rythme d'espacement est unique et à six pas : **4, 8, 16, 24, 40, 64 px** (`--up-1` à `--up-6`). Chaque cran est plus large que dans le monde précédent : l'aération est le premier symptôme de la sobriété qu'on vise. Aucune valeur hors de cette échelle, sauf ajustement optique local de 2 à 6 px.

La surface maîtresse — la tournée — s'organise en trois régions : chrome translucide en haut de fenêtre, bandeau de journée (une surface blanche arrondie posée sur le gris), puis la pile de plaques. Chaque plaque est une grille de trois colonnes : bloc d'heure sur fond gris à gauche, identité au centre (`minmax(0, 1fr)`), champ d'action ou de statut à droite sur toute la hauteur — la cible du pouce.

Les autres rubriques — scolarité, finances, campus, administration — reprennent la même armature : chrome translucide, bandeau de journée ou de section posé sur le gris, plaques blanches et registres. Une fiche d'étudiant, une feuille de paie et une réservation de cité sont des plaques du même système ; seule la colonne de gauche change.

Trois seuils responsives, tous exprimés en largeur maximale de contenu plutôt qu'en étirement :
- **≤ 599 px (téléphone)** : la plaque passe à deux colonnes, le champ d'action bascule sous le corps sur toute la largeur ; boutons et champs de saisie à 44 px, items de liste à 48 px.
- **≤ 767 px** : un registre large se rend en pile de plaques plutôt qu'en tableau ; quand un tableau subsiste, ses cellules restent sur une ligne et s'élident à 42vw.
- **≥ 1024 px** : deux colonnes de plaques, plafonnées à 1180 px. Le contenu ne s'étire jamais sur toute la largeur d'un écran de bureau.

Les registres qui débordent défilent horizontalement : la barre de défilement est une réglette fine et grise à bouts arrondis, qui s'efface dans la surface au lieu de la barrer.

## Elevation & Depth

Apple ne pose pas d'ombre pour décoller une carte de son fond — une carte se détache déjà par sa clarté. Il pose une ombre pour dire qu'une chose **flotte par-dessus** le contenu. D'où trois niveaux seulement, et le premier presque invisible.

### Shadow Vocabulary
- **`--up-ombre-1`** (`0 1px 2px rgba(0,0,0,.04)`) : une carte, une pastille de segmented control. On la devine plus qu'on ne la voit.
- **`--up-ombre-2`** (`0 4px 16px rgba(0,0,0,.08)`) : un menu, une notification — quelque chose qui vient d'arriver au-dessus.
- **`--up-ombre-3`** (`0 12px 40px rgba(0,0,0,.12)`) : un dialogue, la seule chose qui bloque le reste.

En thème sombre, les trois montent en opacité (0,4 / 0,5 / 0,6) : sur du noir, une ombre discrète ne se voit pas.

### Named Rules
**La règle de la chrome translucide.** L'en-tête et le pied de fenêtre sont des couches translucides (`rgba(255,255,255,.72)` + `backdrop-filter: saturate(180%) blur(20px)`) sous lesquelles le contenu défile — jamais une bande opaque qui mange un bord de l'écran.

**La règle des deux bandeaux.** `.bandeau` a deux emplois pour une même idée (« le haut de quelque chose »), et donc deux matières : en tête de fenêtre (`.q-header.bandeau`, `.q-footer.bandeau`) c'est la chrome translucide ; **dans le corps d'une page, c'est une surface franche**, comme n'importe quelle plaque. Une chrome translucide posée au milieu d'une page n'a rien à laisser passer derrière elle et devient illisible.

**La règle de la transparence refusée.** Sous `prefers-reduced-transparency: reduce`, la chrome devient une surface pleine et le flou tombe — sinon la lisibilité s'effondre (§14).

## Shapes

Aucun angle vif. Les rayons sont gradués selon la taille de la surface : **8 px** (`--up-rayon-sm`, une pastille, un bloc d'heure), **12 px** (`--up-rayon`, un champ de saisie, une gouttière de segmented control), **18 px** (`--up-rayon-lg`, une carte, un tableau), **28 px** (`--up-rayon-xl`, un dialogue), **980 px** (`--up-pilule`, un bouton, une étiquette, une barre de progression).

Un seul poids de trait : le **filet** (`1px solid #D2D2D7`), plus un **filet fin** (`1px` à 6 % de noir) pour les subdivisions internes — lignes de registre, séparations d'index. Le trait de 2 px et le trait de 3 px n'existent plus.

Les formes récurrentes : la **plaque** (surface blanche à 18 px de rayon, cernée d'un filet), le **champ** (pastille douce à fond dilué qui porte sa couleur en texte), la **plaque de salle** (pastille grise à chiffres tabulaires), le **segmented control** (gouttière grise, pastille blanche ombrée sur l'option choisie).

## Components

### Buttons
- **Shape :** pilule (980 px), sans ombre, casse d'origine, graisse 500, tracking −0,01em, hauteur 36 px (44 px sous 600 px).
- **Primary :** aplat vert #007A4D, texte blanc (**5,40:1**). Survol #008856, appui #006B43. **Un seul par écran** — celui qui fait avancer.
- **Flat :** pas de fond, texte en vert de lien. C'est la forme par défaut des actions secondaires.
- **Outline :** trait de 1 px à la couleur du texte.
- **Appui :** `scale(0.97)` en 140 ms, déclenché sur l'appui et non sur le relâchement (§1).
- **Désactivé :** opacité 0,36. Apple baisse l'opacité d'une action, il ne la repeint pas en gris.

### Chips & Badges
Pastille de 24 px de haut en pilule, 12 px, graisse 500, fond gris inerte. Une chip colorée passe automatiquement au fond dilué + texte coloré (voir « la règle du fond dilué »).

### Cards / Containers
- **Corner :** 18 px.
- **Background :** blanc, sur une page grise.
- **Border :** filet d'un cheveu.
- **Shadow :** `--up-ombre-1`, presque invisible.
- **Padding :** 16 px (`--up-3`) par défaut, 24 px pour un en-tête de fiche.

### Inputs / Fields
- **Repos :** fond gris #F5F5F7, **aucune bordure**, rayon 12 px. Le champ se lit par son fond, pas par son contour.
- **Focus :** le fond passe au blanc, contour vert de 1 px, halo `0 0 0 3px rgba(0,122,77,.25)`.
- **Erreur :** contour rouge de 1 px, halo rouge.
- **Libellé :** une phrase en gris, 15 px, casse d'origine — plus une capitale au pochoir. Il rétrécit à 12 px quand il flotte.
- **Sombre :** fond blanc à 6 %.

### Navigation
- **En-tête :** chrome translucide de 48 px, marque à 17 px/600, titre de page en gris précédé d'une barre oblique. Le filet vertical qui les séparait a disparu — l'air suffit.
- **Index (tiroir) :** fond gris, rubriques en petites capitales grises (`.pochoir--rubrique`), liens en 14 px/400. Chaque lien est une pastille de 8 px de rayon qui se remplit au survol.
- **Actif :** fond gris inerte, graisse 590, **icône en vert**. Plus d'inversion en aplat sombre qui coupait l'index en deux.
- **Onglets & bascules :** le segmented control d'Apple — gouttière grise de 12 px de rayon, pastille blanche ombrée sur l'option choisie, indicateur coulissant de Quasar supprimé. `ViewToggle` et `BasculeVue` disent la même chose de la même façon.

### Tableaux et registres
En-tête **sans bandeau** : intitulés de colonne en gris 12 px, séparés du corps par un filet. Lignes en 15 px séparées par un filet fin, survol à 2,5 % de noir, dernière ligne sans filet. Le conteneur est une carte de 18 px de rayon.

### La plaque de séance (composant signature)
Trois zones dans une surface arrondie : bloc d'heure sur fond gris à gauche (heure de début en 1,5 rem, heure de fin précédée d'une flèche, mention « en cours »), corps d'identité au centre, champ d'action à droite sur toute la hauteur. Une séance en cours est marquée d'un **liséré vert intérieur de 2 px** — la couleur de ce qui est actif. Le champ d'action reste un `<button>` natif, avec anneau de focus vert de 2 px.

### Le champ de statut (`ChampStatut`)
Même grammaire partout : pastille douce à 8 px de rayon, fond dilué, couleur portée par le texte, graisse 590. L'état « non contrôlé » est le seul sans fond : transparent, texte en encre tertiaire.

### Graphiques
Chart.js est réaligné à l'import (`ChartCanvas.vue`) : fonte système, texte en #6E6E73, quadrillage à 8 % de noir, infobulle en encre à 92 % avec coins de 8 px — la même matière que `.q-tooltip` —, barres à 6 px de rayon, lignes à jonctions rondes et tension 0,35, points masqués au repos avec 12 px de zone de survol, pastilles de légende rondes de 10 px.

### Notifications
Une petite feuille translucide en encre à 92 %, 12 px de rayon, `--up-ombre-2`. **L'espèce se lit à l'icône, qui seule porte la couleur** : un échec de réseau ne doit pas crier aussi fort qu'une suppression de dossier. Les classes `bg-negative` de Quasar portant `!important`, la surcharge en fait autant — c'est commenté sur place.

### Motion
Ressort critiquement amorti par défaut, réponse 0,3–0,4 s, **aucun dépassement** (§4) : `--up-transition` (300 ms) et `--up-transition-rapide` (180 ms), tous deux en `cubic-bezier(0.32, 0.72, 0, 1)`, l'approximation CSS la plus proche d'un ressort amorti. `--up-transition-elan` (420 ms, léger dépassement) est réservé à ce qui a été lancé au doigt.

`.se-peint` — le geste d'apparition d'un champ — n'est plus un balayage mais une **matérialisation** (§12) : opacité et `scale(0.96 → 1)` en 300 ms, pour que la surface arrive comme une matière et non comme un fondu. Sous `prefers-reduced-motion: reduce`, il se réduit à un fondu de 160 ms et toutes les transitions du document tombent à 120 ms.

## Do's and Don'ts

### Do:
- **Do** répliquer toute teinte nouvelle ou modifiée à la fois dans `quasar.variables.scss` et dans `framework.config.brand` (règle des deux palettes).
- **Do** rendre un état en pastille douce — fond dilué, couleur portée par le texte — en réutilisant `.champ--present / --retard / --absent / --excuse / --remplace / --depart / --attente`.
- **Do** choisir le tracking d'un nouveau niveau typographique en fonction de son corps : négatif et serré quand il grandit, proche de zéro quand il rapetisse, positif s'il est en capitales.
- **Do** n'employer qu'un seul poids de trait — le filet d'un cheveu — et laisser l'air faire le reste de la structure.
- **Do** réserver le bouton plein vert à l'action qui fait avancer, une seule par écran ; tout le reste est un bouton plat vert.
- **Do** faire porter aux notes leur couleur en texte sur fond dilué via `.note--valide / --info / --alerte / --erreur`.
- **Do** poser `.chiffres` sur toute grandeur, `.lettrage.avec-unite` sur un nombre porteur d'unité, `.pochoir--brut` sur une mention contenant une heure.
- **Do** tenir 44 px de cible tactile minimale sous 600 px, et rendre un registre large en pile de plaques sur téléphone.
- **Do** vérifier tout nouveau couple couleur/texte contre les contrastes mesurés ; l'encre tertiaire (3,62:1) ne porte que du grand texte ou du libellé gras, et le jaune du drapeau n'en porte aucun.
- **Do** rendre en gris et encre ce qui est *clos*, et réserver le vert à ce qui est actif ou acquis.
- **Do** employer `var(--up-encre)` et non `text-secondary` pour un texte qui doit rester lisible dans les deux thèmes : `$secondary` est figé à #1D1D1F et disparaît sur fond sombre.

### Don't:
- **Don't** poser un aplat saturé sur une surface, ni du texte blanc sur une couleur d'état : la couleur va dans le texte, sur fond dilué.
- **Don't** colorer plusieurs grands chiffres d'un même relevé. Quand tout est coloré, plus rien ne ressort — le relevé se lit en encre.
- **Don't** utiliser une classe utilitaire de teinte Material (`bg-*-1`, `text-*-2`) ni un gris Material comme texte secondaire : l'unique registre secondaire est l'encre douce.
- **Don't** poser un angle vif, ni un filet de 2 ou 3 px : le rayon et le cheveu suffisent.
- **Don't** poser une chrome translucide ailleurs qu'en tête ou en pied de fenêtre.
- **Don't** écrire du texte en #FCD116 : le jaune du drapeau ne porte jamais de mot, il ne fait que marquer.
- **Don't** répéter le filet tricolore ailleurs qu'en tête d'un écran public : une touche répétée n'est plus une touche.
- **Don't** cibler `body--dark` avec `:deep()` dans une feuille scoped : `:deep()` ne descend que dans le composant, or la classe est sur `<body>`, un ancêtre. Écrire `body.body--dark .x`.
- **Don't** ajouter d'alias à la liste des anciens noms de peintures (`$chaux`, `$jaune`…) : ils existent pour la transition, pas pour être étendus.
- **Don't** rétablir `user-scalable=no` dans le `<meta name="viewport">` : le réglage de taille de texte appartient à l'utilisateur.
- **Don't** attendre le relâchement pour donner un retour d'appui, ni animer avec dépassement ce qui n'a pas été lancé au doigt.
- **Don't** étirer le contenu sur toute la largeur d'un grand écran ; il reste plafonné à 1180 px.
- **Don't** retirer `htmlMinifyOptions.removeComments: false` de `quasar.config.ts` : le contrat de direction en commentaire d'`index.html` doit survivre au build.

---

> **Sidecar.** `.impeccable/design.json` a été régénéré avec cette bascule : mêmes hexadécimaux, mêmes rayons, mêmes règles, plus huit spécimens de composants (plaque de séance, champ de statut, bouton, champ de saisie, chrome, segmented control, note, en-tête de registre) rendus dans la grammaire Apple. En cas de divergence, ce fichier-ci fait foi. Ses spécimens portent encore l'ancien nom de marque : le sidecar reste à régénérer — tant que ce n'est pas fait, ce fichier-ci fait foi, y compris sur le nom.
>
> **Vérification.** La bascule a été contrôlée écran par écran, et pas seulement compilée : un balayage automatisé mesure le contraste de chaque nœud de texte contre son fond réel sur 39 écrans en thème clair et 43 en thème sombre. Il ne reste aucun texte sous 2:1. Ce balayage a fait ressortir quatre défauts que la lecture seule n'aurait pas donnés — `q-btn-toggle` qui marque l'option choisie par `bg-primary` et non par `q-btn--active` ; `--up-primary` employée mais jamais déclarée ; `text-secondary` figé à #1D1D1F donc invisible en sombre ; et une règle `.etat-vide .q-icon` trop large qui grisait l'icône du bouton d'action posé dans l'état vide.
