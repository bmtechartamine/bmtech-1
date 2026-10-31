"""Analyse d'un marché à partir des résultats de recherche : score d'opportunité, marques, mots-clés."""
from __future__ import annotations

import math
import re
from collections import defaultdict

STOPWORDS = set("""
a au aux avec ce ces dans de des du en et for la le les leur lot l d un une par pour sans sur the to of and with
ou où plus pas est son sa ses se qui que x cm mm ml kg pcs pièces pièce
""".split())

WORD_RE = re.compile(r"[a-zà-öø-ÿœæ0-9][a-zà-öø-ÿœæ0-9'\-]*", re.IGNORECASE)


def _price(r: dict) -> float | None:
    return r.get("buybox_price") or r.get("lowest_price")


def apply_filters(rows: list[dict], price_min=None, price_max=None, bsr_max=None, sales_min=None,
                  sellers_max=None, exclude_amazon=False) -> list[dict]:
    out = []
    for r in rows:
        p = _price(r)
        if price_min is not None and (p is None or p < price_min):
            continue
        if price_max is not None and (p is None or p > price_max):
            continue
        if bsr_max is not None and (not r.get("bsr") or r["bsr"] > bsr_max):
            continue
        if sales_min is not None and (r.get("est_monthly_sales") or 0) < sales_min:
            continue
        if sellers_max is not None and (r.get("offer_count") or 0) > sellers_max:
            continue
        if exclude_amazon and r.get("amazon_selling"):
            continue
        out.append(r)
    return out


def brand_shares(rows: list[dict]) -> list[dict]:
    sales: dict[str, float] = defaultdict(float)
    for r in rows:
        sales[r.get("brand") or "Inconnue"] += r.get("est_monthly_sales") or 0
    total = sum(sales.values())
    return sorted(
        ({"brand": b, "sales": s, "share": s / total if total else 0.0} for b, s in sales.items()),
        key=lambda x: -x["sales"],
    )


def _clamp(x: float) -> float:
    return max(0.0, min(10.0, x))


def opportunity(rows: list[dict]) -> dict | None:
    """Score de 0 à 10 : forte demande + concurrence partagée + peu d'Amazon + prix confortable = bonne niche."""
    selling = sorted((r for r in rows if r.get("est_monthly_sales")), key=lambda r: -r["est_monthly_sales"])
    if len(selling) < 3:
        return None
    top = selling[:10]
    total = sum(r["est_monthly_sales"] for r in selling)

    median_sales = top[len(top) // 2]["est_monthly_sales"]
    demand = _clamp(math.log10(max(median_sales, 1) / 10) / 2 * 10)  # 10/mois -> 0, 1000/mois -> 10

    top3_share = sum(r["est_monthly_sales"] for r in selling[:3]) / total
    concentration = _clamp((1 - top3_share) / 0.7 * 10)  # top 3 = 30 % -> 10, 100 % -> 0

    top_brand = brand_shares(selling)[0]
    brand = _clamp((1 - top_brand["share"]) / 0.8 * 10)

    with_offers = [r for r in top if r.get("amazon_selling") is not None]
    amazon_share = sum(1 for r in with_offers if r["amazon_selling"]) / len(with_offers) if with_offers else 0.0
    amazon = _clamp((1 - amazon_share) * 10)

    prices = [p for p in (_price(r) for r in top) if p]
    avg_price = sum(prices) / len(prices) if prices else None
    if avg_price is None:
        price = 5.0
    elif 15 <= avg_price <= 60:
        price = 10.0
    elif 10 <= avg_price < 15 or 60 < avg_price <= 100:
        price = 6.0
    else:
        price = 3.0

    score = 0.35 * demand + 0.25 * concentration + 0.15 * brand + 0.15 * amazon + 0.10 * price
    verdict = "Très prometteur" if score >= 7 else "À creuser" if score >= 5 else "Difficile"
    return {
        "score": round(score, 1),
        "verdict": verdict,
        "criteria": [
            {"critère": "Demande", "valeur": f"{median_sales:.0f} ventes/mois (médiane du top 10)", "note": round(demand, 1)},
            {"critère": "Concentration", "valeur": f"Top 3 = {top3_share:.0%} des ventes", "note": round(concentration, 1)},
            {"critère": "Marque dominante", "valeur": f"{top_brand['brand']} = {top_brand['share']:.0%}", "note": round(brand, 1)},
            {"critère": "Présence d'Amazon", "valeur": f"{amazon_share:.0%} du top 10", "note": round(amazon, 1)},
            {"critère": "Prix moyen", "valeur": "—" if avg_price is None else f"{avg_price:.2f} €", "note": round(price, 1)},
        ],
    }


def _terms(title: str) -> set[str]:
    words = [w.strip("'-").lower() for w in WORD_RE.findall(title or "")]
    words = [w for w in words if len(w) >= 3 and w not in STOPWORDS and not w.isdigit()]
    return set(words) | {f"{a} {b}" for a, b in zip(words, words[1:])}


def title_keywords(rows: list[dict], limit: int = 50) -> list[dict]:
    """Mots et expressions les plus présents dans les titres des concurrents, pondérés par leurs ventes."""
    count: dict[str, int] = defaultdict(int)
    weighted: dict[str, float] = defaultdict(float)
    for r in rows:
        for term in _terms(r.get("title") or ""):
            count[term] += 1
            weighted[term] += r.get("est_monthly_sales") or 0
    terms = [t for t in count if count[t] >= 2]
    terms.sort(key=lambda t: (-weighted[t], -count[t]))
    return [{"keyword": t, "products": count[t], "sales_weight": round(weighted[t])} for t in terms[:limit]]
