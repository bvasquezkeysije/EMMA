from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File
from app.models.schemas import DatasetCreate, SplitRequest
from app.config import DATASETS_DIR
from app.services import dataset_service

router = APIRouter(prefix="/v1/datasets", tags=["Datasets"])


@router.get("/")
def list_datasets():
    return dataset_service.list_datasets()


@router.post("/")
def create_dataset(body: DatasetCreate):
    return dataset_service.create_dataset(body.name, body.language)


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str):
    ds = dataset_service.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return ds


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str):
    dataset_service.delete_dataset(dataset_id)
    return {"ok": True}


@router.post("/{dataset_id}/upload")
async def upload_audio(dataset_id: str, files: list[UploadFile] = File(...)):
    d = DATASETS_DIR / dataset_id / "audio"
    d.mkdir(parents=True, exist_ok=True)
    paths = []
    for f in files:
        dest = d / f.filename
        content = await f.read()
        dest.write_bytes(content)
        paths.append(dest)
    return dataset_service.import_audio(dataset_id, paths)


@router.post("/{dataset_id}/split-audios")
def split_audios(dataset_id: str, body: SplitRequest = SplitRequest()):
    return dataset_service.split_dataset_audios(dataset_id, body.max_duration)
