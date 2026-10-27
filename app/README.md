# BMT Plan

Dessinez un logement en 2D, meublez-le et visitez-le en 3D, dans le navigateur.
C'est une reconstruction indépendante du cœur fonctionnel des planificateurs
d'intérieur 2D/3D, faite par BM Tech. Le code, le catalogue, les textes et
l'identité visuelle sont tous originaux.

## Ce que fait l'appli

- **Projets** : liste avec vignettes, création (vierge, studio, T3),
  renommer, dupliquer, supprimer, importer et exporter un fichier `.bmtplan`.
- **Plan 2D** :
  - pièces tracées en glissant (rectangle) ou en cliquant les angles (toute forme) ;
  - murs libres ;
  - accroche aux coins, aux murs, aux axes et à une grille de 5 cm ;
  - cotes et surfaces ;
  - les murs communs à deux pièces ne sont pas doublés.
- **Portes et fenêtres** : 8 modèles, à poser sur un mur puis à faire glisser
  le long de celui-ci. Le sens d'ouverture des portes est inversable.
- **Catalogue** : 36 objets générés par le code (salon, chambre, cuisine, salle
  de bain, salle à manger, bureau, déco, escalier). Recherche sans accents.
  On pose un objet par clic ou par glisser-déposer, en 2D comme en 3D.
- **Propriétés** :
  - dimensions, hauteur du sol, rotation et couleur de chaque objet ;
  - longueur, épaisseur, hauteur et couleur des murs ;
  - nom de la pièce et couleur du sol.

  Les champs acceptent « 2,5 m », « 250 », « 8' 6" »…
- **3D** : murs réellement percés pour les portes et fenêtres, ombres, orbite
  et zoom, image PNG de la vue.
- **Étages** : jusqu'à 6. L'étage du dessous apparaît en transparence.
- **Partage** : un lien en lecture seule qui contient le projet lui-même, donc
  sans serveur. On peut copier le projet partagé dans ses propres projets.
- **Export** : plan en PNG, impression ou PDF, fichier projet.
- **Autres** : annuler/rétablir (100 étapes), unités métriques et impériales,
  français et anglais, utilisable sur téléphone (toucher, pincer pour zoomer).

Les projets sont enregistrés dans le navigateur (`localStorage`). Ils restent
sur l'appareil qui les a créés.

## Lancer

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires (géométrie, unités, partage, historique, modèles)
npm run build      # site statique dans dist/
```

Pour les tests de bout en bout (Playwright, captures dans `e2e/out/`) :

```bash
npm run build && npx vite preview --port 4173 &
npm run e2e
```

## Mettre en ligne

`npm run build` produit un dossier `dist/` entièrement statique, avec des
chemins relatifs. Il peut être servi par n'importe quel hébergeur : Hostinger
(on dépose le contenu de `dist/` dans `public_html`), Netlify, Vercel,
Cloudflare Pages ou GitHub Pages. Il n'y a ni serveur ni clé à configurer.

## Organisation

```
src/model/      données, géométrie, unités, historique, stockage, partage (sans interface, testé)
src/catalog/    le catalogue, le dessin 2D vu de dessus, les modèles 3D
src/editor/     l'éditeur : état, plan 2D interactif, vue 3D, panneaux
src/pages/      accueil et liste des projets
src/ui/         petits composants : DOM, icônes, logo, fenêtres, messages
tests/          tests unitaires (Vitest)
e2e/            parcours de bout en bout (Playwright)
```

## Pour la suite (v2)

- Comptes et sauvegarde sur serveur, pour retrouver ses projets sur tous ses
  appareils. L'interface `ProjectStore` est prête à être branchée sur
  Supabase.
- Formule payante avec Stripe.
- Textures pour les sols et les murs, et un catalogue plus large en modèles
  glTF libres de droits.
- Visite à la première personne, toit, trémie d'escalier.
