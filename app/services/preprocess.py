from pathlib import Path
import soundfile as sf

from app.config import SPLIT_DURATION


def split_long_audio(input_path: Path, output_dir: Path, max_seconds: int = SPLIT_DURATION):
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = input_path.stem
    data, sample_rate = sf.read(str(input_path), always_2d=True)
    total_frames = data.shape[0]
    max_frames = max_seconds * sample_rate

    if total_frames <= max_frames:
        dest = output_dir / f"{stem}.wav"
        if not dest.exists():
            sf.write(str(dest), data, sample_rate)
            return [dest]
        return [dest]

    clips = []
    for i, start in enumerate(range(0, total_frames, max_frames)):
        end = min(start + max_frames, total_frames)
        clip = data[start:end]
        clip_path = output_dir / f"{stem}_part{i+1:04d}.wav"
        sf.write(str(clip_path), clip, sample_rate)
        clips.append(clip_path)
    return clips


def analyze_audio(path: Path) -> dict:
    data, sample_rate = sf.read(str(path), always_2d=True)
    total_frames = data.shape[0]
    channels = data.shape[1]
    return {
        "path": str(path),
        "sample_rate": sample_rate,
        "duration": (total_frames / sample_rate) if sample_rate else 0.0,
        "channels": channels,
    }
