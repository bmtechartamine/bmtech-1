"""Relevé automatique des produits suivis (BSR, prix, vendeurs).

À laisser tourner en arrière-plan :  python -m bmradar.tracker
Un relevé par heure est nécessaire pour compter les ventes par « chutes de BSR ».
"""
from __future__ import annotations

import argparse
import time

from . import alerts, db, parsers
from .config import MARKETPLACES
from .spapi import SPAPIClient, SPAPIError


def fetch_snapshot(client, asin: str, marketplace: str) -> tuple[dict, dict]:
    """Renvoie (infos produit, relevé)."""
    mp = MARKETPLACES[marketplace]
    info = parsers.parse_catalog_item(client.get_catalog_item(asin, mp.id), mp.id)
    snap = {k: info[k] for k in ("bsr", "category", "sub_rank", "sub_category")}
    try:
        snap.update(parsers.parse_offers(client.get_item_offers(asin, mp.id), mp.amazon_seller_id))
    except SPAPIError:
        pass  # pas d'offre active en ce moment : on garde quand même le BSR
    return info, snap


def update_all(conn, client, marketplace: str | None = None, log=print) -> tuple[int, list[str]]:
    ok, errors = 0, []
    for product in db.list_products(conn, marketplace):
        asin, mp = product["asin"], product["marketplace"]
        try:
            info, snap = fetch_snapshot(client, asin, mp)
            db.add_product(conn, asin, mp, info)
            db.add_snapshot(conn, asin, mp, snap)
            for _, message in alerts.check(conn, asin, mp):
                log(f"ALERTE {mp} {asin} : {message}")
            ok += 1
            log(f"{mp} {asin} : BSR {snap.get('bsr')}, prix {snap.get('buybox_price')}")
        except SPAPIError as e:
            errors.append(f"{mp} {asin} : {e}")
            log(f"ERREUR {mp} {asin} : {e}")
    return ok, errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Relève les produits suivis à intervalle régulier.")
    parser.add_argument("--interval", type=int, default=60, help="minutes entre deux relevés (défaut : 60)")
    parser.add_argument("--once", action="store_true", help="un seul relevé puis arrêt")
    args = parser.parse_args()

    conn = db.connect()
    client = SPAPIClient.from_env()
    while True:
        start = time.time()
        ok, errors = update_all(conn, client)
        print(f"[{db.now()}] {ok} produit(s) mis à jour, {len(errors)} erreur(s)")
        if args.once:
            break
        time.sleep(max(0, args.interval * 60 - (time.time() - start)))


if __name__ == "__main__":
    main()
