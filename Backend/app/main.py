from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.db import init_db, SessionLocal
from app.db_shadow import ShadowSessionLocal, init_shadow_db
from app.seed_data import seed
from app.routes.access_code import router as access_code_router
from app.routes.pilots import router as pilots_router
from app.routes.engineers import router as engineers_router
from app.routes.aircraft import router as aircraft_router
from app.routes.training import router as training_router
from app.routes.simulation import router as simulation_router
from app.routes.documents import router as documents_router
from app.routes.maintenance import router as maintenance_router
from app.routes.integrity import router as integrity_router
from app.services.integrity import compare_databases, record_integrity_event, sync_shadow_from_primary

app = FastAPI(title="AEROPS API", version="0.1.0")

static_images_dir = Path(__file__).resolve().parent / "images"
if static_images_dir.exists():
    app.mount("/images", StaticFiles(directory=str(static_images_dir)), name="images")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def integrity_middleware(request, call_next):
    if not request.url.path.startswith("/api") or request.url.path.startswith("/api/integrity"):
        return await call_next(request)

    db = SessionLocal()
    shadow_db = ShadowSessionLocal()
    try:
        mismatched = compare_databases(db, shadow_db)
    finally:
        db.close()
        shadow_db.close()

    response = await call_next(request)

    if mismatched:
        record_integrity_event(mismatched)
        response.headers["X-Data-Tampering"] = "true"
        response.headers["X-Data-Tampering-Tables"] = ",".join(mismatched)
        return response

    if response.status_code < 400:
        db = SessionLocal()
        shadow_db = ShadowSessionLocal()
        try:
            sync_shadow_from_primary(db, shadow_db)
        finally:
            db.close()
            shadow_db.close()

    return response


@app.on_event("startup")
def startup_event() -> None:
    init_db()
    init_shadow_db()
    db = SessionLocal()
    try:
        seed(db)
        shadow_db = ShadowSessionLocal()
        try:
            sync_shadow_from_primary(db, shadow_db)
        finally:
            shadow_db.close()
    finally:
        db.close()


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


app.include_router(access_code_router, prefix="/api")
app.include_router(pilots_router, prefix="/api")
app.include_router(engineers_router, prefix="/api")
app.include_router(aircraft_router, prefix="/api")
app.include_router(training_router, prefix="/api")
app.include_router(simulation_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(maintenance_router, prefix="/api")
app.include_router(integrity_router, prefix="/api")
