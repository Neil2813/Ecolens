# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from dataclasses import dataclass
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "EcoLens API")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:password@host:5432/ecolens")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "72"))
    ARGON2_TIME_COST: int = int(os.getenv("ARGON2_TIME_COST", "2"))
    ARGON2_MEMORY_COST: int = int(os.getenv("ARGON2_MEMORY_COST", "65536"))
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "")
    MOONDREAM_MODEL_URL: str = os.getenv("MOONDREAM_MODEL_URL", "https://api-inference.huggingface.co/models/vikhyatk/moondream2")
    # --- Air Quality ---
    OPENAQ_API_URL: str = os.getenv("OPENAQ_API_URL", "https://api.openaq.org/v2")  # legacy v2 kept for compat
    OPENAQ_V3_URL: str = os.getenv("OPENAQ_V3_URL", "https://api.openaq.org/v3")
    OPENAQ_API_KEY: str = os.getenv("OPENAQ_API_KEY", "")  # free key at openaq.org
    WAQI_TOKEN: str = os.getenv("WAQI_TOKEN", "")          # free token at aqicn.org
    WAQI_API_URL: str = os.getenv("WAQI_API_URL", "https://api.waqi.info")
    OPEN_METEO_AQ_URL: str = os.getenv("OPEN_METEO_AQ_URL", "https://air-quality-api.open-meteo.com/v1/air-quality")
    # --- Weather & Climate ---
    OPEN_METEO_WEATHER_URL: str = os.getenv("OPEN_METEO_WEATHER_URL", "https://api.open-meteo.com/v1/forecast")
    # --- Water ---
    USGS_WATER_URL: str = os.getenv("USGS_WATER_URL", "https://waterservices.usgs.gov/nwis/iv/")
    EEA_WATER_URL: str = os.getenv("EEA_WATER_URL", "https://www.eea.europa.eu/api/SITE")
    # --- Natural Events ---
    NASA_EONET_URL: str = os.getenv("NASA_EONET_URL", "https://eonet.gsfc.nasa.gov/api/v3/events")
    # --- Cache ---
    ENV_CACHE_TTL_SECONDS: int = int(os.getenv("ENV_CACHE_TTL_SECONDS", "900"))
    CPCB_API_URL: str = os.getenv("CPCB_API_URL", "https://app.cpcbccr.com/aqi_dashboard/")
    NOMINATIM_URL: str = os.getenv("NOMINATIM_URL", "https://nominatim.openstreetmap.org")
    ERA5_DATA_PATH: str = os.getenv("ERA5_DATA_PATH", "./data/era5_latest.nc")
    OSM_GRAPH_PATH: str = os.getenv("OSM_GRAPH_PATH", "./data/bengaluru_osm.graphml")
    WEBPUSH_VAPID_PRIVATE_KEY: str = os.getenv("WEBPUSH_VAPID_PRIVATE_KEY", "")
    WEBPUSH_VAPID_PUBLIC_KEY: str = os.getenv("WEBPUSH_VAPID_PUBLIC_KEY", "")
    WEBPUSH_VAPID_EMAIL: str = os.getenv("WEBPUSH_VAPID_EMAIL", "mailto:team@ecolens.app")
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://ecolens.app")
    ENABLE_SCHEDULER: bool = os.getenv("ENABLE_SCHEDULER", "true").lower() == "true"
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
    SERP_API_KEY: str = os.getenv("SERP_API_KEY", "")

    # --- AWS & AWS Open Source Configuration (with 100% Local Fallback) ---
    USE_LOCALSTACK: bool = os.getenv("USE_LOCALSTACK", "false").lower() == "true"
    USE_AWS_S3: bool = os.getenv("USE_AWS_S3", "false").lower() == "true"
    AWS_ENDPOINT_URL: str = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_S3_BUCKET: str = os.getenv("AWS_S3_BUCKET", "ecolens-audio-tours")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "test")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "test")

    USE_OPENSEARCH: bool = os.getenv("USE_OPENSEARCH", "false").lower() == "true"
    OPENSEARCH_URL: str = os.getenv("OPENSEARCH_URL", "http://localhost:9200")
    OPENSEARCH_INDEX_FIRES: str = os.getenv("OPENSEARCH_INDEX_FIRES", "ecolens-fire-hotspots")
    OPENSEARCH_INDEX_STATIONS: str = os.getenv("OPENSEARCH_INDEX_STATIONS", "ecolens-aq-stations")

    USE_CEDAR_POLICIES: bool = os.getenv("USE_CEDAR_POLICIES", "false").lower() == "true"

    USE_AWS_BEDROCK: bool = os.getenv("USE_AWS_BEDROCK", "false").lower() == "true"
    BEDROCK_MODEL_ID: str = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20240620-v1:0")

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
