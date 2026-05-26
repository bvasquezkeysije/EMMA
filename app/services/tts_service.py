import os
import json
from pathlib import Path
from typing import Optional

import torch

from app.config import MODELS_DIR, OUTPUT_DIR, DATASETS_DIR


def _patch_torchaudio_load_global():
    import torch
    import torchaudio
    if getattr(torchaudio.load, "_emma_patched", False):
        return
    import soundfile as sf

    def _patched_torchaudio_load(
        uri,
        frame_offset: int = 0,
        num_frames: int = -1,
        normalize: bool = True,
        channels_first: bool = True,
        format=None,
        buffer_size: int = 4096,
        backend=None,
    ):
        data, sr = sf.read(str(uri), dtype="float32", always_2d=True)
        if frame_offset > 0:
            data = data[frame_offset:]
        if num_frames is not None and num_frames > -1:
            data = data[:num_frames]
        ten = torch.from_numpy(data).transpose(0, 1)  # [ch, time]
        if not channels_first:
            ten = ten.transpose(0, 1)
        if not normalize:
            ten = (ten * 32767.0).to(torch.int16)
        return ten, sr

    _patched_torchaudio_load._emma_patched = True
    torchaudio.load = _patched_torchaudio_load


_patch_torchaudio_load_global()


class TTSEngine:
    def __init__(self):
        self._loaded_voice = None
        self._coqui_model = None
        self._f5_model = None
        self._f5_transcript_cache: dict[str, str] = {}

    def _ensure_audio_patch(self):
        _patch_torchaudio_load_global()

    def _load_model(self, voice: str):
        if voice == "default":
            self._loaded_voice = voice
            return
        model_path = MODELS_DIR / voice
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {voice}")
        self._loaded_voice = voice

    def _resolve_dataset_ref_audio(self, dataset_id: Optional[str]) -> Optional[Path]:
        if not dataset_id:
            return None
        wavs_dir = DATASETS_DIR / str(dataset_id) / "wavs"
        if not wavs_dir.exists():
            return None
        wavs = sorted([p for p in wavs_dir.glob("*.wav") if p.is_file()], key=lambda x: x.name.lower())
        return wavs[0] if wavs else None

    def _resolve_profile(self, voice: str) -> Optional[dict]:
        if not voice or voice == "default":
            return None
        model_dir = MODELS_DIR / voice
        manifest = model_dir / "emma_model.json"
        if not manifest.exists():
            return None
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
            refs = data.get("references") or []
            if refs:
                ref_name = refs[0].get("file")
                ref_path = model_dir / "refs" / str(ref_name)
                if ref_path.exists():
                    data["_ref_audio_path"] = str(ref_path)
            emb = data.get("embeddings") or {}
            gpt_name = emb.get("gpt_cond_latent")
            spk_name = emb.get("speaker_embedding")
            if gpt_name and spk_name:
                gpt_file = model_dir / "embeddings" / str(gpt_name)
                spk_file = model_dir / "embeddings" / str(spk_name)
                if gpt_file.exists() and spk_file.exists():
                    data["_gpt_cond_latent_path"] = str(gpt_file)
                    data["_speaker_embedding_path"] = str(spk_file)
            return data
        except Exception:
            return None

    def _ensure_coqui(self, precision_mode: str = "fp16"):
        if self._coqui_model is None:
            import torch
            from functools import wraps
            import torch.serialization as ts
            from TTS.tts.configs.xtts_config import XttsConfig
            from TTS.tts.models.xtts import XttsAudioConfig

            # Compatibilidad PyTorch>=2.6 con checkpoints de Coqui XTTS.
            os.environ["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"
            os.environ["TORCH_FORCE_WEIGHTS_ONLY_LOAD"] = "0"
            ts.add_safe_globals([XttsConfig, XttsAudioConfig])

            if not getattr(torch.load, "_emma_patched", False):
                _orig_torch_load = torch.load

                @wraps(_orig_torch_load)
                def _patched_torch_load(*args, **kwargs):
                    kwargs.setdefault("weights_only", False)
                    return _orig_torch_load(*args, **kwargs)

                _patched_torch_load._emma_patched = True
                torch.load = _patched_torch_load

            self._ensure_audio_patch()

            from TTS.api import TTS
            use_gpu = torch.cuda.is_available()
            self._coqui_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=use_gpu)
        return self._coqui_model

    def _ensure_f5(self):
        if self._f5_model is None:
            self._ensure_audio_patch()
            from f5_tts.api import F5TTS
            self._f5_model = F5TTS()
        return self._f5_model

    def _coqui_xtts_synthesize(
        self,
        text: str,
        language: str,
        speed: float,
        output: Path,
        dataset_id: Optional[str],
        ref_audio_override: Optional[Path],
        temperature: Optional[float],
        top_k: Optional[int],
        top_p: Optional[float],
        noise_scale: Optional[float],
        gpt_cond_latent_path: Optional[Path] = None,
        speaker_embedding_path: Optional[Path] = None,
    ) -> Path:
        model = self._ensure_coqui()
        output.parent.mkdir(parents=True, exist_ok=True)

        use_latents = bool(gpt_cond_latent_path and speaker_embedding_path and gpt_cond_latent_path.exists() and speaker_embedding_path.exists())
        kwargs = dict(
            text=text,
            language=language or "es",
            speed=float(speed or 1.0),
            file_path=str(output),
            split_sentences=True,
        )

        if use_latents:
            kwargs["speaker_wav"] = None
            kwargs["gpt_cond_latent"] = torch.load(gpt_cond_latent_path, map_location="cpu")
            kwargs["speaker_embedding"] = torch.load(speaker_embedding_path, map_location="cpu")
        else:
            ref_audio = ref_audio_override or self._resolve_dataset_ref_audio(dataset_id)
            if ref_audio is None:
                raise RuntimeError("No hay audios WAV en el dataset para clonar voz (carpeta wavs).")
            kwargs["speaker_wav"] = str(ref_audio)
        if temperature is not None:
            kwargs["temperature"] = temperature
        if top_k is not None:
            kwargs["top_k"] = top_k
        if top_p is not None:
            kwargs["top_p"] = top_p
        # XTTS (segun version de TTS/transformers) puede no aceptar noise_scale.
        # Se evita pasarlo para prevenir 500 por kwargs no soportados.
        try:
            model.tts_to_file(**kwargs)
        except Exception:
            # Fallback compatible: reintento solo con argumentos base.
            ref_audio = ref_audio_override or self._resolve_dataset_ref_audio(dataset_id)
            if ref_audio is None:
                raise RuntimeError("No hay audios WAV en el dataset para clonar voz (carpeta wavs).")
            base_kwargs = dict(
                text=text,
                speaker_wav=str(ref_audio),
                language=language or "es",
                speed=float(speed or 1.0),
                file_path=str(output),
                split_sentences=True,
            )
            model.tts_to_file(**base_kwargs)
        return output

    def _f5_synthesize(
        self,
        text: str,
        speed: float,
        output: Path,
        dataset_id: Optional[str],
        ref_audio_override: Optional[Path],
    ) -> Path:
        ref_audio = ref_audio_override or self._resolve_dataset_ref_audio(dataset_id)
        if ref_audio is None:
            raise RuntimeError("No hay audios WAV en el dataset para clonar voz (carpeta wavs).")
        model = self._ensure_f5()
        key = str(ref_audio.resolve())
        ref_text = self._f5_transcript_cache.get(key)
        if not ref_text:
            ref_text = model.transcribe(str(ref_audio)).strip()
            self._f5_transcript_cache[key] = ref_text or "Referencia de voz."
        output.parent.mkdir(parents=True, exist_ok=True)
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
        temperature: Optional[float] = None,
        top_k: Optional[int] = None,
        top_p: Optional[float] = None,
        noise_scale: Optional[float] = None,
        precision_mode: str = "fp16",
    ) -> Path:
        target_voice = voice or "default"
        if self._loaded_voice != target_voice:
            try:
                self._load_model(target_voice)
            except FileNotFoundError:
                target_voice = "default"
                self._loaded_voice = "default"

        import hashlib
        raw = f"{text}|{target_voice}|{language}|{round(float(speed or 1.0), 2)}|{engine}|{dataset_id or ''}|{temperature}|{top_k}|{top_p}|{noise_scale}"
        safe_name = hashlib.md5(raw.encode()).hexdigest()[:16]
        output = OUTPUT_DIR / f"preview_{safe_name}.wav"

        profile = self._resolve_profile(target_voice)
        profile_ref_audio = None
        profile_gpt_cond = None
        profile_spk_emb = None
        if profile:
            if profile.get("_ref_audio_path"):
                profile_ref_audio = Path(profile["_ref_audio_path"])
            if profile.get("_gpt_cond_latent_path") and profile.get("_speaker_embedding_path"):
                profile_gpt_cond = Path(profile["_gpt_cond_latent_path"])
                profile_spk_emb = Path(profile["_speaker_embedding_path"])
            dataset_id = profile.get("dataset_id") or dataset_id
            if engine in ("", None, "default", "coqui_xtts_v2"):
                engine = profile.get("engine", "coqui_xtts_v2")

        chosen = (engine or "").strip().lower()
        if chosen == "f5_tts":
            return self._f5_synthesize(text, speed, output, dataset_id, profile_ref_audio)
        if chosen == "coqui_xtts_v2":
            return self._coqui_xtts_synthesize(
                text, language, speed, output, dataset_id, profile_ref_audio,
                temperature, top_k, top_p, noise_scale,
                profile_gpt_cond, profile_spk_emb
            )
        raise ValueError(f"Motor TTS desconocido: '{engine}'. Usa 'coqui_xtts_v2' o 'f5_tts'.")

    def list_voices(self) -> list[str]:
        voices = []
        for d in MODELS_DIR.iterdir():
            if d.is_dir() and d.name != "__pycache__":
                voices.append(d.name)
        return voices if voices else ["default"]


tts = TTSEngine()
