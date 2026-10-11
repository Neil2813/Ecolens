# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""
AWS S3 & LocalStack Storage Service.

Provides seamless object storage for generated EcoLens assets (audio tour MP3s,
ICS calendar exports, and satellite raster cache) with 100% zero-config local
fallback.

When USE_LOCALSTACK=true or USE_AWS_S3=true:
  - Stores and streams files via AWS S3 / LocalStack (http://localhost:4566).
When USE_LOCALSTACK=false and USE_AWS_S3=false (Default Fallback):
  - Stores directly to local disk in Backend/generated_audio/ with zero external dependencies.
"""

from __future__ import annotations
import logging
import os
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger("aws_storage")

LOCAL_AUDIO_DIR = Path(__file__).resolve().parent.parent.parent / "generated_audio"
LOCAL_AUDIO_DIR.mkdir(parents=True, exist_ok=True)


class AWSStorageService:
    def __init__(self):
        self._s3_client = None
        self._initialized = False

    @property
    def is_active(self) -> bool:
        """Returns True if AWS S3 or LocalStack emulation is enabled."""
        return bool(settings.USE_LOCALSTACK or settings.USE_AWS_S3)

    def _get_s3_client(self):
        if not self.is_active:
            return None
        if self._initialized:
            return self._s3_client

        try:
            import boto3
            client_kwargs: dict[str, Any] = {
                "region_name": settings.AWS_REGION,
                "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
                "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
            }
            if settings.USE_LOCALSTACK and settings.AWS_ENDPOINT_URL:
                client_kwargs["endpoint_url"] = settings.AWS_ENDPOINT_URL

            self._s3_client = boto3.client("s3", **client_kwargs)
            try:
                self._s3_client.create_bucket(Bucket=settings.AWS_S3_BUCKET)
            except Exception:
                pass
            self._initialized = True
            logger.info("Initialized AWS S3 / LocalStack client successfully.")
            return self._s3_client
        except Exception as exc:
            logger.warning(
                f"Could not connect to S3/LocalStack: {exc}. Operating in local filesystem fallback mode."
            )
            self._initialized = True
            self._s3_client = None
            return None

    def save_audio(
        self, filename: str, file_bytes: bytes, content_type: str = "audio/mpeg"
    ) -> dict[str, Any]:
        """Save generated audio tour file to S3/LocalStack or local disk."""
        client = self._get_s3_client()
        if client:
            try:
                bucket = settings.AWS_S3_BUCKET
                client.put_object(
                    Bucket=bucket,
                    Key=filename,
                    Body=file_bytes,
                    ContentType=content_type,
                )
                logger.info(f"Uploaded audio {filename} to S3/LocalStack bucket '{bucket}'.")
                return {
                    "storage_provider": "aws_s3_localstack" if settings.USE_LOCALSTACK else "aws_s3",
                    "bucket": bucket,
                    "key": filename,
                    "is_cloud": True,
                    "url": f"{settings.AWS_ENDPOINT_URL}/{bucket}/{filename}" if settings.USE_LOCALSTACK else None,
                }
            except Exception as e:
                logger.warning(f"Failed to upload to S3 ({e}), falling back to local disk.")

        # Local fallback
        local_path = LOCAL_AUDIO_DIR / filename
        local_path.write_bytes(file_bytes)
        return {
            "storage_provider": "local_filesystem_fallback",
            "local_path": str(local_path),
            "key": filename,
            "is_cloud": False,
            "url": f"/api/audio-tour/file/{filename}",
        }

    def get_audio_bytes(self, filename: str) -> bytes | None:
        """Retrieve audio bytes from S3/LocalStack or local disk."""
        client = self._get_s3_client()
        if client:
            try:
                resp = client.get_object(Bucket=settings.AWS_S3_BUCKET, Key=filename)
                return resp["Body"].read()
            except Exception as e:
                logger.warning(f"Failed to read from S3 ({e}), checking local disk.")

        local_path = LOCAL_AUDIO_DIR / filename
        if local_path.exists():
            return local_path.read_bytes()
        return None


# Global singleton instance
aws_storage = AWSStorageService()
