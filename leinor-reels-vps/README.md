# Reels LEINOR automatiques sur le VPS

Ce dossier fait tourner les Reels LEINOR tout seuls, sans ton Mac et sans Chrome :

- **Chaque dimanche à 20h**, Claude Code prépare 4 nouveaux Reels pour la semaine suivante :
  - il choisit les produits en stock sur leinor.com ;
  - il fait l'animation IA avec Higgsfield ;
  - il fait le montage avec les textes et la musique ;
  - il ajoute les Reels au fichier `queue.json`.
- **Chaque jour à 18h30**, `publish_meta.py` publie le Reel prévu ce jour-là sur la Page Facebook Leinor.mode et sur Instagram @leinor.mode.

Les 5 Reels de la nouvelle collection sont déjà dans `queue.json` : du 12 au 20 novembre, un tous les 2 jours.

---

## 1. Copier le dossier sur le VPS

Mets le dossier `leinor-reels-vps` dans `/root/` sur le VPS (avec FileZilla, ou en demandant à Claude Code sur le VPS de le décompresser). Le dossier est aussi dans le dépôt GitHub `bmtech-1` : sur le VPS, `git clone` le dépôt puis `cp -r bmtech-1/leinor-reels-vps /root/`. Ensuite :

```bash
cd /root/leinor-reels-vps
sudo timedatectl set-timezone Europe/Brussels
bash setup.sh
```

## 2. Connecter Higgsfield à Claude Code (une seule fois)

Sur le VPS, dans Claude Code : ajoute le connecteur MCP Higgsfield en suivant la page d'aide Higgsfield « How do I connect Higgsfield to AI agent ». Donne-lui le nom `higgsfield` et connecte-toi avec ton compte Higgsfield. Vérifie ensuite avec `claude mcp list`.

## 3. Autoriser la publication sur Facebook et Instagram (une seule fois, environ 15 min)

C'est toi qui fais cette étape, car elle donne un accès à ta page. Ne communique le token à personne, même pas dans une conversation.

1. Va sur **developers.facebook.com**, clique sur **Mes apps**, puis **Créer une app**, type **Entreprise**, et rattache-la au portefeuille **Leinor.mode**.
2. Ouvre **Outils**, puis **Explorateur de l'API Graph**. Choisis ton app, puis **Obtenir un token d'accès utilisateur** avec ces autorisations :
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`.
3. Dans l'explorateur, lance `me/accounts`. Copie l'`access_token` de la page **Leinor.mode**. C'est le token de la Page.
4. Rends-le permanent avec **Outils**, puis **Débogueur de token d'accès**, puis **Étendre le token d'accès**. Refais ensuite `me/accounts` avec le token long pour obtenir un token de Page qui n'expire pas.
5. Sur le VPS, ouvre le fichier `.env` (`nano .env`) et colle le token après `META_PAGE_TOKEN=`.
6. Vérifie :
   ```bash
   python3 publish_meta.py --check
   ```
   Le résultat doit afficher « Page : Leinor.mode » et l'ID Instagram relié. S'il est différent de `IG_USER_ID` dans `.env`, remplace-le.

## 4. Activer les tâches automatiques

```bash
crontab -e
```

Colle les lignes de `crontab.txt`, puis enregistre.

Pour tester sans rien publier : `python3 publish_meta.py --dry`

## Suivi

- Le journal des publications est dans `logs/publish.log`.
- Le récapitulatif de chaque dimanche est dans `logs/weekly-<date>.md`.
- Pour annuler un Reel prévu, supprime son bloc dans `queue.json` avant la date.
- Pour mettre l'automatisation en pause, mets un `#` devant les lignes du `crontab`.

## Coûts

Chaque Reel coûte environ 8 à 10 crédits Higgsfield, soit environ 40 par semaine. Le dimanche, la préparation s'arrête toute seule si le solde passe sous 60 crédits.
