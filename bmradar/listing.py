"""Vérification d'une fiche produit : longueurs, règles Amazon et couverture des mots-clés."""
from __future__ import annotations

import re
import unicodedata
from collections import Counter

TITLE_MAX = 200
BACKEND_MAX_BYTES = 249
BULLET_ADVISED = 250
# Caractères interdits dans les titres (sauf s'ils font partie du nom de la marque).
FORBIDDEN_TITLE_CHARS = set("!$?_{}^¬¦")
SMALL_WORDS = {"de", "des", "du", "la", "le", "les", "et", "en", "pour", "avec", "a", "à", "au", "aux", "un", "une", "sur", "x"}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _words(text: str) -> list[str]:
    return normalize(text).split()


def _contains_phrase(haystack: str, phrase: str) -> bool:
    return f" {phrase} " in f" {haystack} "


def keyword_coverage(keywords: list[str], title: str, bullets: list[str], description: str, backend: str) -> list[dict]:
    zones = {
        "Titre": normalize(title),
        "Points clés": normalize(" ".join(bullets)),
        "Description": normalize(description),
        "Termes cachés": normalize(backend),
    }
    all_words = set(" ".join(zones.values()).split())
    rows = []
    for kw in keywords:
        n = normalize(kw)
        if not n:
            continue
        where = [z for z, text in zones.items() if _contains_phrase(text, n)]
        if where:
            status = "✅ présent"
        elif set(n.split()) <= all_words:
            status = "🟡 mots séparés"
        else:
            status = "❌ absent"
        missing = [w for w in n.split() if w not in all_words]
        rows.append({"mot-clé": kw.strip(), "statut": status, "où": ", ".join(where) or "—",
                     "mots manquants": " ".join(missing) or "—"})
    return rows


def check_title(title: str) -> list[str]:
    issues = []
    if len(title) > TITLE_MAX:
        issues.append(f"Titre trop long : {len(title)} caractères (maximum {TITLE_MAX}).")
    if len(title) < 60:
        issues.append("Titre court : tu laisses de la place pour des mots-clés importants.")
    bad = sorted(c for c in set(title) if c in FORBIDDEN_TITLE_CHARS)
    if bad:
        issues.append("Caractères interdits par Amazon : " + " ".join(bad))
    repeated = [w for w, n in Counter(_words(title)).items() if n > 2 and w not in SMALL_WORDS]
    if repeated:
        issues.append("Mot répété plus de 2 fois (interdit par Amazon) : " + ", ".join(repeated))
    shouting = [w for w in title.split() if len(w) > 3 and w.isupper() and w.isalpha()]
    if len(shouting) > 2:
        issues.append("Évite les mots entièrement en MAJUSCULES : " + ", ".join(shouting[:5]))
    if not issues:
        issues.append("✅ Titre conforme.")
    return issues


def check_backend(backend: str, title: str, bullets: list[str]) -> list[str]:
    issues = []
    size = len(backend.encode("utf-8"))
    if size > BACKEND_MAX_BYTES:
        issues.append(f"Termes cachés trop longs : {size} octets (maximum {BACKEND_MAX_BYTES}, le reste est ignoré).")
    visible = set(_words(title + " " + " ".join(bullets)))
    words = _words(backend)
    redundant = sorted({w for w in words if w in visible})
    if redundant:
        issues.append("Mots déjà visibles dans le titre ou les points clés (place gaspillée) : " + ", ".join(redundant))
    dupes = sorted(w for w, n in Counter(words).items() if n > 1)
    if dupes:
        issues.append("Mots en double : " + ", ".join(dupes))
    if "," in backend or ";" in backend:
        issues.append("Inutile de mettre des virgules : sépare simplement les mots par des espaces.")
    if not issues and backend.strip():
        issues.append("✅ Termes cachés optimisés.")
    return issues


def check_bullets(bullets: list[str]) -> list[str]:
    filled = [b for b in bullets if b.strip()]
    issues = []
    if len(filled) < 5:
        issues.append(f"{len(filled)} point(s) clé(s) sur 5 : utilise les 5 emplacements.")
    for i, b in enumerate(bullets, 1):
        if len(b) > BULLET_ADVISED:
            issues.append(f"Point {i} : {len(b)} caractères (conseillé : moins de {BULLET_ADVISED}, sinon il est coupé sur mobile).")
    if not issues:
        issues.append("✅ Points clés bien remplis.")
    return issues


def score(coverage: list[dict], title_issues: list[str], bullet_issues: list[str], backend_issues: list[str]) -> int:
    """Note sur 100 : 60 pts de couverture des mots-clés, 40 pts de respect des règles."""
    if coverage:
        pts = sum(1 if r["statut"].startswith("✅") else 0.5 if r["statut"].startswith("🟡") else 0 for r in coverage)
        cov = 60 * pts / len(coverage)
    else:
        cov = 30
    penalties = sum(1 for i in title_issues + bullet_issues + backend_issues if not i.startswith("✅"))
    return round(cov + max(0, 40 - 8 * penalties))
