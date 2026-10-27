# Architecture : BMT Plan (reconstruction du cœur de Planner 5D)

## Choix pour la version 1

La v1 tourne **entièrement dans le navigateur**. Elle ne demande aucun compte
ni aucune clé, se met en ligne comme un simple site statique et fonctionne
hors ligne. L'enregistrement passe par une interface `ProjectStore`. La v1 la
branche sur `localStorage`, et une v2 pourra la brancher sur un vrai serveur
(Supabase par exemple) sans toucher aux écrans.

| couche | choix | pourquoi |
| --- | --- | --- |
| langage | TypeScript | erreurs vues avant l'exécution |
| outil de build | Vite | rapide, site statique en sortie |
| interface | DOM + TypeScript, sans framework | l'éditeur est surtout un canevas ; peu de dépendances |
| 2D | Canvas 2D | dessin rapide du plan, zoom et déplacement |
| 3D | Three.js | standard du web 3D ; murs extrudés avec trous pour les ouvertures |
| catalogue | meubles **générés par le code** (boîtes, cylindres) | aucun problème de licence, poids nul, couleurs modifiables |
| enregistrement | `localStorage` derrière `ProjectStore` | pas de serveur pour la v1 |
| partage | projet compressé dans le lien (`#/view/…`) + export/import de fichier `.bmtplan` | partage sans serveur |
| langues | français (défaut), anglais | |
| tests | Vitest (géométrie, unités, partage, historique) + Playwright (parcours) | |
| hébergement | n'importe quel hébergeur statique (Vercel, Netlify, Hostinger) | |

## Données (un projet = un document JSON)

```
Project   id, name, units (metric | imperial), createdAt, updatedAt, thumbnail, floors[]
Floor     id, name, height, walls[], rooms[], openings[], items[]
Wall      id, a{x,y}, b{x,y}, thickness, height                (cm)
Room      id, name, points[{x,y}], floor (couleur du sol), wallColor
Opening   id, wallId, kind (door | window), offset (cm depuis a), width, height, sill
Item      id, catalogId, x, y, rotation (degrés), w, d, h, elevation, color
```

Toutes les longueurs sont stockées en **centimètres**. L'affichage convertit
en m ou en pieds et pouces.

## Écrans (IDs de la carte de reconnaissance)

| route | écrans |
| --- | --- |
| `#/` | S01 + S03 : accueil et mes projets, S04 : nouveau projet (vierge ou modèle) |
| `#/p/:id` | S05 éditeur 2D, S06 vue 3D, S07 catalogue, S08 propriétés, S09 étages, S10 image, S11 partage, S13 réglages, S16 export |
| `#/view/:data` | S12 : vue publique en lecture seule |

Pas encore construits : S02 (comptes) et S14 (abonnement). Ils ont besoin d'un
serveur, d'une base et de Stripe, donc des clés du propriétaire. Ce sera
`/replica-backend`.

## Les parties délicates

- **Accroche** : à la grille (5 cm) et aux extrémités de murs existantes
  (rayon de 15 px à l'écran). Les angles droits sont favorisés quand on tient
  Maj.
- **Murs partagés** : une pièce collée à une autre ne crée pas de mur en
  double si le mur existe déjà.
- **Ouvertures** : leur position est stockée le long du mur. Elles suivent
  donc le mur quand il bouge, et restent dans ses limites.
- **Annuler/rétablir** : un instantané de l'étage par action, 100 au maximum.
- **Performance 3D** : la scène n'est reconstruite qu'à l'ouverture de la vue
  3D ou après une modification.

## Ordre de construction

1. Tranche verticale : projet → tracer une pièce → poser un meuble → 3D → enregistrer.
2. Les autres indispensables : murs libres, portes et fenêtres, cotes, surfaces, unités.
3. Les souhaitables : étages, matériaux, partage, image, export, langues, mobile.
4. Les corrections de `/replica-entrepreneur`.
