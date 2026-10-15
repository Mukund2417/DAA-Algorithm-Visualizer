import pytest
from pathlib import Path
from tempfile import TemporaryDirectory
from fastapi.testclient import TestClient

from app import database
from app.main import app


@pytest.fixture
def api_client(monkeypatch):
    with TemporaryDirectory(prefix=".test-db-", dir=Path(__file__).resolve().parents[1]) as temp_dir:
        monkeypatch.setattr(database, "DB_PATH", Path(temp_dir) / "test.db")
        with TestClient(app) as client:
            yield client
