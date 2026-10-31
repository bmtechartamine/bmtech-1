"""Onglets Calculateur de marge et Calibration."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from .. import db, estimator, parsers, profit
from ..spapi import SPAPIError
from .common import Ctx, euros


def render_calculator(ctx: Ctx) -> None:
    st.subheader("Calculateur de marge")
    mp = ctx.mp
    with st.form("calc"):
        c1, c2, c3 = st.columns(3)
        asin = c1.text_input("ASIN (pour les frais réels Amazon)", placeholder="optionnel")
        price = c1.number_input("Prix de vente TTC (€)", min_value=0.0, value=24.99, step=0.5)
        use_buybox = c1.checkbox("Utiliser le prix Buy Box actuel de cet ASIN")
        fba = c1.toggle("Expédié par Amazon (FBA)", value=True)
        cost = c2.number_input("Coût d'achat unitaire HT (€)", min_value=0.0, value=5.0, step=0.5)
        inbound = c2.number_input("Transport jusqu'à Amazon / unité (€)", min_value=0.0, value=1.0, step=0.1)
        vat = c2.number_input("TVA (%)", min_value=0.0, value=mp.vat * 100, step=1.0)
        ads = c3.number_input("Publicité / unité (€)", min_value=0.0, value=2.0, step=0.5)
        other = c3.number_input("Autres frais / unité (€)", min_value=0.0, value=0.0, step=0.1)
        manual_fees = c3.number_input("Frais Amazon manuels (€) — si pas d'ASIN", min_value=0.0, value=0.0, step=0.1)
        monthly_units = c3.number_input("Ventes prévues / mois", min_value=0, value=100, step=10)
        submitted = st.form_submit_button("Calculer", type="primary")

    if not submitted:
        return
    asin = asin.strip().upper()
    if asin and ctx.client and use_buybox:
        try:
            offers = parsers.parse_offers(ctx.client.get_item_offers(asin, mp.id), mp.amazon_seller_id)
            if offers["buybox_price"] or offers["lowest_price"]:
                price = offers["buybox_price"] or offers["lowest_price"]
                st.caption(f"Prix utilisé : {euros(price)} (Buy Box actuelle)")
        except SPAPIError as e:
            st.warning(f"Prix Buy Box indisponible : {e}")
    fees, details = manual_fees, {}
    if asin and ctx.client:
        try:
            res = parsers.parse_fees(ctx.client.get_fees_estimate(asin, mp.id, price, fba))
            fees, details = res["total"], res["details"]
        except (SPAPIError, ValueError) as e:
            st.warning(f"{e} — frais manuels utilisés.")
    r = profit.compute_profit(price, vat / 100, fees, cost, inbound, ads, other)

    m = st.columns(5)
    m[0].metric("Bénéfice / vente", euros(r.profit))
    m[1].metric("Marge nette", f"{r.margin:.1%}")
    m[2].metric("ROI", "—" if r.roi is None else f"{r.roi:.0%}")
    m[3].metric("Pub max / vente (seuil 0 €)", euros(r.profit_before_ads))
    m[4].metric(f"Bénéfice / mois ({monthly_units} ventes)", euros(r.profit * monthly_units))
    breakdown = {"TVA": r.vat, "Frais Amazon": r.amazon_fees, "Coût produit + transport": r.landed_cost,
                 "Publicité": r.ads, "Autres": r.other, "Bénéfice": r.profit}
    left, right = st.columns(2)
    left.dataframe(pd.DataFrame({"Montant (€)": breakdown}).round(2), width="stretch")
    right.bar_chart(pd.Series(breakdown, name="€"), horizontal=True)
    if details:
        st.caption("Détail des frais Amazon : " + ", ".join(f"{k} {euros(v)}" for k, v in details.items()))
    if r.profit <= 0:
        st.error("Ce produit perd de l'argent à ce prix. Augmente le prix, baisse le coût d'achat ou réduis la publicité.")
    elif r.roi is not None and r.roi < 1:
        st.warning("ROI inférieur à 100 % : rentable, mais peu de marge de manœuvre en cas de guerre des prix.")


def render_calibration(ctx: Ctx) -> None:
    st.subheader("Calibration avec tes ventes réelles")
    st.markdown(
        "Les ventes sont estimées à partir du BSR. Pour que les chiffres soient justes **sur ton marché**, "
        "indique les ventes réelles de quelques-uns de **tes propres produits** (visibles dans Seller Central → "
        "Rapports → Ventes). L'outil compare avec le BSR et corrige toutes les estimations de la même catégorie."
    )
    mp = ctx.mp
    with st.form("calib"):
        c1, c2 = st.columns(2)
        cal_asin = c1.text_input("ASIN de ton produit")
        cal_sales = c2.number_input("Tes ventes réelles sur les 30 derniers jours", min_value=0.0, value=0.0, step=1.0)
        add = st.form_submit_button("Ajouter le point", disabled=ctx.client is None)
    if add and cal_asin and cal_sales > 0:
        try:
            info = parsers.parse_catalog_item(ctx.client.get_catalog_item(cal_asin.strip().upper(), mp.id), mp.id)
            if not info["bsr"]:
                st.error("Ce produit n'a pas de BSR sur cette marketplace.")
            else:
                db.add_calibration(ctx.conn, info["asin"], mp.code, info["display_group"], info["bsr"], cal_sales / 30)
                st.success(f"Point ajouté : BSR {info['bsr']} ({info['category']}) ↔ {cal_sales / 30:.1f} ventes/jour.")
                st.rerun()
        except SPAPIError as e:
            st.error(str(e))

    if ctx.calib_points:
        cp = pd.DataFrame(ctx.calib_points)
        cp["modèle"] = cp.apply(lambda r: estimator.model_daily_sales(r["bsr"], r["display_group"], r["marketplace"]), axis=1)
        cp["correction"] = cp["real_daily_sales"] / cp["modèle"]
        st.dataframe(cp[["id", "asin", "marketplace", "display_group", "bsr", "real_daily_sales", "modèle", "correction"]].round(2),
                     hide_index=True, width="stretch")
        to_delete = st.selectbox("Supprimer un point", cp["id"].tolist(), index=None)
        if to_delete is not None and st.button("Supprimer"):
            db.delete_calibration(ctx.conn, int(to_delete))
            st.rerun()
    st.caption("Astuce : un BSR relevé un seul jour fluctue. Pour un point fiable, utilise un produit aux ventes régulières.")
