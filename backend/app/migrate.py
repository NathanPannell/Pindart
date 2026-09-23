import os
from pathlib import Path

import psycopg


def main() -> None:
    database_url = os.environ.get("DATABASE_URL_UNPOOLED")
    if not database_url:
        raise ValueError("DATABASE_URL_UNPOOLED is required for migrations")
    migration = Path(__file__).resolve().parents[1] / "migrations" / "001_oauth.sql"
    statements = [part.strip() for part in migration.read_text(encoding="utf-8").split(";") if part.strip()]
    with psycopg.connect(database_url) as conn:
        for statement in statements:
            conn.execute(statement)


if __name__ == "__main__":
    main()
