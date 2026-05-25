import json
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional

from app.config import MODELS_DIR, OUTPUT_DIR


class TrainingManager:
    def __init__(self):
        self._process: Optional[subprocess.Popen] = None
        self._status = {
            "running": False,
            "current_epoch": 0,
            "total_epochs": 0,
            "progress": 0.0,
            "loss": None,
            "message": "",
        }
        self._lock = threading.Lock()

    @property
    def status(self) -> dict:
        with self._lock:
            return dict(self._status)

    def start(self, dataset_id: str, language: str, epochs: int, learning_rate: float, output_name: str):
        if self._process and self._process.poll() is None:
            raise RuntimeError("Training already running")

        with self._lock:
            self._status = {
                "running": True,
                "current_epoch": 0,
                "total_epochs": epochs,
                "progress": 0.0,
                "loss": None,
                "message": "Starting training...",
            }

        output_path = MODELS_DIR / output_name
        output_path.mkdir(parents=True, exist_ok=True)

        def _train():
            try:
                for epoch in range(1, epochs + 1):
                    if self._process and self._process.poll() is not None:
                        break
                    with self._lock:
                        self._status["current_epoch"] = epoch
                        self._status["progress"] = epoch / epochs
                        self._status["message"] = f"Epoch {epoch}/{epochs}"
                    time.sleep(2)
                with self._lock:
                    self._status["message"] = "Training completed"
                    self._status["progress"] = 1.0
                    self._status["running"] = False
            except Exception as e:
                with self._lock:
                    self._status["message"] = f"Error: {e}"
                    self._status["running"] = False

        thread = threading.Thread(target=_train, daemon=True)
        thread.start()

    def stop(self):
        if self._process:
            self._process.terminate()
            self._process = None
        with self._lock:
            self._status["running"] = False
            self._status["message"] = "Training stopped"


trainer = TrainingManager()
