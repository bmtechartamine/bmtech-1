# Carte de reconnaissance : Planner 5D (web)

Périmètre : le cœur du produit. Dessiner un plan en 2D, ajouter portes et
fenêtres, meubler depuis un catalogue, voir le résultat en 3D, enregistrer et
partager.
Pour : un produit grand public à vendre, et un outil pour l'activité de BM Tech
(clients, artisans, projets d'aménagement).
Date : 2026-10-27

> Cette carte est faite **uniquement à partir de sources publiques** : pages
> marketing, articles d'aide, fiches des stores, avis tiers. Le site
> planner5d.com n'était pas joignable depuis l'environnement de travail, et je
> n'ai utilisé aucun compte. Les écrans sont donc **déduits** : la colonne
> « confiance » le dit pour chacun. Pour les confirmer, il faut des captures
> d'écran (à mettre dans `replica/screens/`) ou une visite à la main de l'appli.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | aide : dimensions et unités | https://support.planner5d.com/en/articles/16963387-how-to-change-dimensions-and-measurement-units | murs, pièces, portes, fenêtres et meubles sont éditables ; un mur seul ou toute la pièce ; unités appliquées à tout le projet |
| 2 | aide : créer un étage | https://support.planner5d.com/en/articles/16475679-how-to-create-a-new-floor | jusqu'à 6 étages sur le web, 3 sur les applis |
| 3 | aide : premier étage, fenêtres | https://intercom.help/planner-5d/en/articles/5913588-creating-your-first-floor-windows | portes et fenêtres ajoutées après les murs |
| 4 | aide : abonnements web | https://support.planner5d.com/en/articles/5885921-subscription-types-web | Basic gratuit, Premium (catalogue complet, partage, IA, quotas de rendus), PRO (rendus illimités, 4K, 360°, portfolio) |
| 5 | aide : abonnements iOS | https://support.planner5d.com/en/articles/5897772-subscription-types-ios | formule hebdomadaire |
| 6 | page tarifs | https://planner5d.com/tr/pricing | prix US, variables selon région |
| 7 | page « plan 2D » | https://planner5d.com/use/2d-floor-plan | 2D d'abord pour la précision, puis 3D |
| 8 | page « plan 3D » | https://planner5d.com/use/3D-floor-plan | visite en 3D |
| 9 | page « créer un plan » | https://planner5d.com/use/floor-plan-drawer | glisser-déposer, redimensionner les pièces |
| 10 | page appli de déco | https://planner5d.com/interior-design-app | couleurs, matériaux et textures sur sols et murs, export |
| 11 | blog, conseils débutants | https://planner5d.com/ru/blog/caJa/beginner-tips-to-use-planner-5d | pièces de base à remodeler, hauteur des murs |
| 12 | fiche App Store | https://apps.apple.com/FR/app/id606173978 | 2D et 3D, catalogue 5000+, « Snapshot » rendu réaliste, hors ligne, métrique/impérial, gratuit : 150+ objets et projets illimités, premium : catalogue complet et redimensionnement des meubles |
| 13 | fiche Microsoft Store | https://apps.microsoft.com/detail/9nblggh4mp71?hl=pt-BR | catalogue 8400+ objets |
| 14 | parcours d'écrans (tiers) | https://screensdesign.com/explore/flows/designing-spaces/ | barre du haut, espace de travail central, panneau du bas avec onglets de catégories |
| 15 | comparatif (tiers) | https://www.roomsketcher.com/blog/planner5d-vs-roomsketcher/ | surfaces des pièces, cotes intérieures et extérieures des murs |
| 16 | avis d'architecte (tiers) | https://www.architecturelab.net/software/planner-5d/ | export PDF sur le web, DWG/DXF en Pro, pas d'OBJ/FBX |
| 17 | conditions d'utilisation | https://planner5d.com/pages/terms/ | UAB Planner5D (Lituanie), modifiées le 10/09/2021. **Non lues en entier** : voir « Règles » plus bas |
| 18 | synthèse d'avis Google Play | https://kimola.com/reports/explore-key-insights-from-planner-5d-user-reviews-google-play-tr-148447 | plaintes : trop peu de gratuit, outils de dimension, traduction. Pour /replica-entrepreneur |

## Règles pour ce projet

- Je n'ai pas pu lire les conditions d'utilisation en entier. Tant que
  personne ne les a lues, **n'utilise pas ton compte Planner 5D pour étudier
  l'appli en vue de la copier**. Les sources publiques ci-dessus et des
  captures de pages publiques suffisent pour avancer.
- Le **catalogue 3D de Planner 5D lui appartient** : ses modèles de meubles,
  textures et images ne doivent jamais aller dans le clone. On construit notre
  propre catalogue avec des modèles sous licence libre (CC0 : Poly Haven,
  Kenney, ou des modèles faits pour nous).
- Rien de leur nom, de leur logo (maison verte « 5d ») ni de leurs textes.

## Boucle principale

Dessiner les pièces de son logement en 2D, puis les meubler et les voir en 3D :
c'est ce que les gens paient (catalogue complet, redimensionnement, partage).

## Écrans

| ID | écran | accès | rôle | composants clés | états | confiance |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | page d'accueil marketing | `/` | présenter, faire commencer | hero, CTA « commencer », exemples de projets | chargé, mobile | haute |
| S02 | inscription / connexion | bouton de S01, ou à la sauvegarde | créer un compte | formulaire e-mail, Google, Apple | vide, erreur, mot de passe oublié | moyenne |
| S03 | mes projets | après connexion | lister, ouvrir, créer | grille de vignettes, bouton « nouveau projet », menu par projet (renommer, dupliquer, supprimer) | **vide (premier projet)**, rempli, chargement, erreur | moyenne |
| S04 | nouveau projet | S03 → « nouveau » | partir de zéro ou d'un modèle de pièce | choix vierge / formes de base, nom | — | supposition |
| S05 | éditeur 2D | ouvrir un projet | dessiner pièces et murs, coter | canevas avec grille et zoom, outils pièce / mur / porte / fenêtre, cotes, surface, annuler/rétablir | vide, plan rempli, objet sélectionné, mur en cours de tracé, mobile | haute |
| S06 | vue 3D | bascule 2D/3D dans l'éditeur | voir et ajuster en volume | scène 3D, orbite, zoom, déplacement des objets | chargement de la scène, rempli | haute |
| S07 | catalogue | panneau dans l'éditeur | trouver et poser un objet | onglets de catégories, recherche, vignettes, cadenas premium, glisser-déposer | chargement, aucun résultat, objet verrouillé | haute |
| S08 | propriétés de l'objet sélectionné | clic sur un mur, une pièce ou un meuble | modifier dimensions, rotation, matériau, couleur | champs numériques, sélecteur de matériau/couleur, supprimer, dupliquer | mur, pièce, ouverture, meuble ; valeur invalide | haute |
| S09 | sélecteur d'étages | barre de l'éditeur | ajouter et changer d'étage | liste des niveaux, ajouter, supprimer | 1 étage, plusieurs, limite atteinte (6) | haute |
| S10 | « Snapshot » (image du projet) | bouton dans l'éditeur | sortir une image de la vue 3D | cadrage, bouton capture, galerie d'images | en cours, prêt, quota épuisé | moyenne |
| S11 | partage | bouton dans l'éditeur | partager un lien | lien à copier, public/privé | lien créé, désactivé | moyenne |
| S12 | vue publique du projet | lien partagé | regarder sans modifier | vue 2D/3D en lecture seule | projet introuvable, privé | supposition |
| S13 | réglages | menu du compte ou de l'éditeur | unités (métrique/impérial), langue | interrupteurs, listes | — | haute (unités) |
| S14 | abonnement / paywall | objet verrouillé, quota atteint, menu | passer en premium | comparatif des formules, paiement | gratuit, premium actif, annulé | haute |
| S15 | visite à la première personne | bouton dans la vue 3D | se promener dans le logement | contrôles de déplacement | — | supposition |
| S16 | export | menu de l'éditeur | sortir un plan PDF ou une image | choix du format | en cours, prêt | moyenne |

## Parcours

```
F01 Dessiner son premier plan
    S03 vide -> S04 -> S05 (tracer une pièce) -> S08 (ajuster les cotes)
    -> S07 (porte, fenêtre) -> S06 (voir en 3D) -> enregistrement automatique
    clics sur le chemin heureux : environ 10 (à mesurer sur l'appli)
    limites : murs qui ne se ferment pas, pièce en L ou en angle, cote saisie
              impossible (0, négative, énorme), porte plus large que le mur,
              annuler après une erreur, perte de connexion pendant l'édition

F02 Meubler une pièce
    S05 ou S06 -> S07 (chercher « canapé ») -> glisser dans la pièce
    -> S08 (pivoter, redimensionner, matériau) -> S06
    limites : objet hors de la pièce ou qui traverse un mur, objet verrouillé
              (premium), aucun résultat de recherche, catalogue lent à charger

F03 Ajouter un étage
    S05 -> S09 (ajouter) -> S05 sur le nouvel étage
    limites : limite de 6 étages, escalier entre étages, supprimer un étage plein

F04 Partager le projet
    S05 -> S11 (copier le lien) -> S12 (ouvert par un tiers)
    limites : lien d'un projet privé, projet supprimé entre-temps

F05 Sortir une image du projet
    S06 (cadrer) -> S10 -> télécharger
    limites : quota épuisé, image en cours de calcul

F06 Passer en premium
    S07 (objet verrouillé) -> S14 -> paiement -> retour à S07, objet débloqué
    limites : paiement refusé, annulation, fin de période

F07 Changer d'unités
    S13 -> métrique / impérial -> toutes les cotes du projet se mettent à jour
```

## Composants

| composant | variantes | états | utilisé sur |
| --- | --- | --- | --- |
| Bouton | principal, secondaire, fantôme, danger, icône | normal, survol, focus, désactivé, chargement | partout |
| Barre d'outils de l'éditeur | outils 2D, outils 3D | outil actif, désactivé | S05, S06 |
| Canevas 2D | — | vide, rempli, sélection, tracé en cours | S05 |
| Scène 3D | orbite, première personne | chargement, prête | S06, S12, S15 |
| Bascule 2D / 3D | — | 2D, 3D | S05, S06 |
| Panneau catalogue | onglets, recherche, grille | chargement, vide, verrouillé | S07 |
| Vignette d'objet | gratuite, premium (cadenas) | normal, glissé, verrouillé | S07 |
| Panneau de propriétés | mur, pièce, ouverture, meuble | valeur invalide | S08 |
| Champ numérique avec unité | cm, m, po, pi | normal, erreur, focus | S08, S13 |
| Sélecteur de matériau / couleur | grille de textures, palette | sélectionné | S08 |
| Cote (étiquette de dimension) | intérieure, extérieure | normal, en édition | S05 |
| Liste d'étages | — | actif, limite atteinte | S09 |
| Carte de projet | — | vignette en cours, prête | S03 |
| Fenêtre modale | partage, export, abonnement, confirmation | ouverte, fermée | S10, S11, S14, S16 |
| Toast | succès, erreur | — | partout |
| Annuler / rétablir | — | disponible, épuisé | S05, S06 |

## Modèle de données déduit

```
User          id, email, name, locale, units (metric | imperial), plan (free | premium | pro)
              preuves : S02, S13, abonnements (sources 4, 5)        confiance : haute

Project       id, user_id, name, thumbnail_url, visibility (private | link),
              share_token, created_at, updated_at
              preuves : S03, S11, partage premium (source 4)          confiance : haute

Floor         id, project_id, level (0..5), height, name
              preuves : limite de 6 étages (source 2)                  confiance : haute

Wall          id, floor_id, start (x,y), end (x,y), thickness, height,
              material_left, material_right
              preuves : un mur ou toute la pièce éditable (source 1)   confiance : haute

Room          id, floor_id, name, polygon [(x,y)...], floor_material, ceiling_height,
              area (calculée)
              preuves : surfaces (source 15), formes de base (11)      confiance : moyenne
              question : une pièce est-elle un polygone qui génère ses murs, ou
              une zone détectée entre des murs ? Planner 5D semble partir
              des pièces ; à confirmer sur l'appli.

Opening       id, wall_id, kind (door | window), offset_on_wall, width, height,
              sill_height, catalog_item_id
              preuves : portes et fenêtres après les murs (source 3)   confiance : haute

CatalogItem   id, category, name, model_url (glTF), thumbnail_url, default_w,
              default_d, default_h, resizable, tier (free | premium)
              preuves : 150+ gratuits / catalogue complet (12)         confiance : haute

PlacedItem    id, floor_id, catalog_item_id, x, y, z, rotation, w, d, h,
              material_overrides (json)
              preuves : glisser-déposer, redimensionner (9, 12)        confiance : haute

Material      id, name, kind (floor | wall | furniture), texture_url, color, tier
              preuves : couleurs, matériaux, textures (10)             confiance : moyenne

Snapshot      id, project_id, camera (json), image_url, status, quality
              preuves : Snapshot, quotas de rendus (4, 12)             confiance : moyenne

Subscription  id, user_id, plan, period (month | year), status, renders_left,
              current_period_end
              preuves : formules et quotas (4)                         confiance : haute
```

Relations : User 1-n Project, Project 1-n Floor, Floor 1-n Wall / Room /
PlacedItem, Wall 1-n Opening, CatalogItem 1-n PlacedItem, User 1-1 Subscription.

Choix d'architecture à prévoir : le contenu d'un projet (murs, pièces, objets)
s'enregistre probablement mieux comme **un document JSON versionné par étage**
que comme des milliers de lignes SQL. `/replica-architect` tranchera.

## Matrice des fonctionnalités

Voir `features.csv`. Indispensable (must) : 16, souhaitable (should) : 11,
optionnel (could) : 7, exclu (skip) : 8.

## Hors périmètre (impossible ou interdit à copier)

- **Leur catalogue d'objets 3D et leurs textures** : contenu sous licence qui
  leur appartient. Il faut construire le nôtre (modèles CC0 ou commandés).
  C'est le plus gros chantier caché du projet.
- **Leur galerie de projets d'utilisateurs** et leur communauté : c'est leur
  réseau, pas une fonctionnalité.
- **Design School** : leur contenu de cours.
- **Rendus photoréalistes haute qualité, 4K, 360°** : hors du périmètre choisi
  (il faut un serveur de rendu). À reprendre plus tard.
- **IA : plan à partir d'une photo** : hors du périmètre choisi.
- **Applis mobiles natives et réalité augmentée** : la version web passe d'abord.
- **Offre B2B en marque blanche** : leurs contrats et intégrations e-commerce.
- **Export DWG/DXF** : formats pro, pas pour la première version.

## Taille

Écrans : 16. Parcours : 7. Entités : 11.

Les parties difficiles :
1. **L'éditeur 2D** : tracer des murs qui s'accrochent entre eux, fermer les
   pièces, calculer les surfaces, coter, annuler/rétablir. C'est le cœur et
   le plus long.
2. **La génération 3D** : transformer les murs en volumes avec des trous pour
   les portes et fenêtres, appliquer les matériaux, garder une scène fluide
   avec beaucoup de meubles (Three.js).
3. **Le catalogue** : trouver, licencier, alléger (glTF compressé) et ranger
   quelques centaines de modèles 3D. Sans catalogue, l'appli ne sert à rien.

Taille : **L (environ un trimestre)** pour le cœur complet et soigné. Une
première version qui marche de bout en bout (dessiner une pièce, poser des
meubles, voir en 3D, enregistrer) est faisable en **quelques semaines**. Pas
de promesse de clone parfait : `/replica-diff` donnera le vrai chiffre.
