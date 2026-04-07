from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Docker'daki PostgreSQL bilgilerimiz
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg://karventer_user:karventer_password@localhost:5432/karventer_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()