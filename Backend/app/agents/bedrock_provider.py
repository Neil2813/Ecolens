# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""
Amazon Bedrock LLM Provider for EcoLens Agents.

Provides access to AWS Bedrock foundation models (Anthropic Claude 3.5 Sonnet,
Amazon Nova, Meta Llama 3) for the EcoLens Multi-Agent Travel Planner and
Audio Tour Guide.

When USE_AWS_BEDROCK=true:
  - Connects to AWS Bedrock runtime via boto3 / Agno Bedrock integration.
When USE_AWS_BEDROCK=false (Default Fallback):
  - Returns None, triggering automatic zero-cost fallback to Groq or Gemini.
"""

from __future__ import annotations
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger("bedrock_provider")


def get_bedrock_model() -> Any | None:
    """Return an initialized Bedrock model if enabled and accessible, else None."""
    if not getattr(settings, "USE_AWS_BEDROCK", False):
        return None

    try:
        # Attempt to import Agno Bedrock model wrapper
        from agno.models.aws.bedrock import Bedrock
        model_id = getattr(settings, "BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20240620-v1:0")
        logger.info(f"Initializing Amazon Bedrock with model: {model_id}")
        return Bedrock(
            id=model_id,
            region_name=getattr(settings, "AWS_REGION", "us-east-1"),
        )
    except Exception as exc:
        logger.warning(
            f"Failed to initialize Amazon Bedrock model ({exc}). Falling back to primary Groq/Gemini engine."
        )
        return None
