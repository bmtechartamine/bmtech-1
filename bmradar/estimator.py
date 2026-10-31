"""Estimation des ventes d'un produit à partir de son classement des ventes (BSR).

Deux méthodes complémentaires :

1. Modèle BSR -> ventes : ventes/jour = A * facteur_catégorie * facteur_marketplace * BSR^-B.
   Les coefficients par défaut sont des approximations ; ils deviennent précis une fois
   calibrés avec tes propres ventes réelles (onglet « Calibration »).
2. Chutes de BSR : le classement remonte d'un coup à chaque vente puis redescend lentement.
   En relevant le BSR toutes les heures, on compte ces chutes. Très fiable pour les produits
   qui vendent peu (moins de ~5 ventes par jour), inutile pour les best-sellers.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta

from .config import MARKETPLACES

# Ventes par jour au BSR n°1 d'une grande catégorie sur amazon.fr (ordre de grandeur).
BASE_A = 6000.0
EXPONENT = 0.9

# Taille relative des catégories principales (clé = websiteDisplayGroup renvoyé par Amazon).
GROUP_FACTORS = {
    "home_display_on_website": 1.0,
    "kitchen_display_on_website": 1.0,
    "beauty_display_on_website": 1.0,
    "drugstore_display_on_website": 1.0,
    "toy_display_on_website": 1.0,
    "sports_display_on_website": 0.9,
    "fashion_display_on_website": 1.0,
    "shoes_display_on_website": 0.8,
    "ce_display_on_website": 0.9,
    "pc_display_on_website": 0.9,
    "wireless_display_on_website": 0.9,
    "book_display_on_website": 1.0,
    "baby_product_display_on_website": 0.6,
    "pet_products_display_on_website": 0.6,
    "home_improvement_display_on_website": 0.7,
    "lawn_and_garden_display_on_website": 0.6,
    "office_product_display_on_website": 0.5,
    "automotive_display_on_website": 0.5,
    "grocery_display_on_website": 0.6,
    "luggage_display_on_website": 0.4,
    "musical_instruments_display_on_website": 0.3,
}
DEFAULT_GROUP_FACTOR = 0.5

# En dessous de ce volume, une chute de BSR correspond quasiment à une vente.
DROP_METHOD_MAX_DAILY = 5.0
DROP_THRESHOLD = 0.2  # le BSR doit baisser d'au moins 20 % pour compter comme une vente


def model_daily_sales(bsr: int | None, display_group: str | None, marketplace: str, calibration: float = 1.0) -> float:
    if not bsr or bsr <= 0:
        return 0.0
    group = GROUP_FACTORS.get(display_group or "", DEFAULT_GROUP_FACTOR)
    volume = MARKETPLACES[marketplace].volume_factor if marketplace in MARKETPLACES else 1.0
    return BASE_A * group * volume * calibration * bsr ** -EXPONENT


def calibration_factor(points: list[dict], display_group: str | None) -> float:
    """Moyenne géométrique de (ventes réelles / ventes du modèle) sur tes produits connus.

    On utilise les points de la même catégorie s'il y en a, sinon tous les points.
    """
    usable = [p for p in points if p.get("bsr") and p.get("real_daily_sales")]
    same_group = [p for p in usable if p.get("display_group") == display_group]
    chosen = same_group or usable
    ratios = []
    for p in chosen:
        model = model_daily_sales(p["bsr"], p.get("display_group"), p["marketplace"])
        if model > 0:
            ratios.append(p["real_daily_sales"] / model)
    if not ratios:
        return 1.0
    return math.exp(sum(math.log(r) for r in ratios) / len(ratios))


def _parse_ts(ts) -> datetime:
    return ts if isinstance(ts, datetime) else datetime.fromisoformat(ts)


def count_rank_drops(history: list[tuple], threshold: float = DROP_THRESHOLD) -> tuple[int, float, float]:
    """history = [(horodatage, bsr), ...]. Renvoie (nb de chutes, jours couverts, écart moyen en heures)."""
    points = sorted(((_parse_ts(t), b) for t, b in history if b), key=lambda p: p[0])
    if len(points) < 2:
        return 0, 0.0, 0.0
    drops = sum(1 for (_, prev), (_, cur) in zip(points, points[1:]) if cur < prev * (1 - threshold))
    days = (points[-1][0] - points[0][0]).total_seconds() / 86400
    avg_gap_h = days * 24 / (len(points) - 1)
    return drops, days, avg_gap_h


def estimate_sales(history: list[tuple], display_group: str | None, marketplace: str, calibration: float = 1.0) -> dict:
    """Combine les deux méthodes et choisit la plus fiable."""
    valid = [(t, b) for t, b in history if b]
    if not valid:
        return {"daily": 0.0, "monthly": 0.0, "method": "aucune donnée", "model_daily": 0.0, "drops_daily": None}

    recent = sorted(valid, key=lambda p: _parse_ts(p[0]))[-24 * 7:]
    bsrs = sorted(b for _, b in recent)
    median_bsr = bsrs[len(bsrs) // 2]
    model = model_daily_sales(median_bsr, display_group, marketplace, calibration)

    drops, days, gap_h = count_rank_drops(valid)
    drops_daily = drops / days if days >= 2 and gap_h <= 2 else None

    if drops_daily is not None and model <= DROP_METHOD_MAX_DAILY:
        daily, method = drops_daily, "chutes de BSR"
    else:
        daily, method = model, "modèle BSR" + (" calibré" if calibration != 1.0 else "")
    return {"daily": daily, "monthly": daily * 30, "method": method, "model_daily": model, "drops_daily": drops_daily}


def sales_trend(history: list[tuple], display_group: str | None, marketplace: str, calibration: float = 1.0,
                days: int = 7) -> float | None:
    """Évolution des ventes estimées : derniers `days` jours comparés aux `days` jours précédents (ex. +0.25 = +25 %)."""
    points = sorted(((_parse_ts(t), b) for t, b in history if b), key=lambda p: p[0])
    if not points or (points[-1][0] - points[0][0]).days < 2 * days - 1:
        return None
    cut = points[-1][0] - timedelta(days=days)
    start = cut - timedelta(days=days)
    recent = [(t, b) for t, b in points if t > cut]
    before = [(t, b) for t, b in points if start < t <= cut]
    a = estimate_sales(recent, display_group, marketplace, calibration)["daily"]
    b = estimate_sales(before, display_group, marketplace, calibration)["daily"]
    return (a - b) / b if b else None
