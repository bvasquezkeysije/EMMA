import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")

app = FastAPI(title="EMMA TTS", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import datasets, training, voices, auth
app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(training.router)
app.include_router(voices.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "emma-tts"}


frontend_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist"
frontend_index = frontend_dir / "index.html"
assets_dir = frontend_dir / "assets"

if frontend_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/favicon.svg")
    def favicon():
        return FileResponse(str(frontend_dir / "favicon.svg"))

    @app.get("/icons.svg")
    def icons():
        return FileResponse(str(frontend_dir / "icons.svg"))

    @app.get("/")
    def root():
        return FileResponse(str(frontend_index))

    @app.exception_handler(404)
    async def spa_404(request, exc):
        path = request.url.path
        if path.startswith("/v1/") or path == "/health" or path.startswith("/assets/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        return FileResponse(str(frontend_index))
