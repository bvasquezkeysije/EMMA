import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATASETS_DIR = DATA_DIR / "datasets"
MODELS_DIR = DATA_DIR / "models"
OUTPUT_DIR = DATA_DIR / "output"

DATASETS_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SPLIT_DURATION = int(os.getenv("SPLIT_DURATION", "12"))
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "239"))
TRAINING_EPOCHS = int(os.getenv("TRAINING_EPOCHS", "30"))
LEARNING_RATE = float(os.getenv("LEARNING_RATE", "5e-6"))
