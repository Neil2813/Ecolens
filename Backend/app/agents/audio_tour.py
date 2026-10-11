# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""
AI Audio Tour Guide — Multi-Agent Tour Narration
Adapted from: ai_audio_tour_agent template
Engine: Groq (primary), Gemini (fallback)
TTS: gTTS (Google Text-to-Speech, free)
"""
import logging
import os
import uuid
from textwrap import dedent
from pathlib import Path

from app.core.config import settings

import tempfile

logger = logging.getLogger("audio_tour")

# Directory for storing generated audio files (stored outside reload watch path to prevent reloader restarts)
AUDIO_DIR = Path(tempfile.gettempdir()) / "ecolens_audio"
AUDIO_DIR.mkdir(exist_ok=True, parents=True)
LOCAL_AUDIO_DIR = Path(__file__).resolve().parent.parent.parent / "generated_audio"
LOCAL_AUDIO_DIR.mkdir(exist_ok=True, parents=True)


def _get_model():
    """Returns the best available Agno model (Bedrock -> Groq -> Gemini fallback)."""
    try:
        from app.agents.bedrock_provider import get_bedrock_model
        bedrock = get_bedrock_model()
        if bedrock:
            return bedrock
    except Exception:
        pass

    if settings.GROQ_API_KEY:
        model_id = getattr(settings, "GROQ_MODEL", "qwen/qwen3.8-27b") or "qwen/qwen3.8-27b"
        for candidate in [model_id, "qwen/qwen3.8-27b", "openai/gpt-oss-20b", "openai/gpt-oss-120b"]:
            try:
                from agno.models.groq import Groq
                return Groq(id=candidate, api_key=settings.GROQ_API_KEY)
            except Exception as e:
                logger.warning(f"Failed to init Groq model '{candidate}': {e}")
    return None


def _build_sub_agent(name: str, role: str, description: str, instructions: list):
    """Build a specialized sub-agent for a specific tour topic."""
    from agno.agent import Agent
    model = _get_model()
    if not model:
        return None
    return Agent(
        name=name,
        role=role,
        model=model,
        description=description,
        instructions=instructions,
        add_datetime_to_context=True,
    )


# ── Sub-Agent Builders ──────────────────────────────────────────────────────────

def build_environmental_agent():
    return _build_sub_agent(
        name="EnvironmentalGuide",
        role="Expert on environmental conditions, air quality, green spaces, and sustainability",
        description="You are an environmental specialist for EcoLens. Research and present the environmental story of a location.",
        instructions=[
            "Focus on: air quality (PM2.5, AQI), green cover (NDVI), urban heat islands, water quality, and noise levels.",
            "Mention any sustainability initiatives, green infrastructure, or eco-challenges the location faces.",
            "Be specific with data points where possible (e.g., 'The average AQI here is typically 45-60, which is moderate').",
            "Suggest the best times to visit based on environmental conditions.",
            "Keep the tone friendly and informative, like a knowledgeable friend.",
        ],
    )


def build_historical_agent():
    return _build_sub_agent(
        name="HistoricalGuide",
        role="Expert on history, heritage, and significant events of a location",
        description="You are a history expert. Research and present the historical narrative of a location.",
        instructions=[
            "Cover key historical events, founding stories, and cultural heritage.",
            "Include interesting anecdotes and lesser-known facts.",
            "Connect history to the present — how does the past shape today?",
            "Keep it engaging and avoid dry textbook language.",
        ],
    )


def build_cultural_agent():
    return _build_sub_agent(
        name="CulturalGuide",
        role="Expert on local culture, traditions, arts, and community life",
        description="You are a cultural guide. Present the living culture of a location.",
        instructions=[
            "Cover local festivals, traditions, art forms, and community practices.",
            "Highlight local music, dance, or performance arts.",
            "Mention cultural etiquette and local customs visitors should know.",
            "Make it feel authentic and immersive.",
        ],
    )


def build_culinary_agent():
    return _build_sub_agent(
        name="CulinaryGuide",
        role="Expert on local food, restaurants, and culinary traditions",
        description="You are a food expert. Present the culinary story of a location.",
        instructions=[
            "Highlight iconic local dishes and where to find them.",
            "Mention street food, local markets, and sustainable restaurants.",
            "Include food history and why certain dishes are significant.",
            "Suggest eco-friendly dining options (farm-to-table, organic).",
        ],
    )


def build_architecture_agent():
    return _build_sub_agent(
        name="ArchitectureGuide",
        role="Expert on architecture, urban design, and built environment",
        description="You are an architecture specialist. Present the architectural story of a location.",
        instructions=[
            "Cover notable buildings, urban design patterns, and architectural styles.",
            "Mention sustainable/green buildings and eco-architecture where relevant.",
            "Discuss how the built environment affects livability and environmental quality.",
            "Include both historic and modern architectural highlights.",
        ],
    )


def build_orchestrator_agent():
    """Builds the orchestrator that combines all sub-agent outputs into a cohesive tour."""
    from agno.agent import Agent
    model = _get_model()
    if not model:
        return None
    return Agent(
        name="TourOrchestrator",
        role="Combines research from specialized agents into a cohesive, engaging audio tour narration",
        model=model,
        description=dedent("""\
            You are the lead tour narrator for EcoLens. You receive research from specialized agents
            covering different aspects of a location (environmental, historical, cultural, culinary, architectural).
            Your job is to weave these into a single, cohesive, and engaging audio tour script.
        """),
        instructions=[
            "Create a flowing, natural narration script — as if you're walking alongside the visitor.",
            "Start with a warm welcome and orientation to the location.",
            "Smoothly transition between topics (environment → history → culture → food → architecture).",
            "Only include topics the user selected — skip the rest entirely.",
            "Use conversational language, not formal or academic.",
            "Include natural pauses (mark with '...') for the listener to look around.",
            "End with a memorable conclusion and eco-tip about the area.",
            "Target the specified word count based on the duration (150 words per minute of audio).",
            "Do NOT use markdown formatting — this will be read aloud. Use plain text only.",
        ],
        add_datetime_to_context=True,
    )


# ── Agent Mapping ───────────────────────────────────────────────────────────────

INTEREST_AGENTS = {
    "Environmental": build_environmental_agent,
    "History": build_historical_agent,
    "Culture": build_cultural_agent,
    "Culinary": build_culinary_agent,
    "Architecture": build_architecture_agent,
}


def _clean_tts_text(text: str) -> str:
    """Sanitize typography and special unicode for clean TTS and terminal output."""
    if not text:
        return ""
    replacements = {
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    return text.strip()


def _is_error_content(text: str) -> bool:
    if not text or not isinstance(text, str):
        return True
    trimmed = text.strip()
    return (
        trimmed.startswith('{"error"')
        or trimmed.startswith('{"detail"')
        or "invalid_request_error" in trimmed
        or "model_not_found" in trimmed
        or "rate_limit_exceeded" in trimmed
        or len(trimmed) < 20
    )


# ── Main Pipeline ───────────────────────────────────────────────────────────────

async def generate_tour(location: str, interests: list[str], duration_minutes: int) -> dict:
    """
    Run the full multi-agent audio tour pipeline.
    Returns: {"narration": str, "audio_filename": str | None, "sections": dict}
    """
    # Scale narration length appropriately for fast synthesis and great audio experience (approx 200-380 words)
    target_words = min(140 + int(duration_minutes) * 12, 380)
    words_per_section = max(60, target_words // max(len(interests), 1))

    sections = {}

    # Step 1: Run specialized sub-agents for each selected interest
    for interest in interests:
        builder = INTEREST_AGENTS.get(interest)
        if not builder:
            continue
        agent = builder()
        if not agent:
            sections[interest] = _mock_section(location, interest)
            continue
        try:
            result = agent.run(
                f"Research the {interest.lower()} aspects of {location}. "
                f"Write approximately {words_per_section} words. "
                f"Focus on what a visitor walking through would want to know.",
                stream=False
            )
            content = result.content if hasattr(result, "content") else str(result)
            if _is_error_content(content):
                logger.warning(f"{interest} agent returned API error. Falling back.")
                sections[interest] = _mock_section(location, interest)
            else:
                sections[interest] = _clean_tts_text(content)
                logger.info(f"{interest} research completed.")
        except Exception as e:
            logger.warning(f"{interest} agent failed: {e}")
            sections[interest] = _mock_section(location, interest)

    # Step 2: Orchestrate into a single narration
    orchestrator = build_orchestrator_agent()
    narration = None
    if orchestrator and sections:
        try:
            research_summary = "\n\n".join(
                f"=== {topic} ===\n{content}" for topic, content in sections.items()
            )
            prompt = dedent(f"""\
                Location: {location}
                Duration: {duration_minutes} minutes (approximately {target_words} words)
                Selected interests: {', '.join(interests)}
                
                Research from specialized agents:
                {research_summary}
                
                Create a cohesive audio tour narration combining all the research above.
            """)
            result = orchestrator.run(prompt, stream=False)
            content = result.content if hasattr(result, "content") else str(result)
            if not _is_error_content(content):
                narration = _clean_tts_text(content)
            else:
                logger.warning("Orchestrator returned API error. Falling back to structured narrative.")
        except Exception as e:
            logger.error(f"Orchestrator failed: {e}")

    if not narration or _is_error_content(narration):
        narration = _clean_tts_text(_fallback_narration(location, sections))

    # Step 3: Generate audio (TTS)
    audio_filename = None
    try:
        audio_filename = _generate_audio(narration)
    except Exception as e:
        logger.error(f"TTS generation failed: {e}")

    return {
        "narration": narration,
        "audio_filename": audio_filename,
        "sections": sections,
    }


def _generate_audio(text: str) -> str:
    """Generate MP3 audio from text using gTTS."""
    from gtts import gTTS

    cleaned = _clean_tts_text(text)
    filename = f"tour_{uuid.uuid4().hex[:12]}.mp3"
    filepath = AUDIO_DIR / filename

    tts = gTTS(text=cleaned, lang='en', slow=False)
    tts.save(str(filepath))
    if filepath.exists() and filepath.stat().st_size > 0:
        logger.info(f"Audio saved to {filepath} ({filepath.stat().st_size} bytes)")
        # Hook into AWS S3 / LocalStack storage service (falls back to local disk automatically)
        try:
            from app.aws.aws_storage import aws_storage
            aws_storage.save_audio(filename, filepath.read_bytes())
        except Exception as err:
            logger.debug(f"AWS storage hook notice: {err}")
        return filename
    raise RuntimeError(f"Audio file {filepath} was not created or is empty")


def get_audio_path(filename: str) -> Path | None:
    """Get the full path to a generated audio file, with polite fallback for expired URLs."""
    safe_name = os.path.basename(filename)
    primary = AUDIO_DIR / safe_name
    if primary.exists() and primary.stat().st_size > 0:
        return primary
    local = LOCAL_AUDIO_DIR / safe_name
    if local.exists() and local.stat().st_size > 0:
        return local

    # Check AWS S3 / LocalStack if file exists in cloud bucket
    try:
        from app.aws.aws_storage import aws_storage
        file_bytes = aws_storage.get_audio_bytes(safe_name)
        if file_bytes:
            local.write_bytes(file_bytes)
            return local
    except Exception:
        pass

    # Fallback: serve polite expired notice audio instead of 404
    fallback_path = AUDIO_DIR / "expired_notice.mp3"
    if fallback_path.exists() and fallback_path.stat().st_size > 0:
        return fallback_path
    try:
        from gtts import gTTS
        tts = gTTS(text="Welcome to EcoLens. This tour audio has expired. Please tap Generate to create a fresh tour for your destination.", lang='en', slow=False)
        tts.save(str(fallback_path))
        return fallback_path
    except Exception:
        return None


# ── Fallback / Mock ─────────────────────────────────────────────────────────────

def _mock_section(location: str, interest: str) -> str:
    mocks = {
        "Environmental": f"{location} has an average Air Quality Index of around 55, which is moderate. The area features several green spaces and urban parks that help filter pollutants. The city has been investing in tree planting initiatives, with NDVI scores improving year over year.",
        "History": f"{location} has a rich history spanning several centuries. Originally established as a trading post, it grew into a vibrant cultural center. Many of its historic buildings have been preserved and now serve as museums and cultural spaces.",
        "Culture": f"The culture of {location} is a vibrant mix of traditional and modern influences. Local festivals throughout the year celebrate music, dance, and community. Street art and local galleries showcase the creative spirit of the community.",
        "Culinary": f"{location} offers a diverse culinary scene. From traditional street food stalls to modern farm-to-table restaurants, there's something for every taste. Local specialties reflect the region's agricultural heritage and cultural diversity.",
        "Architecture": f"The architecture of {location} tells the story of its evolution. From colonial-era buildings to modern sustainable designs, the built environment reflects changing values. Several green buildings in the area showcase innovative eco-friendly design principles.",
    }
    return mocks.get(interest, f"Interesting facts about {interest} in {location}.")


def _fallback_narration(location: str, sections: dict) -> str:
    """Create a simple narration from sections when orchestrator is unavailable."""
    parts = [f"Welcome to your EcoLens audio tour of {location}!\n"]
    for topic, content in sections.items():
        parts.append(f"Let's talk about the {topic.lower()} side of things.\n\n{content}\n")
    parts.append(f"\nThat concludes our tour of {location}. Remember, small eco-friendly choices make a big difference. Thank you for exploring with EcoLens!")
    return "\n".join(parts)
