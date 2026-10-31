"""Client minimal pour l'API officielle Amazon Selling Partner (SP-API), région Europe."""
from __future__ import annotations

import time

import requests

from . import config

ENDPOINT = "https://sellingpartnerapi-eu.amazon.com"
TOKEN_URL = "https://api.amazon.com/auth/o2/token"

# Intervalle minimal entre deux appels (secondes), d'après les quotas publiés par Amazon.
RATE_LIMITS = {
    "catalog": 0.5,  # 2 requêtes/s
    "offers": 2.1,  # 0,5 requête/s
    "fees": 1.0,  # 1 requête/s
}


class SPAPIError(Exception):
    pass


class SPAPIClient:
    def __init__(self, client_id: str, client_secret: str, refresh_token: str, session: requests.Session | None = None):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.session = session or requests.Session()
        self._access_token: str | None = None
        self._token_expiry = 0.0
        self._last_call: dict[str, float] = {}

    @classmethod
    def from_env(cls) -> "SPAPIClient":
        creds = config.spapi_credentials()
        missing = [k for k, v in creds.items() if not v]
        if missing:
            raise SPAPIError("Identifiants SP-API manquants dans .env : " + ", ".join(missing))
        return cls(**creds)

    def _token(self) -> str:
        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token
        resp = self.session.post(
            TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": self.refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            raise SPAPIError(f"Échec de l'authentification Amazon ({resp.status_code}) : {resp.text[:300]}")
        data = resp.json()
        self._access_token = data["access_token"]
        self._token_expiry = time.time() + int(data.get("expires_in", 3600))
        return self._access_token

    def _throttle(self, op: str) -> None:
        wait = RATE_LIMITS[op] - (time.time() - self._last_call.get(op, 0.0))
        if wait > 0:
            time.sleep(wait)
        self._last_call[op] = time.time()

    def _request(self, op: str, method: str, path: str, params=None, json=None) -> dict:
        delay = 2.0
        for attempt in range(5):
            self._throttle(op)
            resp = self.session.request(
                method,
                ENDPOINT + path,
                params=params,
                json=json,
                headers={"x-amz-access-token": self._token(), "content-type": "application/json"},
                timeout=30,
            )
            if resp.status_code == 429 or resp.status_code >= 500:
                if attempt == 4:
                    break
                time.sleep(delay)
                delay *= 2
                continue
            if resp.status_code >= 400:
                raise SPAPIError(f"Erreur Amazon {resp.status_code} sur {path} : {resp.text[:500]}")
            return resp.json()
        raise SPAPIError(f"Amazon ne répond pas (quota dépassé ou erreur serveur) sur {path}")

    def get_catalog_item(self, asin: str, marketplace_id: str | list[str]) -> dict:
        """marketplace_id peut être une liste pour interroger plusieurs pays en un seul appel."""
        ids = marketplace_id if isinstance(marketplace_id, str) else ",".join(marketplace_id)
        return self._request(
            "catalog",
            "GET",
            f"/catalog/2022-04-01/items/{asin}",
            params={"marketplaceIds": ids, "includedData": "summaries,salesRanks,images"},
        )

    def search_catalog(self, keywords: str, marketplace_id: str, page_size: int = 20, page_token: str | None = None) -> dict:
        params = {
            "marketplaceIds": marketplace_id,
            "keywords": ",".join(keywords.split()),
            "includedData": "summaries,salesRanks,images",
            "pageSize": page_size,
        }
        if page_token:
            params["pageToken"] = page_token
        return self._request("catalog", "GET", "/catalog/2022-04-01/items", params=params)

    def get_item_offers(self, asin: str, marketplace_id: str) -> dict:
        return self._request(
            "offers",
            "GET",
            f"/products/pricing/v0/items/{asin}/offers",
            params={"MarketplaceId": marketplace_id, "ItemCondition": "New"},
        )

    def get_fees_estimate(self, asin: str, marketplace_id: str, price: float, fba: bool = True, currency: str = "EUR") -> dict:
        body = {
            "FeesEstimateRequest": {
                "MarketplaceId": marketplace_id,
                "IsAmazonFulfilled": fba,
                "PriceToEstimateFees": {"ListingPrice": {"CurrencyCode": currency, "Amount": round(price, 2)}},
                "Identifier": f"bmradar-{asin}",
            }
        }
        return self._request("fees", "POST", f"/products/fees/v0/items/{asin}/feesEstimate", json=body)
