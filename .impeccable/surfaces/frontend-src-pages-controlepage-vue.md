---
version: 1
slug: "frontend-src-pages-controlepage-vue"
primary_target: "frontend/src/pages/ControlePage.vue"
related_targets: ["frontend/src/components/PointageDialog.vue","frontend/src/components/AttestationEnseignant.vue","frontend/src/pages/AttestationPage.vue"]
---

Portée : la feuille de contrôle du contrôleur pédagogique (ControlePage) et la
fiche de pointage qu'elle ouvre (PointageDialog, AttestationEnseignant), plus la
page publique d'attestation ouverte sur le téléphone de l'enseignant
(AttestationPage). Mode visiteur : **Operate**.

Public et tâche : le contrôleur circule d'une salle à l'autre pendant les heures
de cours, debout, une main occupée, sur un Android d'entrée de gamme, souvent en
plein jour et parfois sans réseau. Il descend sa tournée salle par salle,
constate qui enseigne, fait attester l'enseignant, repart. L'enseignant
n'intervient que trente secondes.

Action : pointer une salle en moins de temps qu'il n'en faut pour écrire une
ligne au cahier. Le constat du contrôleur et l'attestation de l'enseignant sont
un seul et même moment.

Contraintes : lecture à bout de bras en plein soleil, cibles tactiles d'au moins
48 px, fonctionnement hors ligne avec file d'attente, français intégral, le
registre papier reste imprimable et signé.

Direction retenue : « LE PANNEAU PEINT ». Monde issu des panneaux d'emploi du
temps peints à la main des couloirs de faculté et de la signalétique émaillée
des gares routières ouest-africaines : chaux, encre vert-noir, minium,
outremer, vert peinture, jaune signalétique ; filets épais tracés à la règle,
angles vifs, aucune ombre portée, lettrage Anton en capitales, corps Archivo,
chiffres tabulaires, matière dessinée (brosse + usure) plutôt que dégradés.

Assignation : direction 3 de la liste ordonnée par résonance, tirée par
concept-seed (clé 3bab42a2, mode operate, 2026-08-13). Les challengers tirés
(carrière de nuages, grammaire streetwear industrielle, surface d'app grand
public chaleureuse, console à coudes pastel) ont perdu sur l'identification du
public : le troisième reproduisait le défaut de catégorie que le commanditaire
venait explicitement de rejeter. Décision prise sans page de choix : le
commanditaire avait donné pour consigne de ne pas s'interrompre pour demander.
**Le re-tirage lui reste ouvert à tout moment.**

Moment mémorable : le champ se peint. Un balayage de 260 ms (clip-path) peint le
statut sur toute la hauteur de la plaque au moment où le pointage est accepté ;
c'est le seul geste animé du monde, réutilisé pour la confirmation de
synchronisation.

Décisions non tranchées : les autres dispositifs du répertoire émaillé (offset
de repérage sérigraphique, rivet de coin, main peinte directionnelle, ponts de
pochoir, seconde graisse de filet) restent disponibles si la densité
ornementale doit monter. L'orchestration de « se-peint » au-delà du champ
(arrivée des plaques, ouverture de la fiche) n'est pas décidée.
