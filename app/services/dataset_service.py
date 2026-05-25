import json
import uuid
import shutil
from pathlib import Path
from typing import Optional
from datetime import datetime
import soundfile as sf

from app.config import DATASETS_DIR
from app.services.preprocess import split_long_audio, analyze_audio


def list_datasets() -> list[dict]:
    datasets = []
    for d in DATASETS_DIR.iterdir():
        if d.is_dir():
            meta = _load_metadata(d)
            if meta:
                datasets.append(meta)
    return datasets


def get_dataset(dataset_id: str) -> Optional[dict]:
    d = DATASETS_DIR / dataset_id
    if not d.exists():
        return None
    return _load_metadata(d)


def create_dataset(name: str, language: str = "es") -> dict:
    dataset_id = str(uuid.uuid4())[:8]
    path = DATASETS_DIR / dataset_id
    path.mkdir(parents=True, exist_ok=True)
    audio_dir = path / "audio"
    audio_dir.mkdir(exist_ok=True)
    meta = {
        "id": dataset_id,
        "name": name,
        "language": language,
        "created": datetime.now().isoformat(),
        "audio_count": 0,
        "duration_seconds": 0.0,
        "status": "created",
        "path": str(path),
    }
    _save_metadata(path, meta)
    return meta


def delete_dataset(dataset_id: str):
    d = DATASETS_DIR / dataset_id
    if d.exists():
        shutil.rmtree(d)


def update_dataset_name(dataset_id: str, name: str) -> Optional[dict]:
    d = DATASETS_DIR / dataset_id
    if not d.exists():
        return None
    meta = _load_metadata(d)
    if not meta:
        return None
    meta["name"] = name
    _save_metadata(d, meta)
    return meta


def import_audio(dataset_id: str, file_paths: list[Path]) -> dict:
    d = DATASETS_DIR / dataset_id
    audio_dir = d / "audio"
    audio_dir.mkdir(exist_ok=True)
    clips_dir = d / "clips"
    clips_dir.mkdir(exist_ok=True)

    imported = []
    for fp in file_paths:
        if fp.suffix.lower() not in (".wav", ".mp3", ".m4a", ".flac", ".ogg"):
            continue
        dest = audio_dir / f"{uuid.uuid4().hex[:12]}{fp.suffix}"
        shutil.copy2(str(fp), str(dest))
        clips = split_long_audio(dest, clips_dir)
        imported.extend(clips)

    meta = _load_metadata(d)
    meta["audio_count"] = len(list(audio_dir.glob("*")))
    meta["status"] = "ready"
    _save_metadata(d, meta)
    return meta


def split_dataset_audios(dataset_id: str, max_duration: int = 12) -> dict:
    d = DATASETS_DIR / dataset_id
    audio_dir = d / "audio"
    clips_dir = d / "clips"
    clips_dir.mkdir(exist_ok=True)

    total = 0
    for f in audio_dir.glob("*"):
        if f.suffix.lower() in (".wav", ".mp3", ".m4a", ".flac"):
            clips = split_long_audio(f, clips_dir, max_seconds=max_duration)
            total += len(clips)

    meta = _load_metadata(d)
    meta["clip_count"] = total
    _save_metadata(d, meta)
    return meta


def list_dataset_audios(dataset_id: str) -> list[dict]:
    d = DATASETS_DIR / dataset_id / "audio"
    if not d.exists():
        return []
    rows = []
    for fp in sorted(d.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True):
        if not fp.is_file():
            continue
        stat = fp.stat()
        rows.append(
            {
                "name": fp.name,
                "size_bytes": stat.st_size,
                "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            }
        )
    return rows


def delete_dataset_audio(dataset_id: str, file_name: str) -> bool:
    audio_dir = DATASETS_DIR / dataset_id / "audio"
    fp = audio_dir / Path(file_name).name
    if not fp.exists() or not fp.is_file():
        return False
    fp.unlink()
    return True


def trim_dataset_audio(dataset_id: str, file_name: str, start_seconds: float, end_seconds: float) -> bool:
    audio_dir = DATASETS_DIR / dataset_id / "audio"
    fp = audio_dir / Path(file_name).name
    if not fp.exists() or not fp.is_file():
        return False

    data, sr = sf.read(str(fp), always_2d=True)
    total = data.shape[0]
    start_idx = max(0, int(start_seconds * sr))
    end_idx = min(total, int(end_seconds * sr))
    if end_idx <= start_idx:
        return False

    trimmed = data[start_idx:end_idx]
    sf.write(str(fp), trimmed, sr)
    return True


def get_training_csv(dataset_id: str) -> Optional[Path]:
    d = DATASETS_DIR / dataset_id
    if not d.exists():
        return None
    clips_dir = d / "clips"
    csv_path = d / "metadata.csv"
    rows = []
    for f in sorted(clips_dir.glob("*.wav")):
        rel = str(f.relative_to(d))
        info = analyze_audio(f)
        rows.append(f"{rel}|{info['duration']:.2f}")
    csv_path.write_text("\n".join(rows), encoding="utf-8")
    return csv_path


def _load_metadata(path: Path) -> Optional[dict]:
    meta_file = path / "metadata.json"
    if meta_file.exists():
        return json.loads(meta_file.read_text(encoding="utf-8"))
    return None


def _save_metadata(path: Path, meta: dict):
    meta_file = path / "metadata.json"
    meta_file.write_text(json.dumps(meta, indent=2), encoding="utf-8")
