#!/usr/bin/env bash
# Installation du kit Reels LEINOR sur le VPS (Ubuntu/Debian)
set -e
cd "$(dirname "$0")"
sudo apt-get update -y && sudo apt-get install -y ffmpeg python3 python3-requests curl jq
mkdir -p assets work logs
curl -fsSL -o assets/CormorantSB.ttf https://github.com/CatharsisFonts/Cormorant/raw/master/fonts/ttf/CormorantGaramond-SemiBold.ttf
curl -fsSL -o assets/MontserratSB.ttf https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-SemiBold.ttf
curl -fsSL -o assets/logo.png https://leinor.com/wp-content/uploads/2026/10/leinor-logo-or-fonce.png
curl -fsSL -o assets/music1.mp3 https://d8j0ntlcm91z4.cloudfront.net/user_3KC1NP5zRUHBjaeZwL6xcoptQUU/hf_20261111_190100_cc2e99ef-dd49-4ca3-838e-1c40f7685e18.mp3
curl -fsSL -o assets/music2.mp3 https://d8j0ntlcm91z4.cloudfront.net/user_3KC1NP5zRUHBjaeZwL6xcoptQUU/hf_20261111_203951_6180fe84-2bf6-4a64-abe5-f6a17166a026.mp3
[ -f .env ] || cp .env.example .env
chmod 600 .env
echo "Installation terminée. Remplis le fichier .env (voir README), puis : python3 publish_meta.py --check"
