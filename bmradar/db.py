"""Base de données locale SQLite : produits suivis, relevés horaires et points de calibration."""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    asin TEXT NOT NULL,
    marketplace TEXT NOT NULL,
    title TEXT,
    brand TEXT,
    image TEXT,
    category TEXT,
    display_group TEXT,
    added_at TEXT NOT NULL,
    PRIMARY KEY (asin, marketplace)
);
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asin TEXT NOT NULL,
    marketplace TEXT NOT NULL,
    ts TEXT NOT NULL,
    bsr INTEGER,
    category TEXT,
    sub_rank INTEGER,
    sub_category TEXT,
    buybox_price REAL,
    lowest_price REAL,
    offer_count INTEGER,
    fba_offer_count INTEGER,
    amazon_selling INTEGER
);
CREATE INDEX IF NOT EXISTS idx_snapshots_product ON snapshots (asin, marketplace, ts);
CREATE TABLE IF NOT EXISTS calibration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asin TEXT NOT NULL,
    marketplace TEXT NOT NULL,
    display_group TEXT,
    bsr INTEGER NOT NULL,
    real_daily_sales REAL NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asin TEXT NOT NULL,
    marketplace TEXT NOT NULL,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0
);
"""

SNAPSHOT_FIELDS = (
    "bsr", "category", "sub_rank", "sub_category",
    "buybox_price", "lowest_price", "offer_count", "fba_offer_count", "amazon_selling",
)


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect(path: str | None = None) -> sqlite3.Connection:
    path = path or config.DB_PATH
    if path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def add_product(conn, asin: str, marketplace: str, info: dict) -> None:
    conn.execute(
        """INSERT INTO products (asin, marketplace, title, brand, image, category, display_group, added_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (asin, marketplace) DO UPDATE SET
             title = excluded.title, brand = excluded.brand, image = excluded.image,
             category = excluded.category, display_group = excluded.display_group""",
        (asin, marketplace, info.get("title"), info.get("brand"), info.get("image"),
         info.get("category"), info.get("display_group"), now()),
    )
    conn.commit()


def remove_product(conn, asin: str, marketplace: str) -> None:
    conn.execute("DELETE FROM products WHERE asin = ? AND marketplace = ?", (asin, marketplace))
    conn.execute("DELETE FROM snapshots WHERE asin = ? AND marketplace = ?", (asin, marketplace))
    conn.execute("DELETE FROM alerts WHERE asin = ? AND marketplace = ?", (asin, marketplace))
    conn.commit()


def list_products(conn, marketplace: str | None = None) -> list[dict]:
    if marketplace:
        rows = conn.execute("SELECT * FROM products WHERE marketplace = ? ORDER BY added_at", (marketplace,))
    else:
        rows = conn.execute("SELECT * FROM products ORDER BY added_at")
    return [dict(r) for r in rows]


def add_snapshot(conn, asin: str, marketplace: str, data: dict, ts: str | None = None) -> None:
    values = [data.get(f) for f in SNAPSHOT_FIELDS]
    values[-1] = None if values[-1] is None else int(bool(values[-1]))
    conn.execute(
        f"INSERT INTO snapshots (asin, marketplace, ts, {', '.join(SNAPSHOT_FIELDS)}) "
        f"VALUES (?, ?, ?, {', '.join('?' * len(SNAPSHOT_FIELDS))})",
        (asin, marketplace, ts or now(), *values),
    )
    conn.commit()


def get_snapshots(conn, asin: str, marketplace: str, since: str | None = None) -> list[dict]:
    query = "SELECT * FROM snapshots WHERE asin = ? AND marketplace = ?"
    params: list = [asin, marketplace]
    if since:
        query += " AND ts >= ?"
        params.append(since)
    return [dict(r) for r in conn.execute(query + " ORDER BY ts", params)]


def latest_snapshot(conn, asin: str, marketplace: str) -> dict | None:
    rows = last_snapshots(conn, asin, marketplace, 1)
    return rows[0] if rows else None


def last_snapshots(conn, asin: str, marketplace: str, n: int) -> list[dict]:
    """Les n derniers relevés, du plus récent au plus ancien."""
    rows = conn.execute(
        "SELECT * FROM snapshots WHERE asin = ? AND marketplace = ? ORDER BY ts DESC, id DESC LIMIT ?", (asin, marketplace, n)
    )
    return [dict(r) for r in rows]


def add_calibration(conn, asin: str, marketplace: str, display_group: str | None, bsr: int, real_daily_sales: float) -> None:
    conn.execute(
        "INSERT INTO calibration (asin, marketplace, display_group, bsr, real_daily_sales, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (asin, marketplace, display_group, bsr, real_daily_sales, now()),
    )
    conn.commit()


def list_calibration(conn) -> list[dict]:
    return [dict(r) for r in conn.execute("SELECT * FROM calibration ORDER BY created_at")]


def delete_calibration(conn, point_id: int) -> None:
    conn.execute("DELETE FROM calibration WHERE id = ?", (point_id,))
    conn.commit()


def add_alert(conn, asin: str, marketplace: str, kind: str, message: str) -> None:
    conn.execute(
        "INSERT INTO alerts (asin, marketplace, ts, kind, message) VALUES (?, ?, ?, ?, ?)",
        (asin, marketplace, now(), kind, message),
    )
    conn.commit()


def list_alerts(conn, marketplace: str | None = None, limit: int = 200) -> list[dict]:
    query = "SELECT a.*, p.title FROM alerts a LEFT JOIN products p ON p.asin = a.asin AND p.marketplace = a.marketplace"
    params: list = []
    if marketplace:
        query += " WHERE a.marketplace = ?"
        params.append(marketplace)
    return [dict(r) for r in conn.execute(query + " ORDER BY a.ts DESC, a.id DESC LIMIT ?", (*params, limit))]


def count_unseen_alerts(conn) -> int:
    return conn.execute("SELECT COUNT(*) FROM alerts WHERE seen = 0").fetchone()[0]


def mark_alerts_seen(conn) -> None:
    conn.execute("UPDATE alerts SET seen = 1 WHERE seen = 0")
    conn.commit()
