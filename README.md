# 📡 BM Radar

Outil personnel de recherche de produits et de suivi des concurrents pour **Amazon Europe**
(France, Belgique, Allemagne, Italie, Espagne, Pays-Bas).

Il utilise uniquement l'**API officielle d'Amazon (SP-API)**, gratuite avec un compte vendeur.
Il n'y a aucun abonnement à payer.

## Fonctionnalités

| Onglet | Ce que ça fait |
|---|---|
| 🔍 **Recherche produits** | Recherche par mot-clé ou par ASIN. Affiche le prix, le BSR, la catégorie, le nombre de vendeurs (dont FBA), si Amazon vend lui-même, et les **ventes et le CA mensuels estimés**. Donne aussi un résumé du marché. |
| 📈 **Suivi concurrents** | Suit des ASIN dans le temps : historique du BSR, du prix et des vendeurs, et **ventes estimées par jour**. |
| 🧮 **Calculateur de marge** | Frais Amazon réels (FBA ou FBM) via l'API, TVA, coût produit, transport, pub → bénéfice, marge, ROI, et budget pub maximum par vente. |
| 🎯 **Calibration** | Tu entres les ventes réelles de tes propres produits. L'outil corrige alors toutes ses estimations. |

### Comment les ventes des concurrents sont estimées

Personne (ni Jungle Scout, ni Helium 10) ne connaît les vraies ventes de tes concurrents : tout le monde
les **estime**. BM Radar utilise deux méthodes :

1. **Modèle BSR → ventes** : plus le classement est bas, plus le produit vend. Les coefficients de départ
   sont approximatifs. **Calibre-les** avec 3 à 5 de tes produits pour obtenir des chiffres justes sur ton marché.
2. **Comptage des chutes de BSR** : à chaque vente, le BSR chute d'un coup. Avec un relevé **toutes les heures**,
   l'outil compte ces chutes. C'est la méthode la plus précise pour les produits qui vendent peu
   (moins d'environ 5 ventes par jour). Elle est choisie automatiquement quand elle est fiable.

L'historique commence le jour où tu ajoutes un produit au suivi. Plus le relevé tourne longtemps,
plus les chiffres sont précis.

## Installation (Windows, Mac ou Linux)

1. Installe **Python 3.11 ou plus récent** depuis https://www.python.org/downloads/
   (sous Windows, coche « Add Python to PATH »).
2. Télécharge ce projet, puis ouvre un terminal dans son dossier et lance :

```bash
pip install -r requirements.txt
```

3. Copie `.env.example` en `.env` et remplis tes identifiants (voir la section suivante).

## Connexion à Amazon (une seule fois, gratuit)

1. Seller Central → **Applications et services → Développer des applications**.
2. Inscris-toi comme **développeur privé** (« application pour ma propre entreprise »).
   Rôles à demander : **Product Listing** et **Pricing**. Amazon valide la demande en quelques jours.
3. Crée une application (« Ajouter un nouveau client d'application », type SP-API).
   Tu obtiens le **Client ID** et le **Client Secret**.
4. Sur la ligne de l'application, clique sur **Autoriser** pour générer le **Refresh Token**.
5. Colle ces trois valeurs dans le fichier `.env`.

> Ne partage jamais ton fichier `.env` : il donne accès à ton compte vendeur. Il est exclu de Git.

## Utilisation

Lancer l'application (elle s'ouvre dans ton navigateur) :

```bash
streamlit run app.py
```

Lancer le relevé automatique des produits suivis (une fois par heure), **dans un second terminal** à laisser ouvert :

```bash
python -m bmradar.tracker
```

Options : `--interval 30` pour un relevé toutes les 30 minutes, `--once` pour un seul relevé.
Le relevé ne tourne que quand ton ordinateur est allumé. Pour un suivi 24h/24, on pourra plus tard
l'installer sur un petit serveur (environ 5 €/mois).

## Limites connues

- L'API officielle ne donne **pas** le nombre d'avis ni la note des produits.
- Elle ne donne pas non plus le **volume de recherche des mots-clés**.
- Une recherche par mot-clé renvoie 20 produits au maximum.
- Le chargement des prix prend environ 2 secondes par produit, à cause des quotas Amazon.
- Les ventes sont des **estimations**, comme dans tous les outils de ce type.

## Prochaines étapes possibles

- Calibration automatique avec tes ventes (API Sales d'Amazon).
- Alertes : changement de prix, rupture de stock ou nouveau vendeur chez un concurrent.
- Générateur de fiche produit (titre, points clés, mots-clés) par IA.
- Extension Chrome affichant les estimations directement sur amazon.fr.

## Développement

```bash
python -m pytest
```
