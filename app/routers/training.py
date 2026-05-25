from fastapi import APIRouter, HTTPException, Request, Depends
from app.models.schemas import TrainRequest, TrainStatus
from app.services.train_service import trainer
from app.services.dataset_service import get_dataset
from app.services.auth_service import auth_service

router = APIRouter(prefix="/v1/training", tags=["Training"])


def current_user(request: Request) -> str:
    sid = request.cookies.get("emma_sid")
    if not sid:
        raise HTTPException(status_code=401, detail="No autenticado")
    username = auth_service.get_session_user(sid)
    if not username:
        raise HTTPException(status_code=401, detail="Sesion expirada")
    return username


@router.post("/start")
def start_training(body: TrainRequest, _user: str = Depends(current_user)):
    ds = get_dataset(body.dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    try:
        trainer.start(
            dataset_id=body.dataset_id,
            language=body.language,
            epochs=body.epochs,
            learning_rate=body.learning_rate,
            output_name=body.output_model_name,
        )
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(400, str(e))


@router.get("/status")
def training_status(_user: str = Depends(current_user)) -> TrainStatus:
    return trainer.status


@router.post("/stop")
def stop_training(_user: str = Depends(current_user)):
    trainer.stop()
    return {"ok": True}
