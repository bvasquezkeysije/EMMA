from __future__ import annotations

try:
    import psycopg
    from psycopg.rows import dict_row
    HAS_DB = True
except ImportError:
    HAS_DB = False

DSN = "postgresql://postgres:postgres@localhost:5432/emma-db"


def get_connection():
    return psycopg.connect(DSN, autocommit=True, row_factory=dict_row)
