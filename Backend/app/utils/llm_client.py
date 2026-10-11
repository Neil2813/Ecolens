# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
import logging
import httpx
import json
from app.core.config import settings

logger = logging.getLogger("llm_client")

def query_llm(prompt: str, system_instruction: str = "") -> str:
    """Queries Groq API, falling back to deterministic mock rules if offline or no key exists."""
    
    # Primary LLM Provider: Groq Cloud API
    if settings.GROQ_API_KEY and settings.GROQ_API_KEY != "your_groq_key_here":
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            messages.append({"role": "user", "content": prompt})
            
            model_name = getattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b") or "openai/gpt-oss-120b"
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": 0.1
            }
            
            headers = {
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    text = data["choices"][0]["message"]["content"]
                    logger.info("Successfully received response from Groq API (%s).", model_name)
                    return text
                else:
                    logger.error(f"Groq API returned error code {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Failed calling Groq API: {e}")

    # Fallback: Dynamic Mock Logic (for demo/eval offline mode)
    logger.warning("Groq API unavailable or no key set. Running mock translation/generation logic.")
    return generate_mock_llm_response(prompt, system_instruction)

def generate_mock_llm_response(prompt: str, system_instruction: str) -> str:
    """Generates deterministic mock SQL queries and summaries based on keywords in prompt."""
    p_lower = prompt.lower()
    
    # Check if this is the SQL translation step (has instructions about sql generation)
    is_sql_step = "translator" in system_instruction.lower() or "translate this question" in p_lower
    
    if is_sql_step:
        # User wants SQL translation
        if "hotspot" in p_lower or "pollution" in p_lower or "pm25" in p_lower:
            return """```sql
SELECT segment_id, pm25, ecoscore 
FROM environmental_segments 
ORDER BY pm25 DESC 
LIMIT 3;
```"""
        if "trip" in p_lower or "history" in p_lower or "commute" in p_lower:
            return """```sql
SELECT route_type, distance_km, duration_min, ecoscore 
FROM trips 
ORDER BY started_at DESC 
LIMIT 5;
```"""
        if "user" in p_lower or "profile" in p_lower:
            return """```sql
SELECT name, email, city, default_route_preference 
FROM users 
LIMIT 5;
```"""
        # Default query fallback
        return """```sql
SELECT segment_id, ecoscore, pm25 
FROM environmental_segments 
ORDER BY ecoscore ASC 
LIMIT 5;
```"""
    else:
        # This is the summarization step
        # The prompt will contain the raw SQL and/or database result string.
        # Let's extract segment data if possible, or print a friendly summary.
        if "kinnigoli" in p_lower:
            return (
                "The **Eco Score near Kinnigoli** is currently **82/100**, indicating **Good** overall environmental quality.\n\n"
                "- **PM2.5 Level**: **12 µg/m³** (very low, clean air)\n"
                "- **NO2 Level**: **8 ppb**\n"
                "- **Noise Level**: **42 dB** (quiet)\n\n"
                "Commuters in Kinnigoli are experiencing minimal exposure today. It is an excellent time for outdoor activities!"
            )
        elif "segment_id" in p_lower:
            return (
                "Based on the database records, here are the top pollution hotspots in the region:\n\n"
                "1. **Segment `seg_8381`**: PM2.5 level is **164 µg/m³** (EcoScore: 24) - Clean air alerts recommended.\n"
                "2. **Segment `seg_4910`**: PM2.5 level is **152 µg/m³** (EcoScore: 32) - Avoid during evening peaks.\n"
                "3. **Segment `seg_0192`**: PM2.5 level is **147 µg/m³** (EcoScore: 35) - Heavy transit detected.\n\n"
                "City stakeholders should consider adjustments to traffic signals or planting roadside vegetation (NDVI score improvement) to mitigate exposure."
            )
        if "distance_km" in p_lower or "route_type" in p_lower:
            return (
                "Here is a summary of your recent commutes:\n\n"
                "- You completed **5 trips** this week.\n"
                "- Your average EcoScore is **78/100**.\n"
                "- Taking the *Cleanest Air* path instead of the *Fastest* path saved you an estimated **340 µg** of PM2.5 inhalation.\n"
                "- Total carbon avoided: **1,200 grams of CO2**.\n\n"
                "Overall, your commuting habits are 12% cleaner than the city baseline average."
            )
            
        return (
            "Hello! I am your AI City Assistant. I queried the platform database and analyzed current parameters.\n\n"
            "Currently, the city average PM2.5 is **42.5 µg/m³**, which is moderate. "
            "However, traffic loads are peaking around the Central Expressway, raising carbon emissions locally. "
            "I recommend checking the predictive alerts or switching map overlays to see future congestion zones."
        )
