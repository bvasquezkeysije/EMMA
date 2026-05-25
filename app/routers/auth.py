from fastapi import APIRouter, HTTPException, Request, Response
from app.models.schemas import LoginRequest
from app.services.auth_service import auth_service

router = APIRouter(prefix="/v1/auth", tags=["Auth"])


@router.post("/login")
def login(body: LoginRequest, response: Response):
    if not auth_service.validate_credentials(body.username, body.password):
        raise HTTPException(401, "Credenciales invalidas")
    sid = auth_service.create_session(body.username)
    response.set_cookie(key="emma_sid", value=sid, httponly=True, max_age=10800, samesite="lax")
    return {"ok": True, "username": body.username}


@router.get("/me")
def me(request: Request):
    sid = request.cookies.get("emma_sid")
    if not sid:
        raise HTTPException(401, "No autenticado")
    username = auth_service.get_session_user(sid)
    if not username:
        raise HTTPException(401, "Sesion expirada")
    return {"username": username}


@router.post("/logout")
def logout(request: Request, response: Response):
    sid = request.cookies.get("emma_sid")
    if sid:
        auth_service.remove_session(sid)
    response.delete_cookie("emma_sid")
    return {"ok": True}
