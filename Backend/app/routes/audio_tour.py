# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""
Audio Tour API routes.
POST /api/tour/generate — Generate audio tour narration + audio
GET  /api/tour/audio/{filename} — Serve generated audio file
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.agents.audio_tour import generate_tour, get_audio_path

router = APIRouter()


class TourRequest(BaseModel):
    location: str = Field(..., min_length=1, max_length=300)
    interests: list[str] = Field(..., min_length=1)
    duration_minutes: int = Field(default=10, ge=1, le=60)


@router.post("/generate")
async def create_tour(
    payload: TourRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Run the multi-agent tour pipeline to generate narration + audio."""
    # Validate interests
    valid_interests = {"Environmental", "History", "Culture", "Culinary", "Architecture"}
    for interest in payload.interests:
        if interest not in valid_interests:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid interest '{interest}'. Valid options: {', '.join(sorted(valid_interests))}"
            )

    try:
        result = await generate_tour(payload.location, payload.interests, payload.duration_minutes)

        audio_url = None
        if result.get("audio_filename"):
            audio_url = f"/api/tour/audio/{result['audio_filename']}"

        return {
            "narration": result["narration"],
            "audio_url": audio_url,
            "sections": result.get("sections", {}),
            "location": payload.location,
            "interests": payload.interests,
            "duration_minutes": payload.duration_minutes,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tour generation failed: {str(e)}")


@router.get("/audio/{filename}")
def serve_audio(filename: str):
    """Serve a generated audio file."""
    path = get_audio_path(filename)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(
        path=str(path),
        media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=3600"}
    )
