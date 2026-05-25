from __future__ import annotations

import re
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
    imported = []
    for fp in file_paths:
        if fp.suffix.lower() not in (".wav", ".mp3", ".m4a", ".flac", ".ogg"):
            continue
        dest = audio_dir / Path(fp.name).name
        if dest.resolve() != fp.resolve():
            shutil.copy2(str(fp), str(dest))
        imported.append(dest)

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


def split_single_dataset_audio(dataset_id: str, file_name: str, max_duration: int = 12) -> dict:
    d = DATASETS_DIR / dataset_id
    audio_dir = _resolve_audio_dir(d)

    fp = audio_dir / Path(file_name).name
    if not fp.exists() or not fp.is_file():
        return {"ok": False, "clip_count": 0}

    # Dividir directamente dentro de wavs para que el stream y la UI los vean.
    clips = split_long_audio(fp, audio_dir, max_seconds=max_duration)

    # Si no se generaron partes, no tocar el original.
    if not clips:
        return {"ok": True, "clip_count": 0}

    if HAS_DB and clips:
        with get_connection() as conn:
            # Reemplazar original por las partes en DB.
            conn.execute(
                "DELETE FROM dataset_audios WHERE dataset_id = %s AND (stored_name = %s OR original_name = %s)",
                (int(dataset_id), file_name, file_name),
            )
            for clip in clips:
                info = analyze_audio(clip)
                conn.execute(
                    "INSERT INTO dataset_audios (dataset_id, stored_name, original_name, size_bytes, duration_seconds) VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
                    (int(dataset_id), clip.name, clip.name, clip.stat().st_size, info["duration"]),
                )

    # Eliminar el original para que solo queden las partes.
    try:
        fp.unlink()
    except OSError:
        pass

    return {"ok": True, "clip_count": len(clips)}


def list_dataset_audios(dataset_id: str) -> list[dict]:
    if not HAS_DB:
        return []
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, stored_name, original_name, size_bytes, duration_seconds, created_at FROM dataset_audios WHERE dataset_id = %s ORDER BY created_at DESC",
            (int(dataset_id),),
        ).fetchall()
        items = [
            {
                "name": r["original_name"],
                "stored_name": r["stored_name"],
                "size_bytes": r["size_bytes"],
                "duration_seconds": float(r["duration_seconds"] or 0),
                "updated_at": r["created_at"].isoformat() if r.get("created_at") else datetime.now().isoformat(),
            }
            for r in rows
        ]
        part_pattern = re.compile(r"^(.*)_part(\d+)(\.[^.]+)?$", re.IGNORECASE)

        def audio_sort_key(item: dict):
            name = str(item.get("name") or item.get("stored_name") or "").strip()
            m = part_pattern.match(name)
            if m:
                base = m.group(1).lower()
                part_num = int(m.group(2))
                return (0, base, part_num, name.lower())
            return (1, name.lower(), 0, name.lower())

        items.sort(key=audio_sort_key)
        return items


def delete_dataset_audio(dataset_id: str, file_name: str) -> bool:
    audio_dir = _resolve_audio_dir(DATASETS_DIR / str(dataset_id))
    fp = audio_dir / Path(file_name).name
    file_deleted = False
    if fp.exists() and fp.is_file():
        fp.unlink()
        file_deleted = True

    db_deleted = False
    if HAS_DB:
        with get_connection() as conn:
            cur = conn.execute(
                "DELETE FROM dataset_audios WHERE dataset_id = %s AND (stored_name = %s OR original_name = %s)",
                (int(dataset_id), file_name, file_name),
            )
            db_deleted = (cur.rowcount or 0) > 0

    # Considerar exito si se elimino archivo o al menos el registro en DB.
    return file_deleted or db_deleted


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


def get_dataset_settings(dataset_id: str) -> dict:
    defaults = {
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
    if not HAS_DB:
        return defaults
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT engine, audio_channels, sample_rate, quality_mode, speed_rate,
                   precision_mode, temperature, top_k, top_p, noise_scale
            FROM dataset_settings
            WHERE dataset_id = %s
            """,
            (int(dataset_id),),
        ).fetchone()
        if not row:
            return defaults
        return {
            "engine": row["engine"] or defaults["engine"],
            "audio_channels": row["audio_channels"] or defaults["audio_channels"],
            "sample_rate": int(row["sample_rate"] or defaults["sample_rate"]),
            "quality_mode": row["quality_mode"] or defaults["quality_mode"],
            "speed_rate": float(row["speed_rate"] or defaults["speed_rate"]),
            "precision_mode": row["precision_mode"] or defaults["precision_mode"],
            "temperature": float(row["temperature"] or defaults["temperature"]),
            "top_k": int(row["top_k"] or defaults["top_k"]),
            "top_p": float(row["top_p"] or defaults["top_p"]),
            "noise_scale": float(row["noise_scale"] or defaults["noise_scale"]),
        }


def save_dataset_settings(dataset_id: str, settings: dict) -> dict:
    if not HAS_DB:
        return settings
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO dataset_settings (
              dataset_id, engine, audio_channels, sample_rate, quality_mode,
              speed_rate, precision_mode, temperature, top_k, top_p, noise_scale, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (dataset_id) DO UPDATE SET
              engine = EXCLUDED.engine,
              audio_channels = EXCLUDED.audio_channels,
              sample_rate = EXCLUDED.sample_rate,
              quality_mode = EXCLUDED.quality_mode,
              speed_rate = EXCLUDED.speed_rate,
              precision_mode = EXCLUDED.precision_mode,
              temperature = EXCLUDED.temperature,
              top_k = EXCLUDED.top_k,
              top_p = EXCLUDED.top_p,
              noise_scale = EXCLUDED.noise_scale,
              updated_at = NOW()
            """,
            (
                int(dataset_id),
                settings["engine"],
                settings["audio_channels"],
                int(settings["sample_rate"]),
                settings["quality_mode"],
                float(settings["speed_rate"]),
                settings["precision_mode"],
                float(settings["temperature"]),
                int(settings["top_k"]),
                float(settings["top_p"]),
                float(settings["noise_scale"]),
            ),
        )
    return get_dataset_settings(dataset_id)
