from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import FileResponse
from app.models.schemas import TTSRequest
from app.services.tts_service import tts
from app.services.auth_service import auth_service

router = APIRouter(prefix="/v1/voices", tags=["Voices"])


def current_user(request: Request) -> str:
    sid = request.cookies.get("emma_sid")
    if not sid:
        raise HTTPException(status_code=401, detail="No autenticado")
    username = auth_service.get_session_user(sid)
    if not username:
        raise HTTPException(status_code=401, detail="Sesion expirada")
    return username


@router.get("/")
def list_voices(_user: str = Depends(current_user)):
    return {"voices": tts.list_voices()}


@router.post("/synthesize")
def synthesize(body: TTSRequest, _user: str = Depends(current_user)):
    try:
        output = tts.synthesize(
            body.text,
            body.voice,
            body.language,
            body.speed,
            body.engine,
            body.dataset_id,
            body.temperature,
            body.top_k,
            body.top_p,
            body.noise_scale,
            body.precision_mode,
        )
        return FileResponse(str(output), media_type="audio/wav")
    except FileNotFoundError:
        raise HTTPException(404, "Voice model not found")
    except Exception as e:
        raise HTTPException(500, str(e))
