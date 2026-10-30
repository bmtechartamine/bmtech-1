"""Recherche de produits (par mot-clé ou ASIN) avec estimation des ventes et du chiffre d'affaires."""
from __future__ import annotations

import re

from . import estimator, parsers
from .config import Marketplace
from .spapi import SPAPIError

ASIN_RE = re.compile(r"^(B0[A-Z0-9]{8}|\d{9}[\dX])$")


def is_asin(text: str) -> bool:
    return bool(ASIN_RE.match(text.strip().upper()))


def research(client, query: str, mp: Marketplace, with_offers: bool, calib_points: list[dict], progress=None) -> list[dict]:
    query = query.strip()
    if is_asin(query):
        items = [client.get_catalog_item(query.upper(), mp.id)]
    else:
        items = client.search_catalog(query, mp.id).get("items") or []

    rows = []
    for i, item in enumerate(items):
        row = parsers.parse_catalog_item(item, mp.id)
        row.update(buybox_price=None, lowest_price=None, offer_count=None, fba_offer_count=None, amazon_selling=None)
        if with_offers:
            try:
                row.update(parsers.parse_offers(client.get_item_offers(row["asin"], mp.id), mp.amazon_seller_id))
            except SPAPIError:
                pass  # produit sans offre active : on garde les autres infos
        calib = estimator.calibration_factor(calib_points, row["display_group"])
        daily = estimator.model_daily_sales(row["bsr"], row["display_group"], mp.code, calib)
        price = row["buybox_price"] or row["lowest_price"]
        row["est_monthly_sales"] = round(daily * 30)
        row["est_monthly_revenue"] = round(daily * 30 * price) if price else None
        rows.append(row)
        if progress:
            progress((i + 1) / len(items))
    return rows


def market_summary(rows: list[dict]) -> dict:
    prices = [r["buybox_price"] or r["lowest_price"] for r in rows if r.get("buybox_price") or r.get("lowest_price")]
    bsrs = [r["bsr"] for r in rows if r.get("bsr")]
    return {
        "products": len(rows),
        "monthly_sales": sum(r.get("est_monthly_sales") or 0 for r in rows),
        "monthly_revenue": sum(r.get("est_monthly_revenue") or 0 for r in rows),
        "avg_price": sum(prices) / len(prices) if prices else None,
        "median_bsr": sorted(bsrs)[len(bsrs) // 2] if bsrs else None,
        "amazon_selling": sum(1 for r in rows if r.get("amazon_selling")),
    }
