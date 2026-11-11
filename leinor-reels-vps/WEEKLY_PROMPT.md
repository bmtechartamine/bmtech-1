Tu prépares les Reels LEINOR de la semaine prochaine. Travaille dans le dossier ~/leinor-reels-vps. Ne publie rien toi-même : tu ajoutes seulement les Reels dans queue.json, le script publish_meta.py les publie à l'heure prévue.

1. Produits : récupère les produits publiés et en stock avec
   curl -s "https://leinor.com/wp-json/wc/store/v1/products?per_page=100"
   (nom, prix, stock, images, catégories). Ignore ceux en rupture de stock.
2. Choisis 4 produits. Priorité aux produits qui n'ont jamais eu de Reel, puis à ceux dont le dernier Reel est le plus ancien (historique : champ "product" de queue.json). Alterne bijoux et sacs quand c'est possible.
3. Dates : la date du dernier Reel de queue.json + 2 jours, puis +2 jours, etc. Heure : 18:30. Format "AAAA-MM-JJTHH:MM:SS".
4. Pour chaque produit :
   a. Higgsfield : importe la photo principale (media_import_url), puis génère un clip avec generate_video :
      model kling3_0, mode std, sound off, duration 5, aspect_ratio 9:16, la photo en start_image.
      Prompt bijoux : "Luxury jewelry commercial. The elegant woman slowly turns her head slightly toward the camera with a soft confident smile, subtle natural breathing. Warm studio light glides across her jewelry, making it shine and glint. Very slow cinematic push-in. Jewelry stays exactly identical in shape and detail. No text."
      Pour un sac ou un produit sans mannequin : "Luxury product commercial, soft studio light glides across the product, very slow cinematic orbit and push-in, product stays exactly identical, no text."
   b. Télécharge le clip et 3 autres photos du produit dans work/<slug>/.
   c. Écris work/<slug>/config.json sur le modèle ci-dessous et lance : python3 make_reel.py work/<slug>/config.json
      {"out":"reel.mp4","music":"music1.mp3","end_dur":3.2,"end1":"Nouvelle collection","end2":"Boutique en ligne · lien en bio","end3":"Livraison offerte en Belgique dès 40 €",
       "segments":[
        {"src":"clip.mp4","still":false,"dur":5,"small":"NOUVEAUTÉ LEINOR","big":"<Nom court>"},
        {"src":"photo2.jpg","dur":2.4,"big":"<Matière ou point fort>"},
        {"src":"photo3.jpg","dur":2.4,"sub":"<Contenu ou détail>"},
        {"src":"photo4.jpg","dur":2.8,"fit":"square","big":"<Prix> €","bigsize":96,"bigcolor":"0xD9B56A","sub":"Plus que <stock> pièces disponibles"}]}
      Alterne music1.mp3 et music2.mp3. Si le stock est supérieur à 5, remplace la dernière ligne par "Livraison offerte dès 40 €". Tous les textes en français. Si le produit a moins de 4 photos, réutilise une photo.
   d. Vérifie le résultat (durée ~14 s, 1080x1920, son présent) et regarde 2 images extraites avec ffmpeg.
   e. Mets la vidéo en ligne sur Higgsfield : media_upload (filename leinor-reel-<slug>.mp4), PUT du fichier sur l'upload_url avec curl, puis media_confirm. Garde l'URL publique (https://d2ol7oe51mr4n9.cloudfront.net/...mp4).
   f. Ajoute à queue.json : {"product":"<slug>","title":"<Nom>","publish_at":"...","video_url":"<URL>","caption":"<texte>","facebook":null,"instagram":null}
      Texte : 
      <Nom> ✨ <Matière>
      <Une phrase de description tirée de la fiche>
      💛 <Prix> € – <plus que X pièces disponibles | rareté seulement si stock ≤ 5>
      🚚 Livraison offerte en Belgique dès 40 €
      👉 Boutique en ligne : lien en bio
      #leinor + 5 hashtags adaptés au produit
      N'invente aucune caractéristique qui n'est pas sur la fiche produit. Pas de lien dans le texte.
5. Budget : maximum 50 crédits Higgsfield par semaine. Si le solde (balance) est sous 60 crédits, ne génère rien et écris-le dans le récapitulatif.
6. Termine par un récapitulatif court en français : les 4 Reels ajoutés (produit, date, URL vidéo), crédits restants, et les erreurs éventuelles. Écris-le aussi dans logs/weekly-<date>.md.
