# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
import logging
import os
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Strip pgbouncer query parameter as psycopg2/libpq does not support it
if "pgbouncer=" in db_url:
    import urllib.parse
    parsed = urllib.parse.urlparse(db_url)
    query = urllib.parse.parse_qs(parsed.query)
    query.pop("pgbouncer", None)
    new_query = urllib.parse.urlencode(query, doseq=True)
    parsed = parsed._replace(query=new_query)
    db_url = urllib.parse.urlunparse(parsed)

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = None
try:
    if db_url.startswith("sqlite"):
        engine = create_engine(db_url, pool_pre_ping=True, future=True, connect_args=connect_args)
    else:
        pg_connect_args = {**connect_args, "connect_timeout": 1}
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            future=True,
            connect_args=pg_connect_args,
            pool_size=20,
            max_overflow=10
        )
        # Attempt connection check
        with engine.connect() as conn:
            pass
        logger.info("Connected to primary PostgreSQL database successfully.")
except (OperationalError, Exception) as e:
    logger.warning(
        f"Primary database connection failed ({e}). "
        f"Falling back to local SQLite database."
    )
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    fallback_db_path = f"sqlite:///{os.path.join(backend_dir, 'fallback.db')}"
    connect_args = {"check_same_thread": False}
    engine = create_engine(fallback_db_path, pool_pre_ping=True, future=True, connect_args=connect_args)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()

def init_db():
    from app.db import models  # noqa: F401
    from sqlalchemy import text
    
    # Try enabling PostGIS on PostgreSQL before running create_all
    if not (db_url.startswith("sqlite") or (engine and "sqlite" in str(engine.url))):
        try:
            with engine.begin() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                logger.info("Ensured PostGIS extension is enabled.")
        except Exception as e:
            logger.warning(f"Could not verify/enable PostGIS extension: {e}. Attempting table creation anyway.")

    Base.metadata.create_all(bind=engine)
    
    # SQLite self-healing migration to ensure SQLite fallback has the new columns
    if db_url.startswith("sqlite") or (engine and "sqlite" in str(engine.url)):
        try:
            with engine.begin() as conn:
                # check daily_exposure
                res = conn.execute(text("PRAGMA table_info(daily_exposure);")).fetchall()
                cols = [r[1] for r in res]
                if "total_no2" not in cols:
                    conn.execute(text("ALTER TABLE daily_exposure ADD COLUMN total_no2 FLOAT DEFAULT 0;"))
                
                # check trips
                res = conn.execute(text("PRAGMA table_info(trips);")).fetchall()
                cols = [r[1] for r in res]
                if "no2_exposure" not in cols:
                    conn.execute(text("ALTER TABLE trips ADD COLUMN no2_exposure FLOAT DEFAULT 0;"))
        except Exception as e:
            logger.error(f"Error running sqlite migration: {e}")

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
