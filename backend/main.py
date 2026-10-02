"""Entrypoint shim:  uvicorn main:app --reload   (run from the backend/ folder)"""
from app.main import app  # noqa: F401
