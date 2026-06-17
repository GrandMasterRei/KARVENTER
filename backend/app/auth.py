from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from . import models
import os

SECRET_KEY = os.getenv("SECRET_KEY", "karventer-gizli-anahtar-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def sifrele(sifre: str):
    return pwd_context.hash(sifre)

def sifre_dogrula(sifre: str, hash: str):
    return pwd_context.verify(sifre, hash)

def token_olustur(data: dict):
    kopya = data.copy()
    bitis = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    kopya.update({"exp": bitis})
    return jwt.encode(kopya, SECRET_KEY, algorithm=ALGORITHM)

def mevcut_kullanici(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    hata = HTTPException(status_code=401, detail="Geçersiz token")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        kullanici_adi = payload.get("sub")
        if not kullanici_adi:
            raise hata
    except JWTError:
        raise hata
    kullanici = db.query(models.Kullanici).filter(
        models.Kullanici.kullanici_adi == kullanici_adi
    ).first()
    if not kullanici:
        raise hata
    return kullanici

def admin_gerektir(kullanici = Depends(mevcut_kullanici)):
    if kullanici.rol != "admin":
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    return kullanici