from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="EMMA TTS", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import datasets, training, voices
app.include_router(datasets.router)
app.include_router(training.router)
app.include_router(voices.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "emma-tts"}


frontend_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist"
frontend_index = frontend_dir / "index.html"

if frontend_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dir / "assets")), name="assets")

    @app.middleware("http")
    async def spa_middleware(request, call_next):
        response = await call_next(request)
        if response.status_code == 404:
            path = request.url.path
            if path.startswith("/v1/") or path == "/health" or path.startswith("/assets/"):
                return JSONResponse({"detail": "Not Found"}, status_code=404)
            file_path = frontend_dir / path.lstrip("/")
            if file_path.exists() and file_path.is_file():
                return FileResponse(str(file_path))
            return FileResponse(str(frontend_index))
        return response
