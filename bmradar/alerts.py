"""Détection des changements chez les concurrents suivis, à chaque nouveau relevé."""
from __future__ import annotations

from . import db

PRICE_CHANGE = 0.05  # alerte si le prix bouge d'au moins 5 %


def _fmt(price: float) -> str:
    return f"{price:.2f} €".replace(".", ",")


def detect(previous: dict, current: dict) -> list[tuple[str, str]]:
    """Compare deux relevés et renvoie [(type, message), ...]."""
    out = []
    old_p, new_p = previous.get("buybox_price"), current.get("buybox_price")
    if old_p and new_p and abs(new_p - old_p) / old_p >= PRICE_CHANGE:
        sens = "baisse" if new_p < old_p else "hausse"
        out.append(("prix", f"Prix en {sens} : {_fmt(old_p)} → {_fmt(new_p)} ({(new_p - old_p) / old_p:+.0%})"))
    if old_p and not new_p and not current.get("offer_count"):
        out.append(("rupture", "Plus aucune offre : rupture de stock probable"))
    if not old_p and new_p and not previous.get("offer_count"):
        out.append(("retour", f"De retour en stock à {_fmt(new_p)}"))

    old_n, new_n = previous.get("offer_count"), current.get("offer_count")
    if old_n is not None and new_n is not None and new_n > old_n:
        out.append(("vendeurs", f"Nouveau(x) vendeur(s) : {old_n} → {new_n}"))
    elif old_n is not None and new_n is not None and 0 < new_n < old_n:
        out.append(("vendeurs", f"Moins de vendeurs : {old_n} → {new_n}"))

    if previous.get("amazon_selling") is not None and current.get("amazon_selling") is not None:
        if current["amazon_selling"] and not previous["amazon_selling"]:
            out.append(("amazon", "Amazon vend maintenant ce produit"))
        elif previous["amazon_selling"] and not current["amazon_selling"]:
            out.append(("amazon", "Amazon ne vend plus ce produit"))
    return out


def check(conn, asin: str, marketplace: str) -> list[tuple[str, str]]:
    """À appeler juste après l'enregistrement d'un relevé."""
    snaps = db.last_snapshots(conn, asin, marketplace, 2)
    if len(snaps) < 2:
        return []
    found = detect(snaps[1], snaps[0])
    for kind, message in found:
        db.add_alert(conn, asin, marketplace, kind, message)
    return found
