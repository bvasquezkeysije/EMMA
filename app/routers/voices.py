from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.models.schemas import TTSRequest
from app.services.tts_service import tts

router = APIRouter(prefix="/v1/voices", tags=["Voices"])


@router.get("/")
def list_voices():
    return {"voices": tts.list_voices()}


@router.post("/synthesize")
def synthesize(body: TTSRequest):
    try:
        output = tts.synthesize(body.text, body.voice, body.language, body.speed)
        return FileResponse(str(output), media_type="audio/wav")
    except FileNotFoundError:
        raise HTTPException(404, "Voice model not found")
    except Exception as e:
        raise HTTPException(500, str(e))
