import tempfile
from pathlib import Path
from typing import Optional

from app.config import MODELS_DIR, OUTPUT_DIR


class TTSEngine:
    def __init__(self):
        self._model = None
        self._loaded_voice = None

    def _load_model(self, voice: str):
        model_path = MODELS_DIR / voice
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {voice}")
        self._loaded_voice = voice

    def synthesize(self, text: str, voice: str, language: str = "es", speed: float = 1.0) -> Path:
        if self._loaded_voice != voice:
            self._load_model(voice)
        output = OUTPUT_DIR / f"{hash(text)}.wav"
        output.parent.mkdir(parents=True, exist_ok=True)
        return output

    def list_voices(self) -> list[str]:
        voices = []
        for d in MODELS_DIR.iterdir():
            if d.is_dir() and d.name != "__pycache__":
                voices.append(d.name)
        return voices if voices else ["default"]


tts = TTSEngine()
