"""Transforme les réponses JSON de la SP-API en dictionnaires simples."""
from __future__ import annotations


def _for_marketplace(entries: list | None, marketplace_id: str) -> dict:
    entries = entries or []
    for entry in entries:
        if entry.get("marketplaceId") == marketplace_id:
            return entry
    return entries[0] if entries else {}


def parse_catalog_item(item: dict, marketplace_id: str) -> dict:
    summary = _for_marketplace(item.get("summaries"), marketplace_id)
    ranks = _for_marketplace(item.get("salesRanks"), marketplace_id)
    images = _for_marketplace(item.get("images"), marketplace_id).get("images") or []

    main = (ranks.get("displayGroupRanks") or [{}])[0]
    sub = (ranks.get("classificationRanks") or [{}])[0]
    image = next((i.get("link") for i in images if i.get("variant") == "MAIN"), None)
    if image is None and images:
        image = images[0].get("link")

    return {
        "asin": item.get("asin"),
        "title": summary.get("itemName"),
        "brand": summary.get("brand") or summary.get("brandName"),
        "image": image,
        "bsr": main.get("rank"),
        "category": main.get("title"),
        "display_group": main.get("websiteDisplayGroup"),
        "sub_rank": sub.get("rank"),
        "sub_category": sub.get("title"),
    }


def _amount(price: dict | None) -> float | None:
    if not price:
        return None
    value = price.get("Amount")
    return float(value) if value is not None else None


def parse_offers(response: dict, amazon_seller_id: str | None = None) -> dict:
    payload = response.get("payload", response)
    summary = payload.get("Summary") or {}
    offers = payload.get("Offers") or []

    buybox = next((b for b in summary.get("BuyBoxPrices") or [] if b.get("condition", "New").lower() == "new"), None)
    lowest = [_amount(p.get("LandedPrice")) for p in summary.get("LowestPrices") or [] if p.get("condition", "new").lower() == "new"]
    lowest = [p for p in lowest if p is not None]
    fba_count = sum(
        n.get("OfferCount", 0)
        for n in summary.get("NumberOfOffers") or []
        if n.get("fulfillmentChannel") == "Amazon" and n.get("condition", "new").lower() == "new"
    )

    return {
        "buybox_price": _amount(buybox.get("LandedPrice")) if buybox else None,
        "lowest_price": min(lowest) if lowest else None,
        "offer_count": summary.get("TotalOfferCount", len(offers)),
        "fba_offer_count": fba_count,
        "amazon_selling": bool(amazon_seller_id) and any(o.get("SellerId") == amazon_seller_id for o in offers),
    }


def parse_fees(response: dict) -> dict:
    result = response.get("payload", response).get("FeesEstimateResult") or {}
    if result.get("Status") != "Success":
        error = (result.get("Error") or {}).get("Message", "réponse inattendue")
        raise ValueError(f"Amazon n'a pas pu calculer les frais : {error}")
    estimate = result["FeesEstimate"]
    details = {}
    for fee in estimate.get("FeeDetailList") or []:
        amount = _amount(fee.get("FinalFee") or fee.get("FeeAmount")) or 0.0
        details[fee.get("FeeType", "Autre")] = details.get(fee.get("FeeType", "Autre"), 0.0) + amount
    return {"total": _amount(estimate.get("TotalFeesEstimate")) or 0.0, "details": details}
