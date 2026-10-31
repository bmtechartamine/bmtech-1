"""Onglet Europe : le même produit sur les 6 marketplaces européennes."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from .. import research
from ..spapi import SPAPIError
from .common import Ctx, csv_bytes


def render(ctx: Ctx) -> None:
    st.subheader("Comparateur Europe")
    st.caption("Repère dans quel pays un produit se vend le mieux, et où la concurrence est la plus faible.")
    c1, c2 = st.columns([3, 1])
    asin = c1.text_input("ASIN", key="eu_asin", placeholder="B0XXXXXXXX")
    c2.write("")
    if c2.button("Comparer", type="primary", disabled=ctx.client is None or not research.is_asin(asin or "")):
        bar = st.progress(0.0, text="Interrogation des 6 marketplaces…")
        try:
            st.session_state["eu_rows"] = research.compare_marketplaces(
                ctx.client, asin, ctx.calib_points, progress=lambda p: bar.progress(p))
        except SPAPIError as e:
            st.error(str(e))
        bar.empty()

    rows = st.session_state.get("eu_rows")
    if not rows:
        return
    df = pd.DataFrame(rows)
    title = next((r["title"] for r in rows if r.get("title")), rows[0]["asin"])
    st.markdown(f"**{title}**")

    available = df[df["available"]]
    if available.empty:
        st.warning("Ce produit n'a été trouvé sur aucune marketplace (ou ton compte n'y a pas accès).")
        return
    best = available.sort_values("est_monthly_sales", ascending=False).iloc[0]
    absent = df[~df["available"]]["marketplace"].tolist()
    m = st.columns(3)
    m[0].metric("Meilleur marché", f"{best['marketplace']} — {best['domain']}")
    m[1].metric("Ventes estimées totales / mois", f"{int(available['est_monthly_sales'].sum()):,}".replace(",", " "))
    m[2].metric("Pays où il est absent", ", ".join(absent) or "aucun")
    if absent:
        st.info("💡 Absent de " + ", ".join(absent) + " : c'est peut-être une opportunité d'être le premier à le vendre là-bas.")

    st.dataframe(
        df[["marketplace", "available", "bsr", "category", "buybox_price", "offer_count", "fba_offer_count",
            "amazon_selling", "est_monthly_sales", "est_monthly_revenue", "link"]],
        column_config={
            "marketplace": "Pays",
            "available": st.column_config.CheckboxColumn("Présent"),
            "bsr": st.column_config.NumberColumn("BSR", format="%d"),
            "category": "Catégorie",
            "buybox_price": st.column_config.NumberColumn("Prix", format="%.2f €"),
            "offer_count": "Vendeurs",
            "fba_offer_count": "Dont FBA",
            "amazon_selling": st.column_config.CheckboxColumn("Amazon"),
            "est_monthly_sales": st.column_config.NumberColumn("Ventes/mois*", format="%d"),
            "est_monthly_revenue": st.column_config.NumberColumn("CA/mois*", format="%d €"),
            "link": st.column_config.LinkColumn("Lien", display_text="Voir ↗"),
        },
        hide_index=True,
        width="stretch",
    )
    st.bar_chart(available.set_index("marketplace")["est_monthly_sales"], y_label="Ventes estimées / mois", x_label="")
    st.download_button("⬇️ Exporter en CSV", csv_bytes(df), file_name=f"europe_{rows[0]['asin']}.csv", mime="text/csv")
