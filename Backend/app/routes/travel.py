# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""
Travel Planner API routes.
POST /api/travel/plan — Run multi-agent travel planning
POST /api/travel/calendar — Download .ics calendar file
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.agents.travel_planner import plan_trip, generate_ics_content

router = APIRouter()


class TravelPlanRequest(BaseModel):
    destination: str = Field(..., min_length=1, max_length=200)
    num_days: int = Field(..., ge=1, le=30)


class CalendarRequest(BaseModel):
    itinerary_text: str = Field(..., min_length=1)


@router.post("/plan")
async def create_plan(
    payload: TravelPlanRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Run the Researcher → Planner multi-agent pipeline to generate an eco-travel itinerary."""
    try:
        result = await plan_trip(payload.destination, payload.num_days)
        return {
            "itinerary": result["itinerary"],
            "research_summary": result.get("research_summary"),
            "destination": payload.destination,
            "num_days": payload.num_days,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Travel planning failed: {str(e)}")


@router.post("/calendar")
def download_calendar(
    payload: CalendarRequest,
    user=Depends(get_current_user)
):
    """Convert itinerary text to a downloadable .ics calendar file."""
    try:
        ics_bytes = generate_ics_content(payload.itinerary_text)
        return Response(
            content=ics_bytes,
            media_type="text/calendar",
            headers={
                "Content-Disposition": "attachment; filename=ecolens_travel_itinerary.ics"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calendar generation failed: {str(e)}")
