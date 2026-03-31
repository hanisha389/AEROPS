from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.db import init_db, SessionLocal
from app.seed_data import seed
from app.routes.access_code import router as access_code_router
from app.routes.pilots import router as pilots_router
from app.routes.engineers import router as engineers_router
from app.routes.aircraft import router as aircraft_router
from app.routes.training import router as training_router
from app.routes.simulation import router as simulation_router
from app.routes.documents import router as documents_router
from app.routes.maintenance import router as maintenance_router

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


@app.on_event("startup")
def startup_event() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed(db)
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
