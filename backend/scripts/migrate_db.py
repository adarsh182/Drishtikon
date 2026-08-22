"""Idempotent database migration script to safely add new columns to CommentAnalysis."""

import os
import sys
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.connection import engine, is_sqlite


NEW_COLUMNS = [
    ("detected_language", "VARCHAR(20)"),
    ("language_confidence", "FLOAT"),
    ("embedding", "TEXT"),
    ("aspect", "VARCHAR(100)"),
    ("aspect_confidence", "FLOAT"),
    ("argument_evidence", "TEXT"),
    ("embedding_model", "VARCHAR(200)"),
]


def run_migration():
    print(f"Running idempotent migration on: {engine.url.render_as_string(hide_password=True)}")
    with engine.connect() as conn:
        # 1. Get existing columns in comment_analyses table
        if is_sqlite:
            res = conn.execute(text("PRAGMA table_info(comment_analyses)")).fetchall()
            existing_columns = {row[1] for row in res}
        else:
            query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'comment_analyses'
            """)
            res = conn.execute(query).fetchall()
            existing_columns = {row[0] for row in res}

        print(f"Existing columns ({len(existing_columns)}): {existing_columns}")

        # 2. Add missing columns
        added = 0
        for col_name, col_type in NEW_COLUMNS:
            if col_name not in existing_columns:
                print(f"  + Adding column: {col_name} ({col_type})")
                alter_stmt = text(f"ALTER TABLE comment_analyses ADD COLUMN {col_name} {col_type}")
                conn.execute(alter_stmt)
                added += 1
            else:
                print(f"  ✓ Column already exists: {col_name}")

        conn.commit()
        print(f"Migration completed successfully. Added {added} new columns.")


if __name__ == "__main__":
    run_migration()
