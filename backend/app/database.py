"""Small SQLite persistence layer for saved laboratory runs.

The algorithm catalogue stays in code because it contains executable functions and
pedagogical metadata.  Raw measured runs are deliberately kept separate here.
"""

import json
import platform
import sqlite3
import statistics
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


DB_PATH = Path(__file__).resolve().parents[1] / "data" / "daa_visualizer.db"


@contextmanager
def _connection() -> Iterator[sqlite3.Connection]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database() -> None:
    with _connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS modules (
                id INTEGER PRIMARY KEY,
                module_number INTEGER UNIQUE NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS algorithms (
                id TEXT PRIMARY KEY,
                module_number INTEGER NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                worst_case TEXT NOT NULL,
                space_complexity TEXT NOT NULL,
                description TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS experiments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                algorithm_id TEXT NOT NULL,
                title TEXT,
                input_json TEXT NOT NULL,
                result_json TEXT NOT NULL,
                metrics_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS benchmark_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                algorithm_id TEXT NOT NULL,
                input_size INTEGER NOT NULL,
                case_type TEXT NOT NULL,
                trial_number INTEGER NOT NULL,
                execution_time_ms REAL NOT NULL,
                operation_count INTEGER NOT NULL,
                python_version TEXT NOT NULL DEFAULT '',
                platform TEXT NOT NULL DEFAULT '',
                timer TEXT NOT NULL DEFAULT 'time.perf_counter_ns',
                created_at TEXT NOT NULL
            );
            """
        )
        benchmark_columns = {row["name"] for row in connection.execute("PRAGMA table_info(benchmark_runs)")}
        if "python_version" not in benchmark_columns:
            connection.execute("ALTER TABLE benchmark_runs ADD COLUMN python_version TEXT NOT NULL DEFAULT ''")
        if "platform" not in benchmark_columns:
            connection.execute("ALTER TABLE benchmark_runs ADD COLUMN platform TEXT NOT NULL DEFAULT ''")
        if "timer" not in benchmark_columns:
            connection.execute("ALTER TABLE benchmark_runs ADD COLUMN timer TEXT NOT NULL DEFAULT 'time.perf_counter_ns'")


def sync_catalogue(modules: list[dict[str, Any]], algorithms: list[dict[str, Any]]) -> None:
    """Keep database metadata aligned with the executable registry at startup."""
    with _connection() as connection:
        connection.executemany(
            """
            INSERT INTO modules (module_number, title, description)
            VALUES (:number, :title, :description)
            ON CONFLICT(module_number) DO UPDATE SET title = excluded.title, description = excluded.description
            """,
            modules,
        )
        connection.executemany(
            """
            INSERT INTO algorithms (id, module_number, name, category, worst_case, space_complexity, description)
            VALUES (:id, :module, :name, :category, :worst_case, :space_complexity, :description)
            ON CONFLICT(id) DO UPDATE SET
                module_number = excluded.module_number,
                name = excluded.name,
                category = excluded.category,
                worst_case = excluded.worst_case,
                space_complexity = excluded.space_complexity,
                description = excluded.description
            """,
            algorithms,
        )


def save_experiment(payload: dict[str, Any]) -> dict[str, Any]:
    created_at = datetime.now(timezone.utc).isoformat()
    with _connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO experiments
                (algorithm_id, title, input_json, result_json, metrics_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload["algorithm_id"],
                payload.get("title"),
                json.dumps(payload["input"]),
                json.dumps(payload["result"]),
                json.dumps(payload["metrics"]),
                created_at,
            ),
        )
    return {"id": cursor.lastrowid, "created_at": created_at}


def list_experiments(limit: int = 30) -> list[dict[str, Any]]:
    with _connection() as connection:
        rows = connection.execute(
            """
            SELECT id, algorithm_id, title, input_json, result_json, metrics_json, created_at
            FROM experiments ORDER BY id DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "algorithm_id": row["algorithm_id"],
            "title": row["title"],
            "input": json.loads(row["input_json"]),
            "result": json.loads(row["result_json"]),
            "metrics": json.loads(row["metrics_json"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def experiment_summary(limit: int = 5) -> dict[str, Any]:
    """Return the true saved-run count and a compact recent sample."""
    with _connection() as connection:
        total = connection.execute("SELECT COUNT(*) FROM experiments").fetchone()[0]
        rows = connection.execute(
            """
            SELECT id, algorithm_id, title, input_json, result_json, metrics_json, created_at
            FROM experiments ORDER BY id DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    recent = [
        {
            "id": row["id"],
            "algorithm_id": row["algorithm_id"],
            "title": row["title"],
            "input": json.loads(row["input_json"]),
            "result": json.loads(row["result_json"]),
            "metrics": json.loads(row["metrics_json"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]
    return {"total": total, "recent": recent}


def save_benchmark_rows(rows: list[dict[str, Any]]) -> None:
    created_at = datetime.now(timezone.utc).isoformat()
    with _connection() as connection:
        connection.executemany(
            """
            INSERT INTO benchmark_runs
              (algorithm_id, input_size, case_type, trial_number, execution_time_ms, operation_count,
               python_version, platform, timer, created_at)
            VALUES (:algorithm_id, :input_size, :case_type, :trial_number, :execution_time_ms, :operation_count,
               :python_version, :platform, :timer, :created_at)
            """,
            [{**row, "created_at": created_at} for row in rows],
        )


def list_recent_benchmarks(limit: int = 5) -> list[dict[str, Any]]:
    """Return genuine benchmark batches, summarized by input size."""
    with _connection() as connection:
        batches = connection.execute(
            """
            SELECT algorithm_id, case_type, created_at, MAX(id) AS last_id,
                   COUNT(DISTINCT trial_number) AS trials
            FROM benchmark_runs
            GROUP BY algorithm_id, case_type, created_at
            ORDER BY last_id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        summaries = []
        for batch in batches:
            rows = connection.execute(
                """
                SELECT input_size, execution_time_ms, operation_count
                FROM benchmark_runs
                WHERE algorithm_id = ? AND case_type = ? AND created_at = ?
                ORDER BY input_size, trial_number
                """,
                (batch["algorithm_id"], batch["case_type"], batch["created_at"]),
            ).fetchall()
            by_size: dict[int, list[sqlite3.Row]] = {}
            for row in rows:
                by_size.setdefault(row["input_size"], []).append(row)
            summaries.append(
                {
                    "algorithm_id": batch["algorithm_id"],
                    "case_type": batch["case_type"],
                    "created_at": batch["created_at"],
                    "trials": batch["trials"],
                    "points": [
                        {
                            "input_size": size,
                            "median_time_ms": round(statistics.median(row["execution_time_ms"] for row in samples), 5),
                            "median_operations": round(statistics.median(row["operation_count"] for row in samples), 1),
                        }
                        for size, samples in sorted(by_size.items())
                    ],
                }
            )
    return summaries
