"""BM Radar — recherche de produits et suivi des ventes des concurrents sur Amazon Europe.

Lancer :  streamlit run app.py
"""
from __future__ import annotations

import streamlit as st

from bmradar import db
from bmradar.config import MARKETPLACES
from bmradar.spapi import SPAPIClient, SPAPIError
from bmradar.ui import europe, keywords, search, tools, tracking
from bmradar.ui.common import Ctx

st.set_page_config(page_title="BM Radar", page_icon="📡", layout="wide")

# La page est déjà en français : on empêche le navigateur de la « traduire » (« Rechercher » devenait « Chercheur »).
NO_TRANSLATE = "<script>const h = document.documentElement; h.lang = 'fr'; h.setAttribute('translate', 'no');</script>"
try:
    st.html(NO_TRANSLATE, unsafe_allow_javascript=True)
except TypeError:  # Streamlit plus ancien : passage par un iframe
    import streamlit.components.v1 as components

    components.html(NO_TRANSLATE.replace("document.documentElement", "window.parent.document.documentElement"), height=0)


@st.cache_resource
def get_client():
    try:
        return SPAPIClient.from_env(), None
    except SPAPIError as e:
        return None, str(e)


@st.cache_resource
def get_conn():
    return db.connect()


client, client_error = get_client()
conn = get_conn()

with st.sidebar:
    st.title("📡 BM Radar")
    mp_code = st.selectbox("Marketplace", list(MARKETPLACES), format_func=lambda c: f"{c} — {MARKETPLACES[c].domain}")
    if client:
        st.success("Connecté à Amazon (SP-API)")
    else:
        st.error(client_error)
        st.caption("Remplis le fichier .env (voir README) puis relance l'application.")
    unseen = db.count_unseen_alerts(conn)
    if unseen:
        st.warning(f"🔔 {unseen} nouvelle(s) alerte(s)")
    calib_points = db.list_calibration(conn)
    st.caption(f"{len(db.list_products(conn))} produit(s) suivi(s) · {len(calib_points)} point(s) de calibration")

ctx = Ctx(client=client, conn=conn, mp=MARKETPLACES[mp_code], calib_points=calib_points)

tabs = st.tabs([
    "🔍 Recherche produits", "🌍 Comparateur Europe", "📈 Suivi concurrents", "🔔 Alertes",
    "🔑 Mots-clés", "✍️ Optimiseur de fiche", "🧮 Calculateur de marge", "🎯 Calibration",
])
pages = [search.render, europe.render, tracking.render, tracking.render_alerts,
         keywords.render_keywords, keywords.render_listing, tools.render_calculator, tools.render_calibration]
for tab, page in zip(tabs, pages):
    with tab:
        page(ctx)
