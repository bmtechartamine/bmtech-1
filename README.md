# 📡 BM Radar

Outil personnel de recherche de produits et de suivi des concurrents pour **Amazon Europe**
(France, Belgique, Allemagne, Italie, Espagne, Pays-Bas).

Il utilise uniquement l'**API officielle d'Amazon (SP-API)**, gratuite avec un compte vendeur.
Il n'y a aucun abonnement à payer.

## Fonctionnalités

| Onglet | Ce que ça fait |
|---|---|
| 🔍 **Recherche produits** | Recherche par mot-clé ou ASIN (jusqu'à 60 produits) : prix, BSR, vendeurs, présence d'Amazon, **ventes et CA mensuels estimés**. Filtres (prix, BSR, ventes, vendeurs, sans Amazon), **score d'opportunité sur 10**, **parts de marché par marque**, mots-clés des concurrents et export CSV pour Excel. |
| 🌍 **Comparateur Europe** | Un ASIN sur les 6 marketplaces en un clic : où il se vend le mieux, et les pays où il est **absent** (opportunités). |
| 📈 **Suivi concurrents** | Historique du BSR, du prix et des vendeurs, ventes estimées par jour, **tendance sur 7 jours** et export CSV. |
| 🔔 **Alertes** | Créées automatiquement : changement de prix, rupture de stock, nouveau vendeur, arrivée ou départ d'Amazon. |
| 🔑 **Mots-clés** | Ce que les clients tapent vraiment dans la recherche Amazon, avec un score de popularité. |
| ✍️ **Optimiseur de fiche** | Vérifie ton titre, tes points clés et tes termes cachés selon les règles Amazon. Note sur 100 et mots-clés manquants. |
| 🧮 **Calculateur de marge** | Frais Amazon réels (FBA ou FBM), prix Buy Box actuel, TVA, coûts, pub → bénéfice, marge, ROI, budget pub maximum et bénéfice mensuel. |
| 🎯 **Calibration** | Tes ventes réelles corrigent toutes les estimations. |

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

- Si ton navigateur propose de « traduire » la page, refuse : elle est déjà en français.
- L'onglet Mots-clés utilise les suggestions de la barre de recherche Amazon. Ce service n'est pas officiel
  et peut changer sans prévenir.

- L'API officielle ne donne **pas** le nombre d'avis ni la note des produits.
- Elle ne donne pas non plus le **volume de recherche des mots-clés**.
- Une recherche par mot-clé renvoie 20 produits au maximum.
- Le chargement des prix prend environ 2 secondes par produit, à cause des quotas Amazon.
- Les ventes sont des **estimations**, comme dans tous les outils de ce type.

## Prochaines étapes possibles

- Calibration automatique avec tes ventes (API Sales d'Amazon).
- Alertes envoyées par e-mail ou sur Telegram.
- Générateur de fiche produit (titre, points clés, mots-clés) par IA.
- Extension Chrome affichant les estimations directement sur amazon.fr.

## Développement

```bash
python -m pytest
```
