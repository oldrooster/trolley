"""
SQLite FTS5 setup for product search.
Creates a virtual table and triggers to keep it in sync with `products`.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session


FTS_SETUP_SQL = """
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
    base_name,
    variant_name,
    full_name,
    content='products',
    content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS products_fts_ai
AFTER INSERT ON products BEGIN
    INSERT INTO products_fts(rowid, base_name, variant_name, full_name)
    VALUES (new.id, new.base_name, COALESCE(new.variant_name, ''), COALESCE(new.full_name, ''));
END;

CREATE TRIGGER IF NOT EXISTS products_fts_ad
AFTER DELETE ON products BEGIN
    INSERT INTO products_fts(products_fts, rowid, base_name, variant_name, full_name)
    VALUES ('delete', old.id, old.base_name, COALESCE(old.variant_name, ''), COALESCE(old.full_name, ''));
END;

CREATE TRIGGER IF NOT EXISTS products_fts_au
AFTER UPDATE ON products BEGIN
    INSERT INTO products_fts(products_fts, rowid, base_name, variant_name, full_name)
    VALUES ('delete', old.id, old.base_name, COALESCE(old.variant_name, ''), COALESCE(old.full_name, ''));
    INSERT INTO products_fts(rowid, base_name, variant_name, full_name)
    VALUES (new.id, new.base_name, COALESCE(new.variant_name, ''), COALESCE(new.full_name, ''));
END;
"""


def setup_fts(db: Session) -> None:
    # Use executescript so SQLite handles the multi-statement SQL including triggers
    # that contain internal semicolons.
    raw_conn = db.bind.raw_connection()
    try:
        raw_conn.executescript(FTS_SETUP_SQL)
        raw_conn.commit()
    finally:
        raw_conn.close()


def rebuild_fts(db: Session) -> None:
    """Rebuild FTS index from current products table (run after bulk seed)."""
    db.execute(text("DELETE FROM products_fts"))
    db.execute(text("""
        INSERT INTO products_fts(rowid, base_name, variant_name, full_name)
        SELECT id, base_name, COALESCE(variant_name, ''), COALESCE(full_name, '')
        FROM products
    """))
    db.commit()


def fts_search(db: Session, query: str, limit: int = 20) -> list[int]:
    """Return product IDs matching the query, ordered by FTS rank."""
    # Convert query words to prefix tokens: "salt chips" → "salt* chips*"
    tokens = " ".join(f"{word}*" for word in query.strip().split() if word)
    if not tokens:
        return []
    rows = db.execute(
        text("SELECT rowid FROM products_fts WHERE products_fts MATCH :q ORDER BY rank LIMIT :lim"),
        {"q": tokens, "lim": limit},
    ).fetchall()
    return [r[0] for r in rows]
