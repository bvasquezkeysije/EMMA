import math
import struct
import wave
from pathlib import Path
from typing import Optional

from app.config import MODELS_DIR, OUTPUT_DIR, DATASETS_DIR


class TTSEngine:
    def __init__(self):
        self._loaded_voice = None
        self._coqui_model = None
        self._f5_model = None
        self._f5_transcript_cache: dict[str, str] = {}

    def _load_model(self, voice: str):
        if voice == "default":
            self._loaded_voice = voice
            return
        model_path = MODELS_DIR / voice
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {voice}")
        self._loaded_voice = voice

    def _generate_fallback_wav(self, text: str, output: Path, speed: float) -> Path:
        output.parent.mkdir(parents=True, exist_ok=True)
        sr = 22050
        speed = max(0.7, min(1.4, float(speed or 1.0)))
        base_char_ms = int(95 / speed)
        pause_ms = int(28 / speed)
        amp = 0.23

        def write_sine(frames: bytearray, freq_hz: float, ms: int):
            n = int(sr * (ms / 1000.0))
            for i in range(n):
                env = min(1.0, i / max(1, int(0.02 * sr)))
                env *= min(1.0, (n - i) / max(1, int(0.02 * sr)))
                sample = amp * env * math.sin(2.0 * math.pi * freq_hz * (i / sr))
                frames.extend(struct.pack("<h", int(max(-1.0, min(1.0, sample)) * 32767)))

        def write_silence(frames: bytearray, ms: int):
            n = int(sr * (ms / 1000.0))
            frames.extend(b"\x00\x00" * n)

        frames = bytearray()
        text = (text or "").strip()[:600]
        if not text:
            text = "audio de prueba emma"

        for ch in text.lower():
            if ch in " .,;:!?":
                write_silence(frames, pause_ms * 2)
                continue
            if ch in "aeiouáéíóú":
                freq = 210.0
            elif ch.isdigit():
                freq = 235.0
            else:
                freq = 180.0
            write_sine(frames, freq, base_char_ms)
            write_silence(frames, pause_ms)

        with wave.open(str(output), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(bytes(frames))
        return output

    def _resolve_dataset_ref_audio(self, dataset_id: Optional[str]) -> Optional[Path]:
        if not dataset_id:
            return None
        wavs_dir = DATASETS_DIR / str(dataset_id) / "wavs"
        if not wavs_dir.exists():
            return None
        wavs = sorted([p for p in wavs_dir.glob("*.wav") if p.is_file()], key=lambda x: x.name.lower())
        return wavs[0] if wavs else None

    def _ensure_coqui(self):
        if self._coqui_model is None:
            from TTS.api import TTS
            self._coqui_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=True)
        return self._coqui_model

    def _ensure_f5(self):
        if self._f5_model is None:
            from f5_tts.api import F5TTS
            self._f5_model = F5TTS()
        return self._f5_model

    def _coqui_xtts_synthesize(self, text: str, language: str, speed: float, output: Path, dataset_id: Optional[str]) -> Path:
        ref_audio = self._resolve_dataset_ref_audio(dataset_id)
        if ref_audio is None:
            raise RuntimeError("No hay audios WAV en el dataset para clonar voz (carpeta wavs).")
        model = self._ensure_coqui()
        output.parent.mkdir(parents=True, exist_ok=True)
        model.tts_to_file(
            text=text,
            speaker_wav=str(ref_audio),
            language=language or "es",
            speed=float(speed or 1.0),
            file_path=str(output),
            split_sentences=True,
        )
        return output

    def _f5_synthesize(self, text: str, speed: float, output: Path, dataset_id: Optional[str]) -> Path:
        ref_audio = self._resolve_dataset_ref_audio(dataset_id)
        if ref_audio is None:
            raise RuntimeError("No hay audios WAV en el dataset para clonar voz (carpeta wavs).")
        model = self._ensure_f5()
        key = str(ref_audio.resolve())
        ref_text = self._f5_transcript_cache.get(key)
        if not ref_text:
            ref_text = model.transcribe(str(ref_audio)).strip()
            self._f5_transcript_cache[key] = ref_text or "Referencia de voz."
        output.parent.mkdir(parents=True, exist_ok=True)
        # F5 escribe directamente a output.
        model.infer(
            ref_file=str(ref_audio),
            ref_text=ref_text or "Referencia de voz.",
            gen_text=text,
            speed=float(speed or 1.0),
            file_wave=str(output),
            remove_silence=False,
        )
        return output

    def synthesize(
        self,
        text: str,
        voice: str,
        language: str = "es",
        speed: float = 1.0,
        engine: str = "coqui_xtts_v2",
        dataset_id: Optional[str] = None,
    ) -> Path:
        target_voice = voice or "default"
        if self._loaded_voice != target_voice:
            try:
                self._load_model(target_voice)
            except FileNotFoundError:
                target_voice = "default"
                self._loaded_voice = "default"

        safe_name = str(abs(hash((text, target_voice, language, round(float(speed or 1.0), 2), engine, dataset_id or ""))))
        output = OUTPUT_DIR / f"preview_{safe_name}.wav"
        chosen = (engine or "").strip().lower()
        try:
            if chosen == "f5_tts":
                return self._f5_synthesize(text, speed, output, dataset_id)
            if chosen == "coqui_xtts_v2":
                return self._coqui_xtts_synthesize(text, language, speed, output, dataset_id)
        except Exception:
            # Fallback solo si falla el motor real para no romper UX.
            return self._generate_fallback_wav(text, output, speed)
        return self._generate_fallback_wav(text, output, speed)

    def list_voices(self) -> list[str]:
        voices = []
        for d in MODELS_DIR.iterdir():
            if d.is_dir() and d.name != "__pycache__":
                voices.append(d.name)
        return voices if voices else ["default"]


tts = TTSEngine()
