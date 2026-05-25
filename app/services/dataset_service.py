from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

import soundfile as sf

from app.config import DATASETS_DIR
from app.db import HAS_DB, get_connection
from app.services.preprocess import split_long_audio, analyze_audio

PRIMARY_AUDIO_DIR_NAME = "wavs"
LEGACY_AUDIO_DIR_NAME = "audio"


def _get_next_codigo() -> str:
    if not HAS_DB:
        return "DS-001"
    with get_connection() as conn:
        row = conn.execute("SELECT COUNT(*) AS cnt FROM datasets").fetchone()
        return f"DS-{row['cnt'] + 1:03d}"


def _row_to_dict(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["nombre"],
        "language": row.get("language", "es"),
        "created": row["created_at"].isoformat() if row.get("created_at") else datetime.now().isoformat(),
        "audio_count": row.get("audio_count", 0),
        "duration_seconds": float(row.get("duration_seconds", 0.0)),
        "status": row.get("status", "created"),
        "codigo": row.get("codigo", ""),
    }


def _resolve_audio_dir(dataset_root: Path) -> Path:
    wavs_dir = dataset_root / PRIMARY_AUDIO_DIR_NAME
    legacy_dir = dataset_root / LEGACY_AUDIO_DIR_NAME
    if wavs_dir.exists():
        return wavs_dir
    if legacy_dir.exists():
        return legacy_dir
    wavs_dir.mkdir(parents=True, exist_ok=True)
    return wavs_dir


def list_datasets() -> list[dict]:
    if not HAS_DB:
        return []
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT d.*, COUNT(da.id) AS audio_count
            FROM datasets d
            LEFT JOIN dataset_audios da ON da.dataset_id = d.id
            GROUP BY d.id
            ORDER BY d.created_at DESC
        """).fetchall()
        return [_row_to_dict(r) for r in rows]


def get_dataset(dataset_id: str) -> Optional[dict]:
    if not HAS_DB:
        return None
    with get_connection() as conn:
        row = conn.execute("""
            SELECT d.*, COUNT(da.id) AS audio_count
            FROM datasets d
            LEFT JOIN dataset_audios da ON da.dataset_id = d.id
            WHERE d.id = %s
            GROUP BY d.id
        """, (int(dataset_id),)).fetchone()
        if not row:
            return None
        return _row_to_dict(row)


def create_dataset(name: str, language: str = "es") -> dict:
    if not HAS_DB:
        return {}
    with get_connection() as conn:
        codigo = _get_next_codigo()
        row = conn.execute(
            "INSERT INTO datasets (nombre, language, status, codigo, creador_user_id) VALUES (%s, %s, 'created', %s, 1) RETURNING *",
            (name, language, codigo),
        ).fetchone()
        dataset_id = row["id"]
        audio_dir = DATASETS_DIR / str(dataset_id) / PRIMARY_AUDIO_DIR_NAME
        audio_dir.mkdir(parents=True, exist_ok=True)
        return _row_to_dict(row)


def delete_dataset(dataset_id: str):
    if not HAS_DB:
        return
    with get_connection() as conn:
        conn.execute("DELETE FROM datasets WHERE id = %s", (int(dataset_id),))
    d = DATASETS_DIR / str(dataset_id)
    if d.exists():
        shutil.rmtree(d)


def update_dataset_name(dataset_id: str, name: str) -> Optional[dict]:
    if not HAS_DB:
        return None
    with get_connection() as conn:
        row = conn.execute(
            "UPDATE datasets SET nombre = %s WHERE id = %s RETURNING *",
            (name, int(dataset_id)),
        ).fetchone()
        if not row:
            return None
        return _row_to_dict(row)


def import_audio(dataset_id: str, file_paths: list[Path]) -> dict:
    if not HAS_DB:
        return {}
    d = DATASETS_DIR / dataset_id
    audio_dir = _resolve_audio_dir(d)
    audio_dir.mkdir(exist_ok=True)
    clips_dir = d / "clips"
    clips_dir.mkdir(exist_ok=True)

    imported = []
    for fp in file_paths:
        if fp.suffix.lower() not in (".wav", ".mp3", ".m4a", ".flac", ".ogg"):
            continue
        dest = audio_dir / Path(fp.name).name
        shutil.copy2(str(fp), str(dest))
        imported.append(dest)
        clips = split_long_audio(dest, clips_dir)
        imported.extend(clips)

    with get_connection() as conn:
        for clip in imported:
            info = analyze_audio(clip)
            conn.execute(
                "INSERT INTO dataset_audios (dataset_id, stored_name, original_name, size_bytes, duration_seconds) VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
                (int(dataset_id), clip.name, clip.name, clip.stat().st_size, info["duration"]),
            )
        conn.execute(
            "UPDATE datasets SET status = 'ready' WHERE id = %s",
            (int(dataset_id),),
        )

    return get_dataset(dataset_id) or {}


def split_dataset_audios(dataset_id: str, max_duration: int = 12) -> dict:
    d = DATASETS_DIR / dataset_id
    audio_dir = _resolve_audio_dir(d)
    clips_dir = d / "clips"
    clips_dir.mkdir(exist_ok=True)

    total = 0
    new_clips: list[Path] = []
    for f in audio_dir.glob("*"):
        if f.suffix.lower() in (".wav", ".mp3", ".m4a", ".flac"):
            clips = split_long_audio(f, clips_dir, max_seconds=max_duration)
            total += len(clips)
            new_clips.extend(clips)

    if HAS_DB:
        with get_connection() as conn:
            for clip in new_clips:
                info = analyze_audio(clip)
                conn.execute(
                    "INSERT INTO dataset_audios (dataset_id, stored_name, original_name, size_bytes, duration_seconds) VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
                    (int(dataset_id), clip.name, clip.name, clip.stat().st_size, info["duration"]),
                )

    meta = get_dataset(dataset_id) or {}
    meta["clip_count"] = total
    return meta


def list_dataset_audios(dataset_id: str) -> list[dict]:
    if not HAS_DB:
        return []
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, stored_name, original_name, size_bytes, duration_seconds, created_at FROM dataset_audios WHERE dataset_id = %s ORDER BY created_at DESC",
            (int(dataset_id),),
        ).fetchall()
        return [
            {
                "name": r["original_name"],
                "stored_name": r["stored_name"],
                "size_bytes": r["size_bytes"],
                "duration_seconds": float(r["duration_seconds"] or 0),
                "updated_at": r["created_at"].isoformat() if r.get("created_at") else datetime.now().isoformat(),
            }
            for r in rows
        ]


def delete_dataset_audio(dataset_id: str, file_name: str) -> bool:
    audio_dir = _resolve_audio_dir(DATASETS_DIR / str(dataset_id))
    fp = audio_dir / Path(file_name).name
    found = False
    if fp.exists() and fp.is_file():
        fp.unlink()
        found = True

    if HAS_DB:
        with get_connection() as conn:
            conn.execute(
                "DELETE FROM dataset_audios WHERE dataset_id = %s AND (stored_name = %s OR original_name = %s)",
                (int(dataset_id), file_name, file_name),
            )
    return found


def trim_dataset_audio(dataset_id: str, file_name: str, start_seconds: float, end_seconds: float) -> bool:
    audio_dir = _resolve_audio_dir(DATASETS_DIR / str(dataset_id))
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

    if HAS_DB:
        new_duration = (end_idx - start_idx) / sr
        new_size = fp.stat().st_size
        with get_connection() as conn:
            conn.execute(
                "UPDATE dataset_audios SET size_bytes = %s, duration_seconds = %s WHERE dataset_id = %s AND (stored_name = %s OR original_name = %s)",
                (new_size, new_duration, int(dataset_id), file_name, file_name),
            )
    return True


def get_training_csv(dataset_id: str) -> Optional[Path]:
    d = DATASETS_DIR / str(dataset_id)
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
