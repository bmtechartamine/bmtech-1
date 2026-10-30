"""Configuration : marketplaces européennes et lecture du fichier .env."""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Marketplace:
    code: str
    id: str
    domain: str
    vat: float
    # Taille approximative du marché comparée à amazon.fr (sert à l'estimation des ventes).
    volume_factor: float
    # Identifiant vendeur d'Amazon lui-même (Amazon Retail), pour savoir si Amazon vend le produit.
    amazon_seller_id: str | None = None


MARKETPLACES: dict[str, Marketplace] = {
    "FR": Marketplace("FR", "A13V1IB3VIYZZH", "amazon.fr", 0.20, 1.0, "A1X6FK5RDHNB96"),
    "BE": Marketplace("BE", "AMEN7PMS3EDWL", "amazon.com.be", 0.21, 0.08),
    "DE": Marketplace("DE", "A1PA6795UKMFR9", "amazon.de", 0.19, 1.8, "A3JWKAKR8XB7XF"),
    "IT": Marketplace("IT", "APJ6JRA9NG5V4", "amazon.it", 0.22, 0.8, "A11IL2PNWYJU7H"),
    "ES": Marketplace("ES", "A1RKKUPIHCS9HS", "amazon.es", 0.21, 0.7, "A1AT7YVPFBWXBL"),
    "NL": Marketplace("NL", "A1805IZSGTT6HS", "amazon.nl", 0.21, 0.15),
}

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "bmradar.db"))


def spapi_credentials() -> dict[str, str | None]:
    return {
        "client_id": os.getenv("SPAPI_CLIENT_ID"),
        "client_secret": os.getenv("SPAPI_CLIENT_SECRET"),
        "refresh_token": os.getenv("SPAPI_REFRESH_TOKEN"),
    }
