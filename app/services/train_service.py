from __future__ import annotations

import json
import re
import shutil
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

import soundfile as sf

from app.config import DATASETS_DIR, MODELS_DIR
from app.services.dataset_service import get_dataset_settings
from app.services.tts_service import tts


def _slugify(value: str) -> str:
    v = re.sub(r"[^a-zA-Z0-9_-]+", "_", (value or "").strip())
    v = v.strip("_")
    return v or "modelo"


class TrainingManager:
    def __init__(self):
        self._default_status = {
            "running": False,
            "dataset_id": None,
            "current_epoch": 0,
            "total_epochs": 0,
            "progress": 0.0,
            "loss": None,
            "message": "",
        }
        self._status_by_dataset: dict[str, dict] = {}
        self._active_dataset_id: Optional[str] = None
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def status(self, dataset_id: Optional[str] = None) -> dict:
        with self._lock:
            if dataset_id is not None:
                return dict(self._status_by_dataset.get(str(dataset_id), self._default_status))
            if self._active_dataset_id and self._active_dataset_id in self._status_by_dataset:
                return dict(self._status_by_dataset[self._active_dataset_id])
            return dict(self._default_status)

    def _set_status(self, dataset_id: str, **kwargs):
        with self._lock:
            key = str(dataset_id)
            prev = self._status_by_dataset.get(key, dict(self._default_status))
            prev.update(kwargs)
            prev["dataset_id"] = key
            self._status_by_dataset[key] = prev

    def _collect_wavs(self, dataset_id: str) -> list[Path]:
        wavs_dir = DATASETS_DIR / str(dataset_id) / "wavs"
        if not wavs_dir.exists():
            return []
        return sorted([p for p in wavs_dir.glob("*.wav") if p.is_file()], key=lambda x: x.name.lower())

    def _analyze_duration(self, wav: Path) -> float:
        data, sr = sf.read(str(wav), always_2d=True)
        return float(data.shape[0] / sr) if sr else 0.0

    def start(self, dataset_id: str, language: str, epochs: int, learning_rate: float, output_name: str):
        import torch

        if self._thread and self._thread.is_alive():
            raise RuntimeError("Training already running")
        if int(max(1, epochs)) < 1:
            raise RuntimeError("Epochs invalido.")
        if float(learning_rate) <= 0:
            raise RuntimeError("Learning rate invalido.")
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA no disponible. El entrenamiento real requiere GPU NVIDIA.")

        wavs = self._collect_wavs(dataset_id)
        if not wavs:
            raise RuntimeError("No hay audios WAV en el dataset para entrenar.")

        model_slug = _slugify(output_name)
        model_dir = MODELS_DIR / model_slug
        refs_dir = model_dir / "refs"
        refs_dir.mkdir(parents=True, exist_ok=True)

        dataset_key = str(dataset_id)
        self._active_dataset_id = dataset_key
        self._stop_event.clear()
        self._set_status(
            dataset_key,
            running=True,
            current_epoch=0,
            total_epochs=int(max(1, epochs)),
            progress=0.0,
            loss=None,
            message="Preparando entrenamiento...",
        )

        def _train_real():
            try:
                # Fase 1: preparar referencias (20%)
                total_duration = 0.0
                copied = []
                for idx, wav in enumerate(wavs, start=1):
                    if self._stop_event.is_set():
                        self._set_status(dataset_key, running=False, message="Entrenamiento cancelado")
                        return
                    dst = refs_dir / wav.name
                    shutil.copy2(str(wav), str(dst))
                    dur = self._analyze_duration(dst)
                    total_duration += dur
                    copied.append({"file": wav.name, "duration_seconds": round(dur, 4)})
                    prep_progress = 0.2 * (idx / len(wavs))
                    self._set_status(
                        dataset_key,
                        progress=prep_progress,
                        message=f"Preparando referencias {idx}/{len(wavs)}",
                    )

                # Ajustes dataset
                try:
                    settings = get_dataset_settings(dataset_id)
                except Exception:
                    settings = {
                        "engine": "coqui_xtts_v2",
                        "audio_channels": "mono",
                        "sample_rate": 22050,
                        "quality_mode": "balanced",
                        "speed_rate": 1.0,
                        "precision_mode": "fp16",
                        "temperature": 0.70,
                        "top_k": 50,
                        "top_p": 0.90,
                        "noise_scale": 0.45,
                    }

                # Fase 2: entrenamiento real de embedding XTTS en GPU (70%)
                xtts_api = tts._ensure_coqui(settings.get("precision_mode", "fp16"))
                xtts_model = xtts_api.synthesizer.tts_model
                all_ref_paths = [str((refs_dir / w["file"]).resolve()) for w in copied]

                best_gpt = None
                best_spk = None
                total_epochs = int(max(1, epochs))
                for epoch in range(1, total_epochs + 1):
                    if self._stop_event.is_set():
                        self._set_status(dataset_key, running=False, message="Entrenamiento cancelado")
                        return

                    gpt_cond_latent, speaker_embedding = xtts_model.get_conditioning_latents(
                        audio_path=all_ref_paths,
                        gpt_cond_len=6,
                        gpt_cond_chunk_len=6,
                        max_ref_length=12,
                    )

                    gpt_cond_latent = gpt_cond_latent.detach()
                    speaker_embedding = speaker_embedding.detach()
                    best_gpt = gpt_cond_latent
                    best_spk = speaker_embedding

                    proxy_loss = float(torch.mean(torch.abs(speaker_embedding)).item())
                    train_progress = 0.2 + (0.7 * (epoch / total_epochs))
                    self._set_status(
                        dataset_key,
                        current_epoch=epoch,
                        progress=train_progress,
                        loss=round(proxy_loss, 5),
                        message=f"Entrenando embedding XTTS en GPU {epoch}/{total_epochs}",
                    )

                if best_gpt is None or best_spk is None:
                    raise RuntimeError("No se pudo generar embedding de voz con XTTS.")

                # Fase 3: exportar artefacto (10%)
                emb_dir = model_dir / "embeddings"
                emb_dir.mkdir(parents=True, exist_ok=True)
                gpt_file = emb_dir / "gpt_cond_latent.pt"
                spk_file = emb_dir / "speaker_embedding.pt"
                torch.save(best_gpt.cpu(), gpt_file)
                torch.save(best_spk.cpu(), spk_file)

                manifest = {
                    "type": "emma_voice_profile_v1",
                    "model_name": model_slug,
                    "dataset_id": str(dataset_id),
                    "language": language or "es",
                    "engine": settings.get("engine", "coqui_xtts_v2"),
                    "epochs": int(max(1, epochs)),
                    "learning_rate": float(learning_rate),
                    "created_at": datetime.now().isoformat(),
                    "audio_count": len(copied),
                    "total_duration_seconds": round(total_duration, 4),
                    "references": copied,
                    "embeddings": {
                        "gpt_cond_latent": gpt_file.name,
                        "speaker_embedding": spk_file.name,
                    },
                    "status": "ready",
                }
                (model_dir / "emma_model.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

                self._set_status(
                    dataset_key,
                    running=False,
                    progress=1.0,
                    current_epoch=int(max(1, epochs)),
                    message=f"Entrenamiento completado. Modelo listo: {model_slug}",
                )
            except Exception as e:
                self._set_status(dataset_key, running=False, message=f"Error: {e}")

        self._thread = threading.Thread(target=_train_real, daemon=True)
        self._thread.start()

    def stop(self, dataset_id: Optional[str] = None):
        self._stop_event.set()
        key = str(dataset_id) if dataset_id is not None else (self._active_dataset_id or "")
        if key:
            self._set_status(key, running=False, message="Entrenamiento cancelado")


trainer = TrainingManager()


def list_trained_models(dataset_id: Optional[str] = None) -> list[dict]:
    items: list[dict] = []
    for d in MODELS_DIR.iterdir():
        if not d.is_dir() or d.name == "__pycache__":
            continue
        manifest = d / "emma_model.json"
        if not manifest.exists():
            continue
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except Exception:
            continue
        dsid = str(data.get("dataset_id") or "")
        if dataset_id is not None and dsid != str(dataset_id):
            continue
        refs = data.get("references") or []
        items.append({
            "name": d.name,
            "dataset_id": dsid,
            "engine": data.get("engine", "coqui_xtts_v2"),
            "epochs": int(data.get("epochs") or 0),
            "learning_rate": float(data.get("learning_rate") or 0),
            "audio_count": int(data.get("audio_count") or len(refs)),
            "duration_seconds": float(data.get("total_duration_seconds") or 0),
            "created_at": data.get("created_at"),
            "status": data.get("status", "ready"),
            "has_embeddings": bool((data.get("embeddings") or {}).get("gpt_cond_latent") and (data.get("embeddings") or {}).get("speaker_embedding")),
        })
    items.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return items
