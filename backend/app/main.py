import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import assert_production_safe, get_settings
from app.db import init_db
from app.routers import account, auth, core, ops, payments, public, workspace

log = logging.getLogger("crew")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if get_settings().auto_create_tables:  # set AUTO_CREATE_TABLES=false once you run `alembic upgrade head`
        init_db()
    yield


def create_app() -> FastAPI:
    s = get_settings()
    assert_production_safe(s)
    app = FastAPI(title="CREW API", version="0.5.0", lifespan=lifespan,
                  description="Backend for CREW: the structured layer between 'I got a client' and 'the job is completed and paid for'.")
    app.add_middleware(CORSMiddleware, allow_origins=list(s.cors_origins), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        start = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        # Never log tokens or share-link secrets: log the route template, not the raw path.
        route = request.scope.get("route")
        log.info("%s %s -> %s %.0fms rid=%s", request.method, getattr(route, "path", "?"), response.status_code, (time.perf_counter() - start) * 1000, rid)
        return response

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException):
        # openapi.yaml `Error` schema is {"error": string}
        return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        fields = [{"field": ".".join(str(x) for x in e["loc"] if x != "body"), "message": e["msg"]} for e in exc.errors()]
        first = fields[0] if fields else {"field": "", "message": "invalid request"}
        return JSONResponse({"error": f"{first['field']}: {first['message']}".strip(": "), "fields": fields}, status_code=422)

    for r in (auth.router, core.router, workspace.router, payments.router, public.router, account.router, ops.router):
        app.include_router(r, prefix="/api")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
