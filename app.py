"""BM Radar — recherche de produits et suivi des ventes des concurrents sur Amazon Europe.

Lancer :  streamlit run app.py
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd
import streamlit as st

from bmradar import db, estimator, parsers, profit, research, tracker
from bmradar.config import MARKETPLACES
from bmradar.spapi import SPAPIClient, SPAPIError

st.set_page_config(page_title="BM Radar", page_icon="📡", layout="wide")


@st.cache_resource
def get_client():
    try:
        return SPAPIClient.from_env(), None
    except SPAPIError as e:
        return None, str(e)


@st.cache_resource
def get_conn():
    return db.connect()


def euros(value) -> str:
    return "—" if value is None else f"{value:,.2f} €".replace(",", " ").replace(".", ",")


def number(value) -> str:
    return "—" if value is None else f"{value:,.0f}".replace(",", " ")


client, client_error = get_client()
conn = get_conn()
calib_points = db.list_calibration(conn)

with st.sidebar:
    st.title("📡 BM Radar")
    mp_code = st.selectbox(
        "Marketplace", list(MARKETPLACES), format_func=lambda c: f"{c} — {MARKETPLACES[c].domain}"
    )
    mp = MARKETPLACES[mp_code]
    if client:
        st.success("Connecté à Amazon (SP-API)")
    else:
        st.error(client_error)
        st.caption("Remplis le fichier .env (voir README) puis relance l'application.")
    st.caption(f"{len(calib_points)} point(s) de calibration")

tab_search, tab_track, tab_calc, tab_calib = st.tabs(
    ["🔍 Recherche produits", "📈 Suivi concurrents", "🧮 Calculateur de marge", "🎯 Calibration"]
)

# --------------------------------------------------------------------------- Recherche
with tab_search:
    st.subheader("Recherche de produits")
    col_q, col_opt = st.columns([3, 2])
    query = col_q.text_input("Mot-clé ou ASIN", placeholder="ex. tapis de yoga  ou  B0XXXXXXXX")
    with_offers = col_opt.checkbox("Charger prix et vendeurs (≈ 2 s par produit)", value=True)

    if st.button("Rechercher", type="primary", disabled=client is None or not query):
        bar = st.progress(0.0, text="Interrogation d'Amazon…")
        try:
            st.session_state["search_rows"] = research.research(
                client, query, mp, with_offers, calib_points, progress=lambda p: bar.progress(p, text="Analyse des produits…")
            )
            st.session_state["search_mp"] = mp_code
        except SPAPIError as e:
            st.error(str(e))
        bar.empty()

    rows = st.session_state.get("search_rows")
    if rows and st.session_state.get("search_mp") == mp_code:
        s = research.market_summary(rows)
        c = st.columns(5)
        c[0].metric("Produits", s["products"])
        c[1].metric("Ventes estimées / mois", number(s["monthly_sales"]))
        c[2].metric("CA estimé / mois", euros(s["monthly_revenue"]))
        c[3].metric("Prix moyen", euros(s["avg_price"]))
        c[4].metric("Amazon vendeur", f"{s['amazon_selling']} / {s['products']}")

        df = pd.DataFrame(rows)
        st.dataframe(
            df[["image", "asin", "title", "brand", "bsr", "category", "buybox_price", "offer_count",
                "fba_offer_count", "amazon_selling", "est_monthly_sales", "est_monthly_revenue"]],
            column_config={
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
            },
            hide_index=True,
            width="stretch",
        )
        st.caption("* Estimations à partir du BSR. Calibre l'outil avec tes propres ventes pour plus de précision.")

        to_track = st.multiselect(
            "Ajouter au suivi", df["asin"].tolist(),
            format_func=lambda a: f"{a} — {(df.set_index('asin').loc[a, 'title'] or '')[:60]}",
        )
        if st.button("Suivre ces produits", disabled=not to_track):
            by_asin = {r["asin"]: r for r in rows}
            for asin in to_track:
                db.add_product(conn, asin, mp_code, by_asin[asin])
                db.add_snapshot(conn, asin, mp_code, by_asin[asin])
            st.success(f"{len(to_track)} produit(s) ajouté(s) au suivi.")

# --------------------------------------------------------------------------- Suivi
with tab_track:
    st.subheader("Suivi des concurrents")
    col_add, col_btn, col_upd = st.columns([3, 1, 1])
    new_asin = col_add.text_input("Ajouter un ASIN", key="track_asin", placeholder="B0XXXXXXXX")
    col_btn.write("")
    if col_btn.button("Ajouter", disabled=client is None or not research.is_asin(new_asin or "")):
        try:
            info, snap = tracker.fetch_snapshot(client, new_asin.strip().upper(), mp_code)
            db.add_product(conn, info["asin"], mp_code, info)
            db.add_snapshot(conn, info["asin"], mp_code, snap)
            st.success(f"{info['title'] or info['asin']} ajouté.")
        except SPAPIError as e:
            st.error(str(e))
    col_upd.write("")
    if col_upd.button("🔄 Relever maintenant", disabled=client is None):
        with st.spinner("Relevé en cours…"):
            ok, errors = tracker.update_all(conn, client, mp_code, log=lambda _: None)
        st.success(f"{ok} produit(s) mis à jour.")
        for e in errors:
            st.warning(e)

    products = db.list_products(conn, mp_code)
    if not products:
        st.info("Aucun produit suivi sur cette marketplace. Ajoute un ASIN ou utilise l'onglet Recherche.")
    else:
        since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        overview = []
        histories = {}
        for p in products:
            snaps = db.get_snapshots(conn, p["asin"], mp_code, since)
            histories[p["asin"]] = snaps
            last = snaps[-1] if snaps else {}
            calib = estimator.calibration_factor(calib_points, p["display_group"])
            est = estimator.estimate_sales([(s["ts"], s["bsr"]) for s in snaps], p["display_group"], mp_code, calib)
            price = last.get("buybox_price") or last.get("lowest_price")
            overview.append({
                "image": p["image"], "asin": p["asin"], "title": p["title"], "bsr": last.get("bsr"),
                "price": price, "offers": last.get("offer_count"), "amazon": bool(last.get("amazon_selling")),
                "sales": round(est["monthly"]), "revenue": round(est["monthly"] * price) if price else None,
                "method": est["method"], "points": len(snaps),
            })
        st.dataframe(
            pd.DataFrame(overview),
            column_config={
                "image": st.column_config.ImageColumn("", width="small"),
                "asin": "ASIN",
                "title": st.column_config.TextColumn("Titre", width="large"),
                "bsr": st.column_config.NumberColumn("BSR", format="%d"),
                "price": st.column_config.NumberColumn("Prix", format="%.2f €"),
                "offers": "Vendeurs",
                "amazon": st.column_config.CheckboxColumn("Amazon"),
                "sales": st.column_config.NumberColumn("Ventes/mois", format="%d"),
                "revenue": st.column_config.NumberColumn("CA/mois", format="%d €"),
                "method": "Méthode",
                "points": "Relevés (30 j)",
            },
            hide_index=True,
            width="stretch",
        )

        titles = {p["asin"]: f"{p['asin']} — {(p['title'] or '')[:70]}" for p in products}
        selected = st.selectbox("Détail d'un produit", list(titles), format_func=titles.get)
        snaps = histories[selected]
        if len(snaps) < 2:
            st.info("Pas encore assez de relevés. Laisse tourner le relevé automatique (voir README).")
        else:
            hist = pd.DataFrame(snaps)
            hist["ts"] = pd.to_datetime(hist["ts"])
            hist = hist.set_index("ts")
            prod = next(p for p in products if p["asin"] == selected)
            calib = estimator.calibration_factor(calib_points, prod["display_group"])
            est = estimator.estimate_sales([(s["ts"], s["bsr"]) for s in snaps], prod["display_group"], mp_code, calib)

            m = st.columns(4)
            m[0].metric("Ventes / jour estimées", f"{est['daily']:.1f}")
            m[1].metric("Modèle BSR", f"{est['model_daily']:.1f} / jour")
            m[2].metric("Chutes de BSR", "—" if est["drops_daily"] is None else f"{est['drops_daily']:.1f} / jour")
            m[3].metric("Méthode retenue", est["method"])

            g1, g2 = st.columns(2)
            g1.markdown("**Classement BSR** (plus bas = mieux)")
            g1.line_chart(hist["bsr"])
            g2.markdown("**Prix Buy Box (€)**")
            g2.line_chart(hist[["buybox_price", "lowest_price"]].rename(
                columns={"buybox_price": "Buy Box", "lowest_price": "Plus bas"}))

            daily = hist["bsr"].dropna().resample("D").median()
            daily_sales = daily.apply(lambda b: estimator.model_daily_sales(int(b), prod["display_group"], mp_code, calib))
            g3, g4 = st.columns(2)
            g3.markdown("**Ventes estimées par jour** (modèle)")
            g3.bar_chart(daily_sales.rename("Ventes"))
            g4.markdown("**Nombre de vendeurs**")
            g4.line_chart(hist[["offer_count", "fba_offer_count"]].rename(
                columns={"offer_count": "Total", "fba_offer_count": "FBA"}))

        if st.button("🗑️ Ne plus suivre ce produit"):
            db.remove_product(conn, selected, mp_code)
            st.rerun()

# --------------------------------------------------------------------------- Calculateur
with tab_calc:
    st.subheader("Calculateur de marge")
    with st.form("calc"):
        c1, c2, c3 = st.columns(3)
        asin = c1.text_input("ASIN (pour les frais réels Amazon)", placeholder="optionnel")
        price = c1.number_input("Prix de vente TTC (€)", min_value=0.0, value=24.99, step=0.5)
        fba = c1.toggle("Expédié par Amazon (FBA)", value=True)
        cost = c2.number_input("Coût d'achat unitaire HT (€)", min_value=0.0, value=5.0, step=0.5)
        inbound = c2.number_input("Transport jusqu'à Amazon / unité (€)", min_value=0.0, value=1.0, step=0.1)
        vat = c2.number_input("TVA (%)", min_value=0.0, value=mp.vat * 100, step=1.0)
        ads = c3.number_input("Publicité / unité (€)", min_value=0.0, value=2.0, step=0.5)
        other = c3.number_input("Autres frais / unité (€)", min_value=0.0, value=0.0, step=0.1)
        manual_fees = c3.number_input("Frais Amazon manuels (€) — si pas d'ASIN", min_value=0.0, value=0.0, step=0.1)
        submitted = st.form_submit_button("Calculer", type="primary")

    if submitted:
        fees, details = manual_fees, {}
        if asin and client:
            try:
                res = parsers.parse_fees(client.get_fees_estimate(asin.strip().upper(), mp.id, price, fba))
                fees, details = res["total"], res["details"]
            except (SPAPIError, ValueError) as e:
                st.warning(f"{e} — frais manuels utilisés.")
        r = profit.compute_profit(price, vat / 100, fees, cost, inbound, ads, other)
        m = st.columns(4)
        m[0].metric("Bénéfice / vente", euros(r.profit))
        m[1].metric("Marge nette", f"{r.margin:.1%}")
        m[2].metric("ROI", "—" if r.roi is None else f"{r.roi:.0%}")
        m[3].metric("Pub max / vente (seuil 0 €)", euros(r.profit_before_ads))
        breakdown = {"TVA": r.vat, "Frais Amazon": r.amazon_fees, "Coût produit + transport": r.landed_cost,
                     "Publicité": r.ads, "Autres": r.other, "Bénéfice": r.profit}
        st.dataframe(pd.DataFrame({"Montant (€)": breakdown}).round(2), width="stretch")
        if details:
            st.caption("Détail des frais Amazon : " + ", ".join(f"{k} {euros(v)}" for k, v in details.items()))

# --------------------------------------------------------------------------- Calibration
with tab_calib:
    st.subheader("Calibration avec tes ventes réelles")
    st.markdown(
        "Les ventes sont estimées à partir du BSR. Pour que les chiffres soient justes **sur ton marché**, "
        "indique les ventes réelles de quelques-uns de **tes propres produits** (visibles dans Seller Central → "
        "Rapports → Ventes). L'outil compare avec le BSR et corrige toutes les estimations de la même catégorie."
    )
    with st.form("calib"):
        c1, c2 = st.columns(2)
        cal_asin = c1.text_input("ASIN de ton produit")
        cal_sales = c2.number_input("Tes ventes réelles sur les 30 derniers jours", min_value=0.0, value=0.0, step=1.0)
        add = st.form_submit_button("Ajouter le point", disabled=client is None)
    if add and cal_asin and cal_sales > 0:
        try:
            info = parsers.parse_catalog_item(client.get_catalog_item(cal_asin.strip().upper(), mp.id), mp.id)
            if not info["bsr"]:
                st.error("Ce produit n'a pas de BSR sur cette marketplace.")
            else:
                db.add_calibration(conn, info["asin"], mp_code, info["display_group"], info["bsr"], cal_sales / 30)
                st.success(f"Point ajouté : BSR {info['bsr']} ({info['category']}) ↔ {cal_sales / 30:.1f} ventes/jour.")
                st.rerun()
        except SPAPIError as e:
            st.error(str(e))

    if calib_points:
        cp = pd.DataFrame(calib_points)
        cp["modèle"] = cp.apply(lambda r: estimator.model_daily_sales(r["bsr"], r["display_group"], r["marketplace"]), axis=1)
        cp["correction"] = cp["real_daily_sales"] / cp["modèle"]
        st.dataframe(cp[["id", "asin", "marketplace", "display_group", "bsr", "real_daily_sales", "modèle", "correction"]].round(2),
                     hide_index=True, width="stretch")
        to_delete = st.selectbox("Supprimer un point", cp["id"].tolist(), index=None)
        if to_delete is not None and st.button("Supprimer"):
            db.delete_calibration(conn, int(to_delete))
            st.rerun()
    st.caption("Astuce : un BSR relevé un seul jour fluctue. Pour un point fiable, utilise un produit aux ventes régulières.")
