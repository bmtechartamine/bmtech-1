# Journal de construction : BMT Plan

Date : 2026-10-27. L'appli est dans `app/`.

| écran | état | ce qui manque | plus dur que prévu |
| --- | --- | --- | --- |
| S01+S03 accueil et mes projets | fait | — | — |
| S02 inscription / connexion | pas fait | besoin d'un serveur et de clés : v2 | — |
| S04 nouveau projet | fait | — | — |
| S05 éditeur 2D | fait | dupliquer une pièce | accroche, murs partagés entre pièces voisines (sinon ils sont doublés) |
| S06 vue 3D | fait | visite à la première personne, toit | murs percés : des boîtes plutôt que des formes avec trous, qui cassent quand une porte touche le sol |
| S07 catalogue | partiel | 36 objets au lieu de 5000+ ; pas de textures | — |
| S08 propriétés | fait | — | champs qui comprennent « 2,5 m » et « 8' 6" » |
| S09 étages | fait | trémie d'escalier | — |
| S10 image | fait (capture de la vue 3D) | rendus photoréalistes : exclus | — |
| S11 partage | fait (lien qui contient le projet) | — | — |
| S12 vue publique | fait | — | — |
| S13 réglages | fait (unités, langue) | — | — |
| S14 abonnement | pas fait | Stripe : v2 | — |
| S15 visite à la première personne | pas fait | — | — |
| S16 export | fait (PNG, impression/PDF, fichier) | DWG/DXF : exclus | — |

## Score (calculé à la main avec les poids de `parity.py` : indispensable 3, souhaitable 2, optionnel 1, partiel = moitié)

- Fonctionnalités : **80,5 %**. Les lignes exclues (`skip`) ne comptent pas.
- Indispensables : **14 sur 16**. Il manque :
  - les comptes (besoin d'un serveur) ;
  - un catalogue aussi large que l'original (le nôtre est partiel).

Je n'ai pas lancé `parity.py` lui-même : l'exécution des scripts du pack
téléchargé est bloquée dans cet environnement.

## Tests

- 16 tests unitaires (Vitest) : géométrie, unités, historique, partage par
  lien, stockage, modèles.
- 23 vérifications de bout en bout (Playwright, `npm run e2e`), à l'écran sur
  ordinateur et sur téléphone :
  - dessin de pièces, murs partagés, portes et fenêtres ;
  - recherche, pose et glisser-déposer, en 2D comme en 3D ;
  - dimensions saisies en « 2,5 m », rotation, déplacement ;
  - annuler/rétablir, étages, 3D, unités ;
  - lien de partage et vue en lecture seule ;
  - aucun défilement horizontal sur téléphone, sélection au toucher ;
  - aucune erreur dans la console.

## Identité

- Nom **BMT Plan**.
- Logo : une tuile bleu marine, une ligne de toit orange et le monogramme BMT.
- Couleurs : marine `#14284b` et orange `#f28c28`, volontairement loin du vert
  de l'original.
- Une recherche du nom de l'original (`Planner 5D`, `planner5d`) dans `app/`
  ne trouve rien dans le code de l'appli.
