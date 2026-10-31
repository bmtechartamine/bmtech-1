"""Outils partagés par les onglets de l'interface."""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd
import streamlit as st

from ..config import Marketplace


@dataclass
class Ctx:
    client: object | None
    conn: object
    mp: Marketplace
    calib_points: list[dict]


def euros(value) -> str:
    return "—" if value is None else f"{value:,.2f} €".replace(",", " ").replace(".", ",")


def number(value) -> str:
    return "—" if value is None else f"{value:,.0f}".replace(",", " ")


def csv_bytes(df: pd.DataFrame) -> bytes:
    """CSV lisible directement par Excel en français."""
    return df.to_csv(index=False, sep=";", decimal=",").encode("utf-8-sig")


def send_keywords(words: list[str]) -> None:
    """Ajoute des mots-clés à la liste de l'optimiseur de fiche (callback de bouton)."""
    current = [w for w in st.session_state.get("listing_kw", "").splitlines() if w.strip()]
    st.session_state["listing_kw"] = "\n".join(dict.fromkeys(current + list(words)))
    st.toast(f"{len(words)} mot(s)-clé(s) envoyé(s) à l'optimiseur de fiche")


PRODUCT_COLUMNS = {
    "image": st.column_config.ImageColumn("", width="small"),
    "asin": "ASIN",
    "title": st.column_config.TextColumn("Titre", width="large"),
    "brand": "Marque",
    "bsr": st.column_config.NumberColumn("BSR", format="%d"),
    "category": "Catégorie",
    "buybox_price": st.column_config.NumberColumn("Prix", format="%.2f €"),
    "offer_count": "Vendeurs",
    "fba_offer_count": "Dont FBA",
    "amazon_selling": st.column_config.CheckboxColumn("Amazon"),
    "est_monthly_sales": st.column_config.NumberColumn("Ventes/mois*", format="%d"),
    "est_monthly_revenue": st.column_config.NumberColumn("CA/mois*", format="%d €"),
    "link": st.column_config.LinkColumn("Lien", display_text="Voir ↗"),
}
