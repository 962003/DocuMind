from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
)


@event.listens_for(engine, "connect")
def _enable_pgvector(dbapi_connection, connection_record):
    with dbapi_connection.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector")


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
