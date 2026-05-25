from fastapi import APIRouter, HTTPException
from app.models.schemas import TrainRequest, TrainStatus
from app.services.train_service import trainer
from app.services.dataset_service import get_dataset

router = APIRouter(prefix="/v1/training", tags=["Training"])


@router.post("/start")
def start_training(body: TrainRequest):
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
def training_status() -> TrainStatus:
    return trainer.status


@router.post("/stop")
def stop_training():
    trainer.stop()
    return {"ok": True}
