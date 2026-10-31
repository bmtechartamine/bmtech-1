"""Lance toute l'interface avec un faux client Amazon pour vérifier qu'aucun onglet ne plante."""
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import streamlit as st
from streamlit.testing.v1 import AppTest

from bmradar import config, db
from bmradar.spapi import SPAPIClient

APP = str(Path(__file__).resolve().parent.parent / "app.py")
FR = config.MARKETPLACES["FR"]


def item(asin, rank, brand, title):
    return {"asin": asin,
            "summaries": [{"marketplaceId": FR.id, "itemName": title, "brand": brand}],
            "salesRanks": [{"marketplaceId": FR.id, "displayGroupRanks": [
                {"websiteDisplayGroup": "sports_display_on_website", "title": "Sports", "rank": rank}]}]}


ITEMS = [item(f"B0TEST000{i}", 500 * (i + 1), f"Marque{i % 4}", f"Legging sport femme taille haute modèle {i}") for i in range(8)]


class FakeClient:
    def search_catalog(self, keywords, marketplace_id, page_size=20, page_token=None):
        return {"items": ITEMS}

    def get_catalog_item(self, asin, marketplace_id):
        return next((i for i in ITEMS if i["asin"] == asin), ITEMS[0])

    def get_item_offers(self, asin, marketplace_id):
        return {"payload": {"Summary": {"TotalOfferCount": 2, "NumberOfOffers": [],
                                        "BuyBoxPrices": [{"condition": "New", "LandedPrice": {"Amount": 24.9}}]},
                            "Offers": []}}

    def get_fees_estimate(self, asin, marketplace_id, price, fba=True):
        return {"payload": {"FeesEstimateResult": {"Status": "Success", "FeesEstimate": {
            "TotalFeesEstimate": {"Amount": 8.1}, "FeeDetailList": [{"FeeType": "ReferralFee", "FinalFee": {"Amount": 3.7}}]}}}}


@pytest.fixture
def app(tmp_path, monkeypatch):
    path = str(tmp_path / "test.db")
    monkeypatch.setattr(config, "DB_PATH", path)
    monkeypatch.setattr(SPAPIClient, "from_env", classmethod(lambda cls: FakeClient()))
    st.cache_resource.clear()
    conn = db.connect(path)
    db.add_product(conn, "B0TEST0001", "FR", {"title": "Legging", "display_group": "sports_display_on_website"})
    start = datetime.now(timezone.utc) - timedelta(days=15)
    for h in range(15 * 24):
        db.add_snapshot(conn, "B0TEST0001", "FR", {"bsr": 3000 - h, "buybox_price": 20.0 + (h // 100), "offer_count": 2},
                        ts=(start + timedelta(hours=h)).isoformat())
    db.add_alert(conn, "B0TEST0001", "FR", "prix", "Prix en hausse")
    yield AppTest.from_file(APP, default_timeout=60)
    st.cache_resource.clear()


def no_errors(at):
    assert not at.exception, [e.value for e in at.exception]
    assert not at.error, [e.value for e in at.error]


def test_all_tabs_render_and_search_works(app):
    at = app.run()
    no_errors(at)
    assert any("trend" in df.value.columns for df in at.dataframe)  # tableau de suivi affiché

    at.text_input[0].set_value("legging sport").run()
    next(b for b in at.button if b.label == "Rechercher").click()
    at.run()
    no_errors(at)
    labels = [m.label for m in at.metric]
    assert "Score d'opportunité" in labels and "Ventes estimées / mois" in labels

    next(b for b in at.button if "optimiseur" in b.label).click()
    at.run()
    no_errors(at)
    assert "legging" in at.session_state["listing_kw"]

    next(b for b in at.button if b.label == "Calculer").click()
    at.run()
    no_errors(at)
    assert any(m.label == "Bénéfice / vente" for m in at.metric)

    next(b for b in at.button if b.label == "Analyser").click()
    at.run()
    no_errors(at)
    assert any(m.label == "Note de la fiche" for m in at.metric)
