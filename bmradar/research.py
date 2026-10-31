"""Recherche de produits (par mot-clé ou ASIN) avec estimation des ventes et du chiffre d'affaires."""
from __future__ import annotations

import re

from . import estimator, parsers
from .config import MARKETPLACES, Marketplace
from .spapi import SPAPIError

ASIN_RE = re.compile(r"^(B0[A-Z0-9]{8}|\d{9}[\dX])$")


def is_asin(text: str) -> bool:
    return bool(ASIN_RE.match(text.strip().upper()))


def product_link(mp: Marketplace, asin: str) -> str:
    return f"https://www.{mp.domain}/dp/{asin}"


def enrich(row: dict, mp: Marketplace, calib_points: list[dict]) -> dict:
    """Ajoute ventes et CA estimés à une ligne produit."""
    calib = estimator.calibration_factor(calib_points, row.get("display_group"))
    daily = estimator.model_daily_sales(row.get("bsr"), row.get("display_group"), mp.code, calib)
    price = row.get("buybox_price") or row.get("lowest_price")
    row["est_monthly_sales"] = round(daily * 30)
    row["est_monthly_revenue"] = round(daily * 30 * price) if price else None
    row["link"] = product_link(mp, row["asin"])
    return row


def search_items(client, query: str, mp: Marketplace, pages: int = 1) -> list[dict]:
    query = query.strip()
    if is_asin(query):
        return [client.get_catalog_item(query.upper(), mp.id)]
    items, token = [], None
    for _ in range(pages):
        resp = client.search_catalog(query, mp.id, page_token=token)
        items += resp.get("items") or []
        token = (resp.get("pagination") or {}).get("nextToken")
        if not token:
            break
    return items


def research(client, query: str, mp: Marketplace, with_offers: bool, calib_points: list[dict],
             progress=None, pages: int = 1) -> list[dict]:
    items = search_items(client, query, mp, pages)
    rows, seen = [], set()
    for i, item in enumerate(items):
        row = parsers.parse_catalog_item(item, mp.id)
        if row["asin"] in seen:
            continue
        seen.add(row["asin"])
        row.update(buybox_price=None, lowest_price=None, offer_count=None, fba_offer_count=None, amazon_selling=None)
        if with_offers:
            try:
                row.update(parsers.parse_offers(client.get_item_offers(row["asin"], mp.id), mp.amazon_seller_id))
            except SPAPIError:
                pass  # produit sans offre active : on garde les autres infos
        rows.append(enrich(row, mp, calib_points))
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


def compare_marketplaces(client, asin: str, calib_points: list[dict], with_offers: bool = True, progress=None) -> list[dict]:
    """Le même ASIN sur toutes les marketplaces européennes : où se vend-il le mieux ?"""
    asin = asin.strip().upper()
    mps = list(MARKETPLACES.values())
    items: dict[str, dict] = {}
    try:
        item = client.get_catalog_item(asin, [m.id for m in mps])
        items = {m.code: item for m in mps}
    except SPAPIError:
        # Repli : un appel par pays (certains comptes ne sont pas ouverts partout).
        for m in mps:
            try:
                items[m.code] = client.get_catalog_item(asin, m.id)
            except SPAPIError:
                pass

    rows = []
    for i, m in enumerate(mps):
        row = {"marketplace": m.code, "domain": m.domain, "asin": asin, "available": False,
               "buybox_price": None, "lowest_price": None, "offer_count": None, "fba_offer_count": None,
               "amazon_selling": None}
        if m.code in items:
            row.update(parsers.parse_catalog_item(items[m.code], m.id, strict=True))
            row["asin"] = asin
            row["available"] = bool(row.get("bsr") or row.get("title"))
        if row["available"] and with_offers:
            try:
                row.update(parsers.parse_offers(client.get_item_offers(asin, m.id), m.amazon_seller_id))
            except SPAPIError:
                pass
        rows.append(enrich(row, m, calib_points))
        if progress:
            progress((i + 1) / len(mps))
    return rows
