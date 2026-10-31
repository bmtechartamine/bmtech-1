"""Onglets Suivi des concurrents et Alertes."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd
import streamlit as st

from .. import db, estimator, research, tracker
from ..spapi import SPAPIError
from .common import Ctx, csv_bytes


def render(ctx: Ctx) -> None:
    st.subheader("Suivi des concurrents")
    mp = ctx.mp.code
    col_add, col_btn, col_upd = st.columns([3, 1, 1])
    new_asin = col_add.text_input("Ajouter un ASIN", key="track_asin", placeholder="B0XXXXXXXX")
    col_btn.write("")
    if col_btn.button("Ajouter", disabled=ctx.client is None or not research.is_asin(new_asin or "")):
        try:
            info, snap = tracker.fetch_snapshot(ctx.client, new_asin.strip().upper(), mp)
            db.add_product(ctx.conn, info["asin"], mp, info)
            db.add_snapshot(ctx.conn, info["asin"], mp, snap)
            st.success(f"{info['title'] or info['asin']} ajouté.")
        except SPAPIError as e:
            st.error(str(e))
    col_upd.write("")
    if col_upd.button("🔄 Relever maintenant", disabled=ctx.client is None):
        with st.spinner("Relevé en cours…"):
            ok, errors = tracker.update_all(ctx.conn, ctx.client, mp, log=lambda _: None)
        st.success(f"{ok} produit(s) mis à jour.")
        for e in errors:
            st.warning(e)

    products = db.list_products(ctx.conn, mp)
    if not products:
        st.info("Aucun produit suivi sur cette marketplace. Ajoute un ASIN ou utilise l'onglet Recherche.")
        return

    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    overview, histories = [], {}
    for p in products:
        snaps = db.get_snapshots(ctx.conn, p["asin"], mp, since)
        histories[p["asin"]] = snaps
        last = snaps[-1] if snaps else {}
        calib = estimator.calibration_factor(ctx.calib_points, p["display_group"])
        hist = [(s["ts"], s["bsr"]) for s in snaps]
        est = estimator.estimate_sales(hist, p["display_group"], mp, calib)
        trend = estimator.sales_trend(hist, p["display_group"], mp, calib)
        price = last.get("buybox_price") or last.get("lowest_price")
        overview.append({
            "image": p["image"], "asin": p["asin"], "title": p["title"], "bsr": last.get("bsr"),
            "price": price, "offers": last.get("offer_count"), "amazon": bool(last.get("amazon_selling")),
            "sales": round(est["monthly"]), "revenue": round(est["monthly"] * price) if price else None,
            "trend": None if trend is None else trend * 100, "method": est["method"], "points": len(snaps),
            "link": research.product_link(ctx.mp, p["asin"]),
        })

    ov = pd.DataFrame(overview)
    m = st.columns(3)
    m[0].metric("Produits suivis", len(ov))
    m[1].metric("Ventes estimées cumulées / mois", f"{int(ov['sales'].sum()):,}".replace(",", " "))
    m[2].metric("CA estimé cumulé / mois", f"{int(ov['revenue'].fillna(0).sum()):,} €".replace(",", " "))
    st.dataframe(
        ov,
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
            "trend": st.column_config.NumberColumn("Tendance 7 j", format="%+.0f %%",
                                                   help="Ventes des 7 derniers jours comparées aux 7 précédents"),
            "method": "Méthode",
            "points": "Relevés (30 j)",
            "link": st.column_config.LinkColumn("Lien", display_text="Voir ↗"),
        },
        hide_index=True,
        width="stretch",
    )
    st.download_button("⬇️ Exporter le suivi en CSV", csv_bytes(ov.drop(columns=["image"])),
                       file_name=f"suivi_{mp}.csv", mime="text/csv")

    titles = {p["asin"]: f"{p['asin']} — {(p['title'] or '')[:70]}" for p in products}
    selected = st.selectbox("Détail d'un produit", list(titles), format_func=titles.get)
    prod = next(p for p in products if p["asin"] == selected)
    _detail(ctx, prod, histories[selected])

    product_alerts = [a for a in db.list_alerts(ctx.conn, mp) if a["asin"] == selected]
    if product_alerts:
        st.markdown("**Dernières alertes pour ce produit**")
        for a in product_alerts[:10]:
            st.write(f"`{a['ts'][:16].replace('T', ' ')}` {a['message']}")

    if st.button("🗑️ Ne plus suivre ce produit"):
        db.remove_product(ctx.conn, selected, mp)
        st.rerun()


def _detail(ctx: Ctx, prod: dict, snaps: list[dict]) -> None:
    if len(snaps) < 2:
        st.info("Pas encore assez de relevés. Laisse tourner le relevé automatique (voir README).")
        return
    mp = ctx.mp.code
    hist = pd.DataFrame(snaps)
    hist["ts"] = pd.to_datetime(hist["ts"])
    hist = hist.set_index("ts")
    calib = estimator.calibration_factor(ctx.calib_points, prod["display_group"])
    est = estimator.estimate_sales([(s["ts"], s["bsr"]) for s in snaps], prod["display_group"], mp, calib)

    m = st.columns(4)
    m[0].metric("Ventes / jour estimées", f"{est['daily']:.1f}")
    m[1].metric("Modèle BSR", f"{est['model_daily']:.1f} / jour")
    m[2].metric("Chutes de BSR", "—" if est["drops_daily"] is None else f"{est['drops_daily']:.1f} / jour")
    m[3].metric("Méthode retenue", est["method"])

    g1, g2 = st.columns(2)
    g1.markdown("**Classement BSR** (plus bas = mieux)")
    g1.line_chart(hist["bsr"])
    g2.markdown("**Prix (€)**")
    g2.line_chart(hist[["buybox_price", "lowest_price"]].rename(columns={"buybox_price": "Buy Box", "lowest_price": "Plus bas"}))

    daily = hist["bsr"].dropna().resample("D").median().dropna()
    daily_sales = daily.apply(lambda b: estimator.model_daily_sales(int(b), prod["display_group"], mp, calib))
    g3, g4 = st.columns(2)
    g3.markdown("**Ventes estimées par jour**")
    g3.bar_chart(daily_sales.rename("Ventes"))
    g4.markdown("**Nombre de vendeurs**")
    g4.line_chart(hist[["offer_count", "fba_offer_count"]].rename(columns={"offer_count": "Total", "fba_offer_count": "FBA"}))


ALERT_ICONS = {"prix": "💶", "rupture": "📦", "retour": "✅", "vendeurs": "👥", "amazon": "🅰️"}


def render_alerts(ctx: Ctx) -> None:
    st.subheader("Alertes")
    st.caption("Créées automatiquement à chaque relevé : changement de prix (±5 %), rupture de stock, "
               "nouveau vendeur, arrivée ou départ d'Amazon.")
    items = db.list_alerts(ctx.conn, ctx.mp.code)
    if not items:
        st.info("Aucune alerte pour l'instant. Elles apparaissent quand le relevé automatique détecte un changement.")
        return
    if st.button("Tout marquer comme lu"):
        db.mark_alerts_seen(ctx.conn)
        st.rerun()
    df = pd.DataFrame(items)
    df["type"] = df["kind"].map(lambda k: f"{ALERT_ICONS.get(k, '🔔')} {k}")
    df["nouveau"] = df["seen"] == 0
    df["date"] = df["ts"].str[:16].str.replace("T", " ")
    st.dataframe(
        df[["nouveau", "date", "type", "asin", "title", "message"]],
        column_config={"nouveau": st.column_config.CheckboxColumn("Nouveau"), "date": "Date (UTC)", "type": "Type",
                       "asin": "ASIN", "title": st.column_config.TextColumn("Produit", width="medium"),
                       "message": st.column_config.TextColumn("Détail", width="large")},
        hide_index=True,
        width="stretch",
    )

