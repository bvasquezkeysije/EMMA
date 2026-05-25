from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Request, Depends
from fastapi.responses import FileResponse
from app.models.schemas import DatasetCreate, DatasetUpdate, SplitRequest, TrimRequest, DatasetSettingsUpdate
from app.config import DATASETS_DIR
from app.services import dataset_service
from app.services.auth_service import auth_service

router = APIRouter(prefix="/v1/datasets", tags=["Datasets"])

def current_user(request: Request) -> str:
    sid = request.cookies.get("emma_sid")
    if not sid:
        raise HTTPException(status_code=401, detail="No autenticado")
    username = auth_service.get_session_user(sid)
    if not username:
        raise HTTPException(status_code=401, detail="Sesion expirada")
    return username

@router.get("/")
def list_datasets(_user: str = Depends(current_user)):
    return dataset_service.list_datasets()


@router.post("/")
def create_dataset(body: DatasetCreate, _user: str = Depends(current_user)):
    return dataset_service.create_dataset(body.name, body.language)


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str, _user: str = Depends(current_user)):
    ds = dataset_service.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return ds


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, _user: str = Depends(current_user)):
    dataset_service.delete_dataset(dataset_id)
    return {"ok": True}


@router.patch("/{dataset_id}")
def update_dataset(dataset_id: str, body: DatasetUpdate, _user: str = Depends(current_user)):
    ds = dataset_service.update_dataset_name(dataset_id, body.name.strip())
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return ds


@router.post("/{dataset_id}/upload")
async def upload_audio(dataset_id: str, files: list[UploadFile] = File(...), _user: str = Depends(current_user)):
    try:
        d = dataset_service._resolve_audio_dir(DATASETS_DIR / dataset_id)
        d.mkdir(parents=True, exist_ok=True)
        paths = []
        for f in files:
            dest = d / f.filename
            content = await f.read()
            dest.write_bytes(content)
            paths.append(dest)
        return dataset_service.import_audio(dataset_id, paths)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


@router.post("/{dataset_id}/split-audios")
def split_audios(dataset_id: str, body: SplitRequest = SplitRequest(), _user: str = Depends(current_user)):
    return dataset_service.split_dataset_audios(dataset_id, body.max_duration)


@router.post("/{dataset_id}/audios/{file_name}/split")
def split_one_audio(dataset_id: str, file_name: str, body: SplitRequest = SplitRequest(), _user: str = Depends(current_user)):
    res = dataset_service.split_single_dataset_audio(dataset_id, file_name, body.max_duration)
    if not res.get("ok"):
        raise HTTPException(404, "Audio not found")
    return res


@router.get("/{dataset_id}/audios")
def list_dataset_audios(dataset_id: str, _user: str = Depends(current_user)):
    return dataset_service.list_dataset_audios(dataset_id)


@router.get("/{dataset_id}/audios/{file_name}/stream")
def stream_dataset_audio(dataset_id: str, file_name: str, _user: str = Depends(current_user)):
    fp = dataset_service._resolve_audio_dir(DATASETS_DIR / dataset_id) / Path(file_name).name
    if not fp.exists() or not fp.is_file():
        raise HTTPException(404, "Audio not found")
    return FileResponse(str(fp))


@router.delete("/{dataset_id}/audios/{file_name}")
def delete_dataset_audio(dataset_id: str, file_name: str, _user: str = Depends(current_user)):
    ok = dataset_service.delete_dataset_audio(dataset_id, file_name)
    if not ok:
        raise HTTPException(404, "Audio not found")
    return {"ok": True}


@router.post("/{dataset_id}/audios/{file_name}/trim")
def trim_dataset_audio(dataset_id: str, file_name: str, body: TrimRequest, _user: str = Depends(current_user)):
    ok = dataset_service.trim_dataset_audio(dataset_id, file_name, body.start_seconds, body.end_seconds)
    if not ok:
        raise HTTPException(400, "No se pudo recortar el audio")
    return {"ok": True}


@router.get("/{dataset_id}/settings")
def get_dataset_settings(dataset_id: str, _user: str = Depends(current_user)):
    return dataset_service.get_dataset_settings(dataset_id)


@router.put("/{dataset_id}/settings")
def save_dataset_settings(dataset_id: str, body: DatasetSettingsUpdate, _user: str = Depends(current_user)):
    payload = body.model_dump()
    return dataset_service.save_dataset_settings(dataset_id, payload)
