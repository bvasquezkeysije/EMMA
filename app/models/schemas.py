from pydantic import BaseModel
from typing import Optional

class DatasetCreate(BaseModel):
    name: str
    language: str = "es"

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

class SplitRequest(BaseModel):
    max_duration: int = 12
