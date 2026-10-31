"""Onglet Recherche : produits, filtres, score d'opportunité, marques et mots-clés des concurrents."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from .. import analysis, db, research
from ..spapi import SPAPIError
from .common import PRODUCT_COLUMNS, Ctx, csv_bytes, euros, number, send_keywords


def render(ctx: Ctx) -> None:
    st.subheader("Recherche de produits")
    c_q, c_pages, c_opt = st.columns([3, 1, 2])
    query = c_q.text_input("Mot-clé ou ASIN", placeholder="ex. tapis de yoga  ou  B0XXXXXXXX")
    pages = c_pages.selectbox("Résultats", [1, 2, 3], format_func=lambda p: f"{p * 20} produits")
    with_offers = c_opt.checkbox("Charger prix et vendeurs (≈ 2 s par produit)", value=True)

    if st.button("Rechercher", type="primary", disabled=ctx.client is None or not query):
        bar = st.progress(0.0, text="Interrogation d'Amazon…")
        try:
            st.session_state["search_rows"] = research.research(
                ctx.client, query, ctx.mp, with_offers, ctx.calib_points, pages=pages,
                progress=lambda p: bar.progress(p, text="Analyse des produits…"),
            )
            st.session_state["search_mp"] = ctx.mp.code
            st.session_state["search_query"] = query
        except SPAPIError as e:
            st.error(str(e))
        bar.empty()

    all_rows = st.session_state.get("search_rows")
    if not all_rows or st.session_state.get("search_mp") != ctx.mp.code:
        st.caption("Astuce : une recherche précise (« legging anti cellulite femme ») donne une analyse de marché plus fiable "
                   "qu'un mot vague ou un nom de marque.")
        return

    with st.expander("🎚️ Filtres"):
        f = st.columns(6)
        price_min = f[0].number_input("Prix min (€)", min_value=0.0, value=0.0, step=1.0)
        price_max = f[1].number_input("Prix max (€)", min_value=0.0, value=0.0, step=1.0, help="0 = pas de limite")
        bsr_max = f[2].number_input("BSR max", min_value=0, value=0, step=1000, help="0 = pas de limite")
        sales_min = f[3].number_input("Ventes/mois min", min_value=0, value=0, step=10)
        sellers_max = f[4].number_input("Vendeurs max", min_value=0, value=0, step=1, help="0 = pas de limite")
        exclude_amazon = f[5].checkbox("Exclure Amazon vendeur")
    rows = analysis.apply_filters(
        all_rows, price_min or None, price_max or None, bsr_max or None, sales_min or None, sellers_max or None, exclude_amazon,
    )
    if len(rows) != len(all_rows):
        st.caption(f"{len(rows)} produit(s) sur {len(all_rows)} après filtres.")
    if not rows:
        st.info("Aucun produit ne correspond aux filtres.")
        return

    s = research.market_summary(rows)
    c = st.columns(5)
    c[0].metric("Produits", s["products"])
    c[1].metric("Ventes estimées / mois", number(s["monthly_sales"]))
    c[2].metric("CA estimé / mois", euros(s["monthly_revenue"]))
    c[3].metric("Prix moyen", euros(s["avg_price"]))
    c[4].metric("Amazon vendeur", f"{s['amazon_selling']} / {s['products']}")

    _opportunity(rows)

    df = pd.DataFrame(rows)
    st.dataframe(df[list(PRODUCT_COLUMNS)], column_config=PRODUCT_COLUMNS, hide_index=True, width="stretch")
    st.caption("* Estimations à partir du BSR. Calibre l'outil avec tes propres ventes pour plus de précision.")
    st.download_button("⬇️ Exporter en CSV (Excel)", csv_bytes(df.drop(columns=["image"])),
                       file_name=f"recherche_{ctx.mp.code}_{st.session_state.get('search_query', '')}.csv", mime="text/csv")

    _competitor_keywords(rows)

    st.markdown("#### Ajouter au suivi")
    titles = {r["asin"]: f"{r['asin']} — {(r['title'] or '')[:60]}" for r in rows}
    to_track = st.multiselect("Produits à suivre", list(titles), format_func=titles.get)
    if st.button("Suivre ces produits", disabled=not to_track):
        by_asin = {r["asin"]: r for r in rows}
        for asin in to_track:
            db.add_product(ctx.conn, asin, ctx.mp.code, by_asin[asin])
            db.add_snapshot(ctx.conn, asin, ctx.mp.code, by_asin[asin])
        st.success(f"{len(to_track)} produit(s) ajouté(s) au suivi.")


def _opportunity(rows: list[dict]) -> None:
    opp = analysis.opportunity(rows)
    if not opp:
        return
    st.markdown("#### Analyse du marché")
    left, mid, right = st.columns([1, 2, 2])
    color = "green" if opp["score"] >= 7 else "orange" if opp["score"] >= 5 else "red"
    left.metric("Score d'opportunité", f"{opp['score']} / 10")
    left.markdown(f"**:{color}[{opp['verdict']}]**")
    mid.dataframe(pd.DataFrame(opp["criteria"]), hide_index=True, width="stretch",
                  column_config={"note": st.column_config.ProgressColumn("Note", min_value=0, max_value=10, format="%.1f")})
    shares = pd.DataFrame(analysis.brand_shares(rows)[:8])
    right.markdown("**Parts de marché par marque** (ventes estimées)")
    right.bar_chart(shares.set_index("brand")["share"] * 100, horizontal=True, y_label="%", x_label="")
    st.caption("Le score suppose que les résultats sont de vrais concurrents. "
               "Les avis clients ne sont pas fournis par l'API Amazon et ne sont donc pas pris en compte.")


def _competitor_keywords(rows: list[dict]) -> None:
    kws = analysis.title_keywords(rows)
    if not kws:
        return
    with st.expander("🔑 Mots-clés utilisés par les concurrents (dans leurs titres)"):
        st.caption("Classés par ventes cumulées des produits qui les utilisent : les mots des best-sellers remontent en premier.")
        kdf = pd.DataFrame(kws)
        st.dataframe(kdf, hide_index=True, width="stretch", column_config={
            "keyword": "Mot-clé", "products": "Nb de produits", "sales_weight": "Ventes cumulées/mois"})
        st.button("✍️ Envoyer les 20 premiers à l'optimiseur de fiche", on_click=send_keywords,
                  args=([k["keyword"] for k in kws[:20]],), key="send_title_kw")
