import os
import pathlib
import sys

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["CREW_DEMO_MODE"] = "true"
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app import db as dbmod
from app.main import create_app
from app.seed import DEMO_EMAIL, DEMO_PASSWORD, seed_demo


@pytest.fixture()
def session_factory():
    engine = dbmod.make_engine("sqlite://")
    dbmod.Base.metadata.drop_all(engine)
    dbmod.init_db(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def client(session_factory):
    app = create_app()

    def override():
        s = session_factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[dbmod.get_db] = override
    with session_factory() as s:
        seed_demo(s)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth(client):
    r = client.post("/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}


@pytest.fixture(autouse=True)
def _fresh_sandbox_world():
    """The sandbox provider's ledger is module-level state; every test starts with an empty outside world."""
    from app.payments.adapters.sandbox import reset_sandbox
    reset_sandbox()
    yield
    reset_sandbox()
