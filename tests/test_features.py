from datetime import datetime, timedelta

import pytest

from bmradar import alerts, analysis, db, estimator, keywords, listing, research
from bmradar.config import MARKETPLACES

FR = MARKETPLACES["FR"]


def row(asin, sales, brand="A", price=25.0, amazon=False, sellers=1, title="tapis yoga antidérapant"):
    return {"asin": asin, "est_monthly_sales": sales, "brand": brand, "buybox_price": price,
            "amazon_selling": amazon, "offer_count": sellers, "bsr": 1000, "title": title}


def test_filters():
    rows = [row("1", 100, price=10), row("2", 5, price=30), row("3", 300, price=40, amazon=True)]
    assert [r["asin"] for r in analysis.apply_filters(rows, price_min=20)] == ["2", "3"]
    assert [r["asin"] for r in analysis.apply_filters(rows, sales_min=50, exclude_amazon=True)] == ["1"]


def test_brand_shares():
    shares = analysis.brand_shares([row("1", 300, "A"), row("2", 100, "B")])
    assert shares[0]["brand"] == "A" and shares[0]["share"] == pytest.approx(0.75)


def test_opportunity_scores_open_market_higher_than_locked_one():
    open_market = [row(str(i), 400, brand=f"B{i}") for i in range(10)]
    locked = [row("0", 5000, brand="Big", amazon=True)] + [row(str(i), 5, brand="Big", amazon=True) for i in range(1, 10)]
    good, bad = analysis.opportunity(open_market), analysis.opportunity(locked)
    assert good["score"] > bad["score"] and good["verdict"] != "Difficile" and bad["verdict"] == "Difficile"
    assert analysis.opportunity([row("1", 10)]) is None


def test_title_keywords_weighted_by_sales():
    rows = [row("1", 500, title="Tapis de yoga épais"), row("2", 100, title="Tapis yoga épais pliable"),
            row("3", 10, title="Tapis yoga")]
    kws = analysis.title_keywords(rows)
    assert kws[0]["keyword"] in ("tapis", "yoga", "tapis yoga")
    assert "épais" in [k["keyword"] for k in kws]
    assert "pliable" not in [k["keyword"] for k in kws]  # un seul produit


def test_listing_checks():
    assert "Caractères interdits" in " ".join(listing.check_title("Super tapis !!! yoga yoga yoga tapis tapis tapis"))
    assert listing.check_title("Tapis de yoga antidérapant épais 6 mm avec sangle de transport, pour pilates et fitness")[0].startswith("✅")
    issues = listing.check_backend("tapis, pilates pilates " + "x" * 260, "Tapis de yoga", [])
    text = " ".join(issues)
    assert "trop longs" in text and "tapis" in text and "pilates" in text and "virgules" in text
    cov = listing.keyword_coverage(["tapis yoga", "yoga épais", "gym"], "Tapis yoga", ["très épais"], "", "")
    assert [c["statut"][0] for c in cov] == ["✅", "🟡", "❌"]
    assert 0 <= listing.score(cov, ["✅"], ["✅"], ["✅"]) <= 100


def test_alerts_detect_and_store():
    found = alerts.detect({"buybox_price": 20.0, "offer_count": 1, "amazon_selling": False},
                          {"buybox_price": 17.0, "offer_count": 3, "amazon_selling": True})
    assert {k for k, _ in found} == {"prix", "vendeurs", "amazon"}
    assert alerts.detect({"buybox_price": 20.0, "offer_count": 1}, {"buybox_price": None, "offer_count": 0})[0][0] == "rupture"

    conn = db.connect(":memory:")
    db.add_product(conn, "B0TEST1234", "FR", {"title": "Tapis"})
    db.add_snapshot(conn, "B0TEST1234", "FR", {"buybox_price": 20.0, "offer_count": 1}, ts="2026-10-01T10:00:00+00:00")
    db.add_snapshot(conn, "B0TEST1234", "FR", {"buybox_price": 25.0, "offer_count": 1}, ts="2026-10-01T11:00:00+00:00")
    assert alerts.check(conn, "B0TEST1234", "FR")[0][0] == "prix"
    assert db.count_unseen_alerts(conn) == 1 and db.list_alerts(conn)[0]["title"] == "Tapis"
    db.mark_alerts_seen(conn)
    assert db.count_unseen_alerts(conn) == 0


def test_sales_trend():
    start = datetime(2026, 10, 1)
    hist = [((start + timedelta(hours=h)).isoformat(), 2000 if h < 7 * 24 else 1000) for h in range(14 * 24)]
    trend = estimator.sales_trend(hist, "home_display_on_website", "FR")
    assert trend == pytest.approx(2 ** estimator.EXPONENT - 1, rel=0.01)
    assert estimator.sales_trend(hist[:48], "home_display_on_website", "FR") is None


class FakeResp:
    def __init__(self, values):
        self.values = values

    def raise_for_status(self):
        pass

    def json(self):
        return {"suggestions": [{"value": v} for v in self.values]}


class FakeSession:
    def get(self, url, params, headers, timeout):
        assert url == "https://completion.amazon.fr/api/2017/suggestions"
        p = params["prefix"]
        return FakeResp(["tapis yoga", "tapis yoga épais"] if p == "tapis" else [f"{p}ccessoire"] if p.endswith(" a") else [])


def test_keyword_harvest():
    kws = keywords.harvest(FR, "Tapis", session=FakeSession(), pause=0)
    assert kws[0]["keyword"] == "tapis yoga" and kws[0]["popularity"] == 100 and kws[0]["direct"]
    assert "tapis accessoire" in [k["keyword"] for k in kws]


class EuropeClient:
    def get_catalog_item(self, asin, marketplace_id):
        assert isinstance(marketplace_id, list)
        return {"asin": asin,
                "summaries": [{"marketplaceId": FR.id, "itemName": "Tapis"}],
                "salesRanks": [{"marketplaceId": FR.id, "displayGroupRanks": [
                    {"websiteDisplayGroup": "sports_display_on_website", "title": "Sports", "rank": 500}]}]}

    def get_item_offers(self, asin, marketplace_id):
        return {"payload": {"Summary": {"TotalOfferCount": 2, "BuyBoxPrices": [{"condition": "New", "LandedPrice": {"Amount": 30.0}}]}}}


def test_compare_marketplaces():
    rows = {r["marketplace"]: r for r in research.compare_marketplaces(EuropeClient(), "b0test1234", [])}
    assert rows["FR"]["available"] and rows["FR"]["bsr"] == 500 and rows["FR"]["buybox_price"] == 30.0
    assert rows["FR"]["est_monthly_sales"] > 0 and rows["FR"]["link"] == "https://www.amazon.fr/dp/B0TEST1234"
    assert not rows["DE"]["available"] and rows["DE"]["bsr"] is None and rows["DE"]["est_monthly_sales"] == 0
