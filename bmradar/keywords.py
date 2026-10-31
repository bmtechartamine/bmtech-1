"""Recherche de mots-clés à partir des suggestions de la barre de recherche Amazon.

Ce n'est pas une API officielle : Amazon peut la modifier à tout moment. On envoie peu de
requêtes, espacées, uniquement pour les mots-clés que tu tapes.
"""
from __future__ import annotations

import string
import time

import requests

from .config import Marketplace

LANGUAGES = {"FR": "fr_FR", "BE": "fr_BE", "DE": "de_DE", "IT": "it_IT", "ES": "es_ES", "NL": "nl_NL"}
MAX_POSITION = 10


def suggestions(mp: Marketplace, prefix: str, session: requests.Session | None = None) -> list[str]:
    session = session or requests.Session()
    resp = session.get(
        f"https://completion.{mp.domain}/api/2017/suggestions",
        params={"mid": mp.id, "alias": "aps", "prefix": prefix, "lop": LANGUAGES.get(mp.code, "fr_FR"),
                "limit": MAX_POSITION, "suggestion-type": "KEYWORD"},
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=10,
    )
    resp.raise_for_status()
    return [s["value"] for s in resp.json().get("suggestions") or [] if s.get("value")]


def harvest(mp: Marketplace, seed: str, expand: bool = True, session=None, pause: float = 0.3, progress=None) -> list[dict]:
    """Interroge « seed », puis « seed a », « seed b »… et classe les suggestions.

    Popularité : une suggestion qui apparaît souvent et en haut de liste est très recherchée.
    """
    seed = seed.strip().lower()
    prefixes = [seed] + ([f"{seed} {c}" for c in string.ascii_lowercase] if expand else [])
    scores: dict[str, dict] = {}
    session = session or requests.Session()
    for i, prefix in enumerate(prefixes):
        try:
            found = suggestions(mp, prefix, session)
        except (requests.RequestException, ValueError):
            found = []
        for pos, kw in enumerate(found):
            entry = scores.setdefault(kw.lower(), {"keyword": kw.lower(), "hits": 0, "score": 0, "direct": False})
            entry["hits"] += 1
            entry["score"] += MAX_POSITION - pos + (MAX_POSITION if prefix == seed else 0)
            entry["direct"] = entry["direct"] or prefix == seed
        if progress:
            progress((i + 1) / len(prefixes))
        if pause and i < len(prefixes) - 1:
            time.sleep(pause)
    if not scores:
        return []
    top = max(e["score"] for e in scores.values())
    for e in scores.values():
        e["popularity"] = round(100 * e["score"] / top)
    return sorted(scores.values(), key=lambda e: -e["score"])
