from pydantic import BaseModel
from typing import Optional

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    username: str
    session_hours: int


class DatasetCreate(BaseModel):
    name: str
    language: str = "es"

class DatasetUpdate(BaseModel):
    name: str

class DatasetResponse(BaseModel):
    id: str
    name: str
    language: str
    audio_count: int
    duration_seconds: float
    status: str

class TrainRequest(BaseModel):
    dataset_id: str
    language: str = "es"
    epochs: int = 30
    learning_rate: float = 5e-6
    output_model_name: str = "best_model"

class TrainStatus(BaseModel):
    running: bool
    current_epoch: int = 0
    total_epochs: int = 0
    progress: float = 0.0
    loss: Optional[float] = None
    message: str = ""

class TTSRequest(BaseModel):
    text: str
    voice: str = "default"
    language: str = "es"
    speed: float = 1.0
    engine: str = "coqui_xtts_v2"
    dataset_id: Optional[str] = None

class SplitRequest(BaseModel):
    max_duration: int = 12


class TrimRequest(BaseModel):
    start_seconds: float
    end_seconds: float


class DatasetSettingsUpdate(BaseModel):
    engine: str = "coqui_xtts_v2"
    audio_channels: str = "mono"
    sample_rate: int = 22050
    quality_mode: str = "balanced"
    speed_rate: float = 1.0
    precision_mode: str = "fp16"
    temperature: float = 0.70
    top_k: int = 50
    top_p: float = 0.90
    noise_scale: float = 0.45
