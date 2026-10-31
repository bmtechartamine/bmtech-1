"""Onglets Mots-clés et Optimiseur de fiche."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from .. import analysis, keywords, listing
from .common import Ctx, csv_bytes, send_keywords


def render_keywords(ctx: Ctx) -> None:
    st.subheader("Recherche de mots-clés")
    st.caption("Récupère ce que les clients tapent vraiment dans la barre de recherche Amazon. "
               "La popularité (0 à 100) est relative : plus une suggestion apparaît souvent et haut, plus elle est recherchée.")
    c1, c2, c3 = st.columns([3, 1, 1])
    seed = c1.text_input("Mot-clé de départ", key="kw_seed", placeholder="ex. legging sport")
    expand = c2.checkbox("Recherche étendue (a → z)", value=True, help="27 requêtes au lieu d'une : beaucoup plus de résultats")
    c3.write("")
    if c3.button("Chercher", type="primary", disabled=not seed, key="kw_go"):
        bar = st.progress(0.0, text="Interrogation des suggestions Amazon…")
        st.session_state["kw_rows"] = keywords.harvest(ctx.mp, seed, expand, progress=lambda p: bar.progress(p))
        st.session_state["kw_mp"] = ctx.mp.code
        bar.empty()
        if not st.session_state["kw_rows"]:
            st.warning("Amazon n'a renvoyé aucune suggestion. Vérifie ta connexion internet ou essaie un mot plus simple "
                       "(ce service d'Amazon n'est pas officiel et peut changer).")

    rows = st.session_state.get("kw_rows")
    if rows and st.session_state.get("kw_mp") == ctx.mp.code:
        df = pd.DataFrame(rows)
        st.metric("Mots-clés trouvés", len(df))
        st.dataframe(
            df[["keyword", "popularity", "hits", "direct"]],
            column_config={
                "keyword": st.column_config.TextColumn("Mot-clé", width="large"),
                "popularity": st.column_config.ProgressColumn("Popularité", min_value=0, max_value=100, format="%d"),
                "hits": "Apparitions",
                "direct": st.column_config.CheckboxColumn("Top suggestion"),
            },
            hide_index=True,
            width="stretch",
        )
        b1, b2 = st.columns(2)
        b1.button("✍️ Envoyer les 30 premiers à l'optimiseur de fiche", on_click=send_keywords,
                  args=(df["keyword"].head(30).tolist(),), key="send_kw")
        b2.download_button("⬇️ Exporter en CSV", csv_bytes(df), file_name=f"mots_cles_{seed}.csv", mime="text/csv")

    search_rows = st.session_state.get("search_rows")
    if search_rows and st.session_state.get("search_mp") == ctx.mp.code:
        st.markdown(f"#### Mots-clés des concurrents — recherche « {st.session_state.get('search_query', '')} »")
        st.dataframe(pd.DataFrame(analysis.title_keywords(search_rows)), hide_index=True, width="stretch",
                     column_config={"keyword": "Mot-clé", "products": "Nb de produits", "sales_weight": "Ventes cumulées/mois"})


def render_listing(ctx: Ctx) -> None:
    st.subheader("Optimiseur de fiche produit")
    st.caption("Colle ta fiche (ou celle d'un concurrent) et ta liste de mots-clés : l'outil vérifie les règles Amazon "
               "et te montre les mots-clés manquants.")
    st.session_state.setdefault("listing_kw", "")
    with st.form("listing"):
        left, right = st.columns([2, 1])
        title = left.text_input("Titre", key="lst_title")
        bullets = [left.text_area(f"Point clé {i}", key=f"lst_b{i}", height=68) for i in range(1, 6)]
        description = left.text_area("Description", key="lst_desc", height=120)
        backend = left.text_input("Termes de recherche (cachés, dans Seller Central)", key="lst_backend")
        kw_text = right.text_area("Mots-clés visés (un par ligne)", key="listing_kw", height=520)
        submitted = st.form_submit_button("Analyser", type="primary")

    if not submitted:
        return
    kws = [k for k in kw_text.splitlines() if k.strip()]
    title_issues = listing.check_title(title)
    bullet_issues = listing.check_bullets(bullets)
    backend_issues = listing.check_backend(backend, title, bullets)
    coverage = listing.keyword_coverage(kws, title, bullets, description, backend)
    score = listing.score(coverage, title_issues, bullet_issues, backend_issues)

    m = st.columns(4)
    m[0].metric("Note de la fiche", f"{score} / 100")
    m[1].metric("Titre", f"{len(title)} / {listing.TITLE_MAX} car.")
    m[2].metric("Termes cachés", f"{len(backend.encode('utf-8'))} / {listing.BACKEND_MAX_BYTES} octets")
    if coverage:
        found = sum(1 for c in coverage if c["statut"].startswith("✅"))
        m[3].metric("Mots-clés présents", f"{found} / {len(coverage)}")

    c1, c2, c3 = st.columns(3)
    for col, name, issues in ((c1, "Titre", title_issues), (c2, "Points clés", bullet_issues), (c3, "Termes cachés", backend_issues)):
        col.markdown(f"**{name}**")
        for i in issues:
            (col.success if i.startswith("✅") else col.warning)(i)

    if coverage:
        st.markdown("**Couverture des mots-clés**")
        st.dataframe(pd.DataFrame(coverage), hide_index=True, width="stretch")
        missing = [c["mot-clé"] for c in coverage if c["statut"].startswith("❌")]
        if missing:
            st.info("💡 À ajouter en priorité dans le titre, les points clés ou les termes cachés : " + ", ".join(missing[:15]))
