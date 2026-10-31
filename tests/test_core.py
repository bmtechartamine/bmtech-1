from datetime import datetime, timedelta

import pytest

from bmradar import db, estimator, parsers, profit, research
from bmradar.config import MARKETPLACES

FR = MARKETPLACES["FR"]

CATALOG_ITEM = {
    "asin": "B0TEST1234",
    "summaries": [{"marketplaceId": FR.id, "itemName": "Tapis de yoga", "brand": "Zen"}],
    "salesRanks": [{
        "marketplaceId": FR.id,
        "classificationRanks": [{"classificationId": "1", "title": "Tapis de yoga", "rank": 12}],
        "displayGroupRanks": [{"websiteDisplayGroup": "sports_display_on_website", "title": "Sports et Loisirs", "rank": 1500}],
    }],
    "images": [{"marketplaceId": FR.id, "images": [
        {"variant": "PT01", "link": "https://img/2.jpg"}, {"variant": "MAIN", "link": "https://img/1.jpg"}]}],
}

OFFERS = {"payload": {
    "Summary": {
        "TotalOfferCount": 3,
        "NumberOfOffers": [{"condition": "new", "fulfillmentChannel": "Amazon", "OfferCount": 2},
                           {"condition": "new", "fulfillmentChannel": "Merchant", "OfferCount": 1}],
        "LowestPrices": [{"condition": "new", "fulfillmentChannel": "Amazon", "LandedPrice": {"Amount": 21.5}},
                         {"condition": "new", "fulfillmentChannel": "Merchant", "LandedPrice": {"Amount": 19.9}}],
        "BuyBoxPrices": [{"condition": "New", "LandedPrice": {"Amount": 22.0}}],
    },
    "Offers": [{"SellerId": "A1X6FK5RDHNB96"}, {"SellerId": "AOTHER"}],
}}


def test_parse_catalog_item():
    row = parsers.parse_catalog_item(CATALOG_ITEM, FR.id)
    assert row["title"] == "Tapis de yoga" and row["brand"] == "Zen"
    assert row["bsr"] == 1500 and row["display_group"] == "sports_display_on_website"
    assert row["sub_rank"] == 12 and row["image"] == "https://img/1.jpg"


def test_parse_catalog_item_without_ranks():
    row = parsers.parse_catalog_item({"asin": "B0X"}, FR.id)
    assert row["bsr"] is None and row["title"] is None


def test_parse_offers():
    o = parsers.parse_offers(OFFERS, FR.amazon_seller_id)
    assert o == {"buybox_price": 22.0, "lowest_price": 19.9, "offer_count": 3, "fba_offer_count": 2, "amazon_selling": True}
    assert parsers.parse_offers(OFFERS, None)["amazon_selling"] is False


def test_parse_fees():
    resp = {"payload": {"FeesEstimateResult": {"Status": "Success", "FeesEstimate": {
        "TotalFeesEstimate": {"Amount": 7.5},
        "FeeDetailList": [{"FeeType": "ReferralFee", "FinalFee": {"Amount": 3.0}},
                          {"FeeType": "FBAFees", "FinalFee": {"Amount": 4.5}}]}}}}
    assert parsers.parse_fees(resp) == {"total": 7.5, "details": {"ReferralFee": 3.0, "FBAFees": 4.5}}
    with pytest.raises(ValueError):
        parsers.parse_fees({"payload": {"FeesEstimateResult": {"Status": "ClientError", "Error": {"Message": "x"}}}})


def test_model_decreases_with_bsr_and_scales_by_marketplace():
    a = estimator.model_daily_sales(100, "home_display_on_website", "FR")
    b = estimator.model_daily_sales(10000, "home_display_on_website", "FR")
    assert a > b > 0
    assert estimator.model_daily_sales(100, "home_display_on_website", "BE") < a
    assert estimator.model_daily_sales(None, None, "FR") == 0


def test_calibration_factor():
    model = estimator.model_daily_sales(2000, "toy_display_on_website", "FR")
    points = [{"bsr": 2000, "display_group": "toy_display_on_website", "marketplace": "FR", "real_daily_sales": model * 2}]
    assert estimator.calibration_factor(points, "toy_display_on_website") == pytest.approx(2.0)
    assert estimator.calibration_factor(points, "other_group") == pytest.approx(2.0)  # repli sur tous les points
    assert estimator.calibration_factor([], "toy_display_on_website") == 1.0


def hourly(bsrs, start=datetime(2026, 10, 1)):
    return [((start + timedelta(hours=i)).isoformat(), b) for i, b in enumerate(bsrs)]


def test_rank_drops_counted():
    # BSR qui dérive lentement puis chute deux fois (deux ventes)
    hist = hourly([80000, 82000, 84000, 40000, 42000, 44000, 46000, 20000, 21000])
    drops, days, gap = estimator.count_rank_drops(hist)
    assert drops == 2 and gap == pytest.approx(1.0)


def test_estimate_prefers_drops_for_slow_sellers():
    bsrs = []
    for _ in range(3 * 4):  # 3 jours, une vente toutes les 6 heures
        bsrs += [60000, 64000, 68000, 72000, 76000, 80000]
    est = estimator.estimate_sales(hourly(bsrs[:72]), "home_display_on_website", "FR")
    assert est["method"] == "chutes de BSR"
    assert est["daily"] == pytest.approx(11 / (71 / 24), rel=0.01)


def test_estimate_uses_model_for_best_sellers():
    est = estimator.estimate_sales(hourly([50] * 60), "home_display_on_website", "FR")
    assert est["method"].startswith("modèle")
    assert est["daily"] == pytest.approx(estimator.model_daily_sales(50, "home_display_on_website", "FR"))


def test_profit():
    r = profit.compute_profit(24.0, 0.20, amazon_fees=7.0, product_cost=5.0, inbound_cost=1.0, ads_per_unit=2.0)
    assert r.vat == pytest.approx(4.0)
    assert r.profit == pytest.approx(24 - 4 - 7 - 6 - 2)
    assert r.profit_before_ads == pytest.approx(7.0)
    assert r.roi == pytest.approx(5 / 6)


def test_db_roundtrip():
    conn = db.connect(":memory:")
    info = parsers.parse_catalog_item(CATALOG_ITEM, FR.id)
    db.add_product(conn, "B0TEST1234", "FR", info)
    db.add_product(conn, "B0TEST1234", "FR", info)  # pas de doublon
    snap = {**info, **parsers.parse_offers(OFFERS, FR.amazon_seller_id)}
    db.add_snapshot(conn, "B0TEST1234", "FR", snap, ts="2026-10-01T10:00:00+00:00")
    assert len(db.list_products(conn, "FR")) == 1
    last = db.latest_snapshot(conn, "B0TEST1234", "FR")
    assert last["bsr"] == 1500 and last["amazon_selling"] == 1
    db.add_calibration(conn, "B0TEST1234", "FR", "sports_display_on_website", 1500, 3.0)
    assert db.list_calibration(conn)[0]["real_daily_sales"] == 3.0
    db.remove_product(conn, "B0TEST1234", "FR")
    assert db.list_products(conn) == [] and db.get_snapshots(conn, "B0TEST1234", "FR") == []


class FakeClient:
    def search_catalog(self, keywords, marketplace_id, page_token=None):
        return {"items": [CATALOG_ITEM]}

    def get_catalog_item(self, asin, marketplace_id):
        return CATALOG_ITEM

    def get_item_offers(self, asin, marketplace_id):
        return OFFERS


def test_research_and_summary():
    rows = research.research(FakeClient(), "tapis yoga", FR, True, [])
    assert rows[0]["buybox_price"] == 22.0 and rows[0]["est_monthly_sales"] > 0
    daily = estimator.model_daily_sales(1500, "sports_display_on_website", "FR")
    assert rows[0]["est_monthly_revenue"] == round(daily * 30 * 22.0)
    s = research.market_summary(rows)
    assert s["products"] == 1 and s["amazon_selling"] == 1
    assert research.is_asin("b0test1234") and not research.is_asin("tapis")
