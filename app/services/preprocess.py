from pathlib import Path
import torchaudio
import torch

from app.config import SPLIT_DURATION


def split_long_audio(input_path: Path, output_dir: Path, max_seconds: int = SPLIT_DURATION):
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = input_path.stem
    info = torchaudio.info(str(input_path))
    sample_rate = info.sample_rate
    total_frames = info.num_frames
    max_frames = max_seconds * sample_rate

    if total_frames <= max_frames:
        dest = output_dir / f"{stem}.wav"
        if not dest.exists():
            waveform, sr = torchaudio.load(str(input_path))
            torchaudio.save(str(dest), waveform, sr)
            return [dest]
        return [dest]

    clips = []
    waveform, sr = torchaudio.load(str(input_path))
    for i, start in enumerate(range(0, total_frames, max_frames)):
        end = min(start + max_frames, total_frames)
        clip = waveform[:, start:end]
        clip_path = output_dir / f"{stem}_part{i+1:04d}.wav"
        torchaudio.save(str(clip_path), clip, sr)
        clips.append(clip_path)
    return clips


def analyze_audio(path: Path) -> dict:
    info = torchaudio.info(str(path))
    return {
        "path": str(path),
        "sample_rate": info.sample_rate,
        "duration": info.num_frames / info.sample_rate,
        "channels": info.num_channels,
    }
