<!-- Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza -->
# Ecolens Backend API

The backend for Ecolens is built using FastAPI and Python. It manages user authentication, routes planning metrics, environmental overlays, trip tracking, user exposure profiles, and multi-agent travel planning and audio tours.

## Technologies Used

*   **FastAPI**: Modern, fast web framework for building APIs.
*   **SQLAlchemy**: Database ORM.
*   **Uvicorn**: Lightning-fast ASGI server.
*   **Pydantic**: Data validation and settings management.
*   **Agno**: Framework for orchestrating collaborative multi-agent teams.
*   **gTTS**: Google Text-to-Speech library for local tour audio guide generation.
*   **icalendar**: Generating standard `.ics` calendar files from itineraries.
*   **google-search-results**: SerpAPI client library for research-focused agents.

## Setup Instructions

### 1. Prerequisites
Ensure you have Python 3.10 or higher.

### 2. Install Dependencies
Set up your virtual environment and install the required Python packages:
```bash
python -m venv .venv
# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Environment Variables
Copy `.env.example` to `.env` and configure your settings:
```bash
copy .env.example .env
```
*   `GROQ_API_KEY`: Groq API Key (LLM engine).
*   `GROQ_MODEL`: Groq model identifier (e.g. `openai/gpt-oss-120b` or `qwen/qwen3.8-27b`).
*   `SERP_API_KEY`: SerpAPI key for Google Search integration.

### 4. Running the server
Start the live reload server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
API docs will be available at [http://localhost:8000/docs](http://localhost:8000/docs).
*   **Travel Planner Endpoint**: `POST /api/travel/plan` and `POST /api/travel/calendar`
*   **Audio Tour Endpoint**: `POST /api/tour/generate` and `GET /api/tour/audio/{filename}`

## Authors & Credits

*   **Neil Emmanuel Mathias**
*   **Ancilla Teresa D'Souza**

*Built for Environmental Hacks.*

