"""Calcul de rentabilité d'un produit vendu sur Amazon (prix affichés TTC en Europe)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ProfitResult:
    price_ttc: float
    vat: float
    amazon_fees: float
    landed_cost: float
    ads: float
    other: float
    profit: float
    margin: float  # bénéfice / prix TTC
    roi: float | None  # bénéfice / coût du produit rendu chez Amazon
    profit_before_ads: float  # budget pub maximum par vente avant de perdre de l'argent


def compute_profit(
    price_ttc: float,
    vat_rate: float,
    amazon_fees: float,
    product_cost: float,
    inbound_cost: float = 0.0,
    ads_per_unit: float = 0.0,
    other_costs: float = 0.0,
) -> ProfitResult:
    vat = price_ttc - price_ttc / (1 + vat_rate)
    landed = product_cost + inbound_cost
    before_ads = price_ttc - vat - amazon_fees - landed - other_costs
    profit = before_ads - ads_per_unit
    return ProfitResult(
        price_ttc=price_ttc,
        vat=vat,
        amazon_fees=amazon_fees,
        landed_cost=landed,
        ads=ads_per_unit,
        other=other_costs,
        profit=profit,
        margin=profit / price_ttc if price_ttc else 0.0,
        roi=profit / landed if landed else None,
        profit_before_ads=before_ads,
    )
