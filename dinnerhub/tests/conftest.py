from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def app_modules(tmp_path_factory: pytest.TempPathFactory):
    data_dir = tmp_path_factory.mktemp("dinnerhub")
    os.environ["DINNERHUB_DATABASE_URL"] = f"sqlite:///{data_dir / 'dinnerhub-test.db'}"
    os.environ["DINNERHUB_DATA_DIR"] = str(data_dir)
    os.environ["DINNERHUB_ENFORCE_INGRESS"] = "false"

    # Import the complete application only after the test environment is set.
    # Importing the application earlier would create an engine and extension
    # storage paths for /data/dinnerhub on the GitHub Actions runner.
    from app import database, main_v5

    return database, main_v5


@pytest.fixture()
def client(app_modules):
    database, main = app_modules
    database.Base.metadata.drop_all(bind=database.engine)
    database.Base.metadata.create_all(bind=database.engine)
    with TestClient(main.app) as test_client:
        yield test_client
