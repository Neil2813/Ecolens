# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""
AI Eco-Travel Planner — Agno Multi-Agent Team
Adapted from: ai_travel_planner_agent_team template
Engine: Groq (primary), Gemini (fallback)
"""
import logging
import os
import math
import re
from textwrap import dedent
from datetime import datetime, timedelta
from icalendar import Calendar, Event

from app.core.config import settings

logger = logging.getLogger("travel_planner")


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


import httpx

def search_google(query: str) -> str:
    """Search Google and return a very concise summary of the top 3 organic results.
    Use this tool to find travel destinations, local points of interest, eco-friendly activities, and accommodations.
    
    Args:
        query: The search query string.
        
    Returns:
        A concise text summary of the organic search results, including title, link, and snippet.
    """
    if not settings.SERP_API_KEY:
        return "Search is currently disabled (no API key)."
        
    try:
        url = "https://serpapi.com/search"
        params = {
            "q": query,
            "api_key": settings.SERP_API_KEY,
            "engine": "google",
            "num": 3
        }
        resp = httpx.get(url, params=params, timeout=8.0)
        if resp.status_code != 200:
            return f"Search failed with status {resp.status_code}"
            
        data = resp.json()
        organic = data.get("organic_results", [])
        if not organic:
            return "No organic search results found."
            
        results = []
        for item in organic[:3]:
            title = item.get("title", "No Title")
            link = item.get("link", "")
            snippet = item.get("snippet", "No Snippet")
            results.append(f"Title: {title}\nLink: {link}\nSnippet: {snippet}\n---")
            
        return "\n".join(results)
    except Exception as e:
        return f"Error performing search: {str(e)}"


def build_researcher():
    """Build the Researcher agent that searches for eco-friendly travel info."""
    from agno.agent import Agent
    model = _get_model()
    if not model:
        return None

    return Agent(
        name="EcoResearcher",
        role="Summarizes eco-friendly travel destinations, green activities, air quality conditions, and sustainable accommodations",
        model=model,
        description=dedent("""\
            You are a world-class eco-travel researcher for EcoLens.
            Given research data, analyze the results and extract relevant eco-friendly travel information.
        """),
        instructions=[
            "Extract only key names of places, eco-friendly activities, and sustainable lodgings from the provided text.",
            "Summarize the findings in a highly concise markdown summary of under 500 words. Do not list long text blocks or raw search snippets.",
        ],
        add_datetime_to_context=True,
    )


def build_planner():
    """Build the Planner agent that creates eco-conscious itineraries."""
    from agno.agent import Agent
    model = _get_model()
    if not model:
        return None

    return Agent(
        name="EcoPlanner",
        role="Generates eco-conscious travel itineraries with environmental tips and sustainable options",
        model=model,
        description=dedent("""\
            You are a senior eco-travel planner for EcoLens — the AI-powered environmental intelligence platform.
            Given a travel destination, duration, and research results, generate a detailed eco-conscious itinerary.
            Your itinerary should highlight sustainable transport, green spaces, air quality awareness,
            and environmentally responsible activities.
        """),
        instructions=[
            "Create a day-by-day itinerary that prioritizes eco-friendly activities and sustainable transport.",
            "For each day, include: morning, afternoon, and evening activities.",
            "Highlight green transport options (walking, cycling, public transit) over private cars.",
            "Mention air quality tips where relevant (e.g., 'Best time to walk: early morning when PM2.5 levels are lowest').",
            "Suggest eco-lodges, sustainable restaurants, and green businesses.",
            "Include a daily 'Eco Tip' related to the destination's environmental challenges.",
            "Format each day clearly as 'Day N: [Theme]' followed by activities.",
            "Keep the itinerary engaging, informative, and practical.",
            "End with a brief 'Carbon Footprint Summary' estimating the eco-impact of the trip.",
            "Never make up facts. Always provide attribution where possible.",
        ],
        add_datetime_to_context=True,
    )


def _is_error_text(text) -> bool:
    if not text or not isinstance(text, str):
        return True
    t = text.strip()
    return (
        len(t) < 80
        or t.startswith('{"error"')
        or "rate_limit_exceeded" in t
        or "invalid_request_error" in t
        or "model_not_found" in t
    )


def _fetch_environment(destination: str) -> dict:
    """Deterministic data gathering: geocode + live air quality + weather (Open-Meteo, no key)."""
    info = {"place": destination, "pm25": None, "aqi": None, "temp": None, "lat": None, "lon": None}
    try:
        g = httpx.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": destination, "count": 1}, timeout=6.0,
        ).json()
        res = (g.get("results") or [None])[0]
        if not res:
            return info
        info["place"] = ", ".join(x for x in [res.get("name"), res.get("country")] if x)
        lat, lon = res["latitude"], res["longitude"]
        info["lat"], info["lon"] = lat, lon
        aq = httpx.get(
            "https://air-quality-api.open-meteo.com/v1/air-quality",
            params={"latitude": lat, "longitude": lon, "current": "pm2_5,european_aqi"}, timeout=6.0,
        ).json().get("current", {})
        info["pm25"] = aq.get("pm2_5")
        info["aqi"] = aq.get("european_aqi")
        wx = httpx.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": lat, "longitude": lon, "current": "temperature_2m"}, timeout=6.0,
        ).json().get("current", {})
        info["temp"] = wx.get("temperature_2m")
    except Exception as e:
        logger.warning(f"Environment fetch failed: {e}")
    return info


_WIKI_API = "https://en.wikipedia.org/w/api.php"
_WIKI_HEADERS = {"User-Agent": "EcoLens/1.0 (environmental travel planner; contact: ecolens@example.com)"}
_OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
_PLACES_CACHE: dict = {}

_EXCLUDE = re.compile(
    r"station|school|college|university|company|hospital|airport|metro|tram|bus |stop|"
    r"cemetery|neighbou?rhood|district|ward|prefecture|municipality|village|town in|city in|"
    r"road|street|highway|railway|line|brand|corporation|stadium|hotel|apartment|skyscraper in|"
    r"battle|war |incident|agency|festival|clan|politician|person|born|ministry|office|bank|headquarters|capital of|capital city|largest city",

    re.I,
)
_GREEN = re.compile(r"park|garden|mountain|hill|forest|lake|river|nature|reserve|island|valley|beach|waterfall|peak|gorge|bamboo|grove|woodland", re.I)
_MUSEUM = re.compile(r"museum|gallery|exhibition", re.I)


def _wiki_get(params: dict) -> dict:
    try:
        r = httpx.get(_WIKI_API, params={**params, "format": "json", "formatversion": 2},
                      headers=_WIKI_HEADERS, timeout=10.0)
        return r.json() if r.status_code == 200 else {}
    except Exception as e:
        logger.warning(f"Wikipedia call failed: {e}")
        return {}


def _wiki_places(lat: float, lon: float, radius: int = 10000) -> dict:
    """Notable real places near a point, with Wikipedia facts, ranked by popularity (pageviews)."""
    out = {"green": [], "museums": [], "sights": []}
    geo = _wiki_get({"action": "query", "list": "geosearch", "gscoord": f"{lat}|{lon}",
                     "gsradius": radius, "gslimit": 500, "gsnamespace": 0}).get("query", {}).get("geosearch", [])
    titles = [g["title"] for g in geo]
    if not titles:
        return out

    meta = []
    for i in range(0, len(titles), 50):
        pages = _wiki_get({"action": "query", "prop": "pageviews|description", "pvipdays": 30,
                           "titles": "|".join(titles[i:i + 50])}).get("query", {}).get("pages", [])
        for p in pages:
            desc = p.get("description") or ""
            views = sum(v for v in (p.get("pageviews") or {}).values() if v)
            if not desc or _EXCLUDE.search(desc):
                continue
            blob = f"{p['title']} {desc}"
            cat = "museums" if _MUSEUM.search(blob) else "green" if _GREEN.search(blob) else "sights"
            meta.append({"name": p["title"], "kind": ("Museum in " + desc.split(" in ", 1)[1] if cat == "museums" and " in " in desc else desc), "views": views, "cat": cat})

    meta.sort(key=lambda m: -m["views"])
    top = {"green": [], "museums": [], "sights": []}
    limits = {"green": 6, "museums": 6, "sights": 10}
    for m in meta:
        if len(top[m["cat"]]) < limits[m["cat"]]:
            top[m["cat"]].append(m)

    chosen = [m for lst in top.values() for m in lst]
    extracts = {}
    for i in range(0, len(chosen), 20):
        pages = _wiki_get({"action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1,
                           "exsentences": 2, "exlimit": 20,
                           "titles": "|".join(m["name"] for m in chosen[i:i + 20])}).get("query", {}).get("pages", [])
        for p in pages:
            ex = (p.get("extract") or "").replace("\n", " ").strip()
            ex = re.sub(r"\s*\([^)]*[^\x00-\x7F][^)]*\)", "", ex)  # drop native-script/romaji parentheticals
            extracts[p["title"]] = ex if len(ex) <= 320 else ex[:320].rsplit(" ", 1)[0] + "..."
    for cat, lst in top.items():
        for m in lst:
            m["about"] = extracts.get(m["name"], "")
        out[cat] = lst
    return out


def _wiki_summary_from_tag(tag: str) -> str:
    """OSM 'wikipedia' tag like 'de:Haus Hiltl' -> short summary text."""
    try:
        lang, title = tag.split(":", 1)
        r = httpx.get(f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title.replace(' ', '_')}",
                      headers=_WIKI_HEADERS, timeout=6.0)
        if r.status_code == 200:
            ext = r.json().get("extract", "")
            return " ".join(re.split(r"(?<=[.!?])\s", ext)[:2])
    except Exception:
        pass
    return ""


def _overpass_venues(lat: float, lon: float, radius: int = 6000) -> dict:
    """Named restaurants and hotels (OpenStreetMap), with facts derived from their tags."""
    out = {"food": [], "stay": []}
    q = f"""[out:json][timeout:20];
(
  nwr(around:{radius},{lat},{lon})["amenity"~"^(restaurant|cafe)$"]["name"]["cuisine"];
  nwr(around:{radius},{lat},{lon})["amenity"~"^(restaurant|cafe)$"]["name"]["diet:vegetarian"~"^(yes|only)$"];
  nwr(around:{radius},{lat},{lon})["amenity"~"^(restaurant|cafe)$"]["name"]["diet:vegan"~"^(yes|only)$"];
)->.f;
nwr(around:{radius},{lat},{lon})["tourism"="hotel"]["name"]["stars"]->.h;
(.f; .h;);
out tags center 500;"""
    data = None
    for url in _OVERPASS_URLS * 2:
        try:
            r = httpx.post(url, data={"data": q}, headers=_WIKI_HEADERS, timeout=25.0)
            if r.status_code == 200:
                data = r.json()
                break
        except Exception as e:
            logger.warning(f"Overpass {url} failed: {e}")
    if not data:
        return out

    def score(t):
        s = 0
        s += 4 if "wikipedia" in t else 0
        s += 2 if "wikidata" in t else 0
        s += 1 if ("website" in t or "contact:website" in t) else 0
        s += 1 if "opening_hours" in t else 0
        s += 2 if t.get("diet:vegan") in ("yes", "only") or t.get("diet:vegetarian") in ("yes", "only") else 0
        s += 1 if t.get("organic") in ("yes", "only") else 0
        s += 1 if "cuisine" in t else 0
        return s

    seen = set()
    for el in data.get("elements", []):
        t = el.get("tags", {})
        name = t.get("name:en") or t.get("name")
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        facts = []
        if t.get("amenity") in ("restaurant", "cafe"):
            cuisine = ", ".join(c.replace("_", " ") for c in t.get("cuisine", "").split(";")[:3])
            if t.get("diet:vegan") == "only": facts.append("fully vegan menu")
            elif t.get("diet:vegetarian") == "only": facts.append("fully vegetarian menu")
            elif t.get("diet:vegan") == "yes": facts.append("vegan options")
            elif t.get("diet:vegetarian") == "yes": facts.append("vegetarian options")
            if t.get("organic") in ("yes", "only"): facts.append("organic ingredients")
            if t.get("outdoor_seating") == "yes": facts.append("outdoor seating")
            if t.get("opening_hours") and len(t["opening_hours"]) < 40: facts.append(f"open {t['opening_hours']}")
            kind = f"{cuisine.title()} {t['amenity']}".strip() if cuisine else t["amenity"]
            out["food"].append({"name": name, "kind": kind, "facts": facts, "wiki": t.get("wikipedia"), "score": score(t)})
        else:
            if t.get("stars"): facts.append(f"{t['stars']}-star")
            out["stay"].append({"name": name, "kind": "hotel", "facts": facts, "wiki": t.get("wikipedia"), "score": score(t)})
    for k in out:
        out[k].sort(key=lambda x: -x["score"])
        out[k] = out[k][:8]
        for v in out[k][:4]:
            v["about"] = _wiki_summary_from_tag(v["wiki"]) if v.get("wiki") else ""
    return out


def _serp_maps(query: str, limit: int = 8) -> list[dict]:
    """Real venues from Google Maps (SerpAPI) with rating, review count and description."""
    if not settings.SERP_API_KEY:
        return []
    try:
        r = httpx.get("https://serpapi.com/search",
                      params={"engine": "google_maps", "type": "search", "q": query,
                              "api_key": settings.SERP_API_KEY}, timeout=45.0)
        if r.status_code != 200:
            return []
        out = []
        for x in r.json().get("local_results", []):
            if not x.get("title"):
                continue
            facts = []
            if x.get("rating"):
                rv = f" from {x['reviews']:,} reviews" if x.get("reviews") else ""
                facts.append(f"rated {x['rating']}/5{rv}")
            if x.get("price"):
                facts.append(f"price {x['price']}")
            area = ""
            if x.get("address"):
                parts = [a.strip() for a in x["address"].split(",")]
                ward = next((a for a in parts if re.search(r"ward|district|-ku|quarter", a, re.I)), "")
                area = ward
            if area:
                facts.append(f"located in {area}")
            out.append({
                "name": x["title"],
                "kind": (x.get("type") or "venue"),
                "facts": facts,
                "about": (x.get("description") or "").strip(),
                "score": (x.get("rating") or 0) * math.log10((x.get("reviews") or 0) + 10),
            })
        out.sort(key=lambda v: -v["score"])
        return out[:limit]
    except Exception as e:
        logger.warning(f"SerpAPI maps failed for '{query}': {e}")
        return []


def _serp_venues(place: str) -> dict:
    from concurrent.futures import ThreadPoolExecutor
    qs = [f"best local restaurants serving traditional seasonal food in {place}",
          f"best vegetarian vegan restaurants in {place}",
          f"eco friendly sustainable hotels in {place}"]
    with ThreadPoolExecutor(max_workers=3) as ex:
        local, veg, hotels = list(ex.map(_serp_maps, qs))
    seen, food = set(), []
    for v in veg[:4] + local:  # vegan/vegetarian first (eco focus), then local cuisine
        if v["name"].lower() not in seen:
            seen.add(v["name"].lower())
            food.append(v)
    return {"food": food[:10], "stay": hotels[:5]}


def _get_places(lat: float, lon: float, place: str = "") -> dict:
    key = (round(lat, 2), round(lon, 2))
    if key in _PLACES_CACHE:
        return _PLACES_CACHE[key]
    places = _wiki_places(lat, lon)
    venues = _serp_venues(place) if place else {"food": [], "stay": []}
    if not venues["food"]:
        venues = _overpass_venues(lat, lon)  # free fallback
    places.update(venues)
    if any(places.values()):
        _PLACES_CACHE[key] = places
    return places


def _describe(p: dict) -> str:
    """One factual line about a place: what it is + what is notable."""
    bits = []
    about = p.get("about") or ""
    if about:
        bits.append(about)
    facts = p.get("facts") or []
    if facts:
        bits.append(("Highlights: " if not about else "Also: ") + ", ".join(facts) + ".")
    if not bits:
        bits.append(f"{p['kind'].capitalize()}.")
    return " ".join(bits)


_SLOT_TIMES = ("Morning", "Afternoon", "Evening")


def _plan_days(num_days: int, places: dict) -> list[dict]:
    """Pure-code scheduling: which real places go in which slot of each day."""
    green, museums, sights = places.get("green", []), places.get("museums", []), places.get("sights", [])
    food, stay = places.get("food", []), places.get("stay", [])

    def pick(lst, i):
        return lst[i % len(lst)] if lst else None

    days = []
    for d in range(num_days):
        morning = [p for p in (pick(green, d) or pick(sights, 3 * d), pick(sights, 2 * d)) if p]
        afternoon = [p for p in (pick(food, 2 * d + 1), pick(museums, d) or pick(sights, 2 * d + 1)) if p]
        evening = [p for p in (pick(food, 2 * d),) if p]
        # de-duplicate within a slot
        slots = []
        for label, items in zip(_SLOT_TIMES, (morning, afternoon, evening)):
            uniq, seen = [], set()
            for p in items:
                if p["name"] not in seen:
                    seen.add(p["name"])
                    uniq.append(p)
            slots.append((label, uniq))
        days.append({"slots": slots})
    return days


def _air_info(env: dict):
    pm25 = env.get("pm25")
    if pm25 is None:
        return "Live air quality data unavailable.", "Early morning is usually the cleanest time outdoors."
    level = "good" if pm25 <= 10 else "moderate" if pm25 <= 25 else "poor"
    line = f"Current PM2.5: {pm25:.1f} µg/m³ ({level})"
    tip = (
        "Air is clean today - ideal for walking and cycling." if level == "good"
        else "Prefer parks and early-morning outdoor visits." if level == "moderate"
        else "Limit strenuous outdoor activity; favour indoor sights and public transit."
    )
    return line, tip


_ECO_TIPS = [
    None,  # day 1 uses the live air-quality tip
    "Carry a reusable bottle and refill it instead of buying plastic.",
    "Use public transit or bike-share between stops - up to 80% less CO₂ than taxis.",
    "Pick seasonal, local dishes to cut food miles.",
]


def _place_facts(p: dict) -> str:
    return _describe(p)


def _get_rating_price(p: dict) -> str:
    facts = p.get("facts", [])
    rating = ""
    price = ""
    for f in facts:
        if "rated " in f:
            m = re.search(r"rated\s+([\d\.]+/[\d\.]+(?:\s+from\s+[\d,]+\s+reviews)?)", f)
            if m:
                clean_r = m.group(1).replace(" from ", " (").replace(" reviews", " rev)")
                rating = f"⭐ {clean_r}"
        elif "price " in f:
            price = f.replace("price ", "").strip()
    if rating and price:
        return f"{rating} • {price}"
    if rating:
        return rating
    if price:
        return price
    k = (p.get("kind") or "").lower()
    if any(w in k for w in ("park", "garden", "nature", "forest", "reserve", "lake", "mountain")):
        return "🌿 Free / Public"
    if "museum" in k or "gallery" in k:
        return "🏺 Museum Entry"
    return "🏛️ Historic Sight"


def _render_stays_table(stay: list) -> str:
    if not stay:
        return ""
    lines = [
        "### 🏨 Recommended Eco-Friendly Stays",
        "",
        "| Accommodation | Type | Rating & Reviews | Price | Highlights & Sustainability |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]
    for s in stay[:4]:
        name = s["name"]
        kind = s.get("kind", "Hotel").capitalize()
        rp = _get_rating_price(s)
        rating_part = rp.split(" • ")[0] if " • " in rp else rp
        price_part = rp.split(" • ")[1] if " • " in rp else "Check Rates"
        if not rating_part.startswith("⭐"):
            rating_part = "⭐ Highly Rated"
        about = s.get("about") or "Comfortable eco-conscious stay with easy public transit access."
        lines.append(f"| **{name}** | {kind} | {rating_part} | {price_part} | {about} |")
    return "\n".join(lines)


def _render_day_plain_table(day_no: int, day: dict, tip: str) -> str:
    """Deterministic markdown table for a day."""
    time_icons = {
        "Morning": "🌅 Morning",
        "Afternoon": "🏺 Afternoon",
        "Evening": "🌆 Evening",
    }
    lines = [
        f"## Day {day_no}: Eco-Exploration",
        "",
        "| Time | Stop / Venue | Type | Rating & Price | What Makes It Special |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]
    for label, items in day["slots"]:
        for idx, p in enumerate(items):
            if label == "Morning":
                slot_time = "🌅 Morning" if idx == 0 else "🕒 Late Morning"
            elif label == "Afternoon":
                slot_time = "🍽️ Lunch" if idx == 0 and "restaurant" in p.get("kind", "").lower() else "🏺 Afternoon"
            else:
                slot_time = "🌙 Evening"
            rp = _get_rating_price(p)
            desc = _place_facts(p)
            lines.append(f"| {slot_time} | **{p['name']}** | {p.get('kind', 'Sight')} | {rp} | {desc} |")
    lines.append("")
    lines.append(f"**Eco Tip:** {tip}")
    return "\n".join(lines)


_LLM_TABLE_SYSTEM = (
    "You are a friendly eco-travel writer for EcoLens. You receive ONE day of a trip as structured facts. "
    "Rewrite it as a neat, human-readable itinerary day featuring a Markdown Table. Rules:\n"
    "1. Keep every place in order and do not invent new places or facts.\n"
    "2. Output EXACTLY this markdown shape:\n"
    "## Day N: <Catchy Eco Theme>\n\n"
    "| Time | Stop / Venue | Type | Rating & Price | What Makes It Special |\n"
    "| :--- | :--- | :--- | :--- | :--- |\n"
    "| 🌅 Morning | **Place** | Category | Rating/Price | 1-2 vivid sentences on why to visit. |\n"
    "| ... | ... | ... | ... | ... |\n\n"
    "**Eco Tip:** <the tip given>\n"
    "Do not add extra text, preamble, or conversational comments outside this markdown."
)


def _llm_render_day(day_no: int, day: dict, tip: str, plain: str) -> str | None:
    """LLM turns one day's facts into polished table. Falls back gracefully."""
    if not settings.GROQ_API_KEY:
        return None
    names = [p["name"] for _, items in day["slots"] for p in items]
    if not names:
        return None
    models = [m for m in (os.getenv("GROQ_RENDER_MODEL"), "openai/gpt-oss-20b", getattr(settings, "GROQ_MODEL", None)) if m]
    user = f"Day number: {day_no}\nEco tip: {tip}\n\nFacts for this day:\n{plain}"
    for model in models:
        try:
            body = {
                "model": model,
                "messages": [{"role": "system", "content": _LLM_TABLE_SYSTEM}, {"role": "user", "content": user}],
                "temperature": 0.3,
                "max_completion_tokens": 1500,
            }
            if "gpt-oss" in model:
                body["reasoning_effort"] = "low"
            r = httpx.post("https://api.groq.com/openai/v1/chat/completions", json=body,
                           headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"}, timeout=60.0)
            if r.status_code != 200:
                logger.warning(f"Render model {model} -> {r.status_code}: {r.text[:160]}")
                continue
            text = (r.json()["choices"][0]["message"].get("content") or "").strip()
            text = re.sub(r"^```(?:markdown)?\s*|\s*```$", "", text).strip()
            ok = (
                text.startswith("## Day")
                and "| Time |" in text
                and "| :---" in text
                and "**Eco Tip:**" in text
                and all(n.split(" (")[0].lower() in text.lower() for n in names)
            )
            if ok:
                return text
            logger.warning(f"Render table output from {model} failed validation; trying next.")
        except Exception as e:
            logger.warning(f"Render call failed ({model}): {e}")
    return None


def _build_itinerary(destination: str, num_days: int, env: dict, places: dict) -> str:
    """Code plans the days; the LLM renders each day into a stunning table; falls back to plain table."""
    from concurrent.futures import ThreadPoolExecutor

    air_line, air_tip = _air_info(env)
    temp_line = f" | Temp: {env['temp']:.0f}°C" if env.get("temp") is not None else ""
    days = _plan_days(num_days, places)
    tips = [air_tip if i == 0 else _ECO_TIPS[i % len(_ECO_TIPS)] or air_tip for i in range(num_days)]
    plains = [_render_day_plain_table(i + 1, d, tips[i]) for i, d in enumerate(days)]

    with ThreadPoolExecutor(max_workers=min(num_days, 4)) as ex:
        rendered = list(ex.map(lambda i: _llm_render_day(i + 1, days[i], tips[i], plains[i]), range(num_days)))
    day_blocks = [r or plains[i] for i, r in enumerate(rendered)]

    # Header & stays
    header = f"# Eco-Travel Itinerary: {env['place']} ({num_days} Days)\n_{env['place']}: {air_line}{temp_line}_"
    stays_table = _render_stays_table(places.get("stay", []))
    footer = f"**Carbon footprint:** Walking, cycling and transit between these stops saves roughly {round(num_days * 2.3, 1)} kg CO₂ versus car travel."

    parts = [header]
    if stays_table:
        parts.append(stays_table)
    parts.extend(day_blocks)
    parts.append(footer)

    return "\n\n".join(parts)



async def plan_trip(destination: str, num_days: int) -> dict:
    """
    Code does the research and scheduling (real places + facts from Wikipedia / Google Maps);
    the LLM only renders each day into readable prose. Returns: {"itinerary": str, "research_summary": str | None}
    """
    env = _fetch_environment(destination)
    places = {"green": [], "museums": [], "sights": [], "food": [], "stay": []}
    if env.get("lat") is not None:
        places = _get_places(env["lat"], env["lon"], env["place"])

    itinerary = _build_itinerary(destination, num_days, env, places)
    research = "\n".join(
        f"{cat}: " + ", ".join(p["name"] for p in lst[:8]) for cat, lst in places.items() if lst
    ) or None
    return {"itinerary": itinerary, "research_summary": research}


def generate_ics_content(plan_text: str, start_date: datetime = None) -> bytes:
    """
    Generate an ICS calendar file from a travel itinerary text.
    Ported from the ai_travel_planner_agent_team template.
    """
    cal = Calendar()
    cal.add('prodid', '-//EcoLens AI Travel Planner//ecolens.app//')
    cal.add('version', '2.0')

    if start_date is None:
        start_date = datetime.today()

    # Split the plan into days
    day_pattern = re.compile(r'Day (\d+)[:\s]+(.*?)(?=Day \d+|$)', re.DOTALL)
    days = day_pattern.findall(plan_text)

    if not days:
        event = Event()
        event.add('summary', "EcoLens Travel Itinerary")
        event.add('description', plan_text)
        event.add('dtstart', start_date.date())
        event.add('dtend', start_date.date())
        event.add("dtstamp", datetime.now())
        cal.add_component(event)
    else:
        for day_num, day_content in days:
            day_num = int(day_num)
            current_date = start_date + timedelta(days=day_num - 1)

            event = Event()
            event.add('summary', f"Day {day_num} — EcoLens Itinerary")
            event.add('description', day_content.strip())
            event.add('dtstart', current_date.date())
            event.add('dtend', current_date.date())
            event.add("dtstamp", datetime.now())
            cal.add_component(event)

    return cal.to_ical()


def _mock_itinerary(destination: str, num_days: int) -> str:
    """Fallback mock itinerary when no LLM keys are available."""
    days = []
    activities = [
        ("Morning park walk & air quality check", "Visit local green spaces", "Evening at an eco-friendly restaurant"),
        ("Cycling tour of historic district", "Visit a sustainability center", "Sunset at a botanical garden"),
        ("Public transit to nature reserve", "Guided eco-tour", "Local farmer's market visit"),
    ]
    for i in range(1, num_days + 1):
        act = activities[(i - 1) % len(activities)]
        days.append(dedent(f"""\
            Day {i}: Eco-Exploration
            
            🌅 **Morning**: {act[0]}
            🌿 **Afternoon**: {act[1]}
            🌙 **Evening**: {act[2]}
            
            💡 **Eco Tip**: Use public transport or walk — it reduces your carbon footprint by up to 80% compared to ride-sharing.
        """))
    
    header = f"# 🌍 Eco-Travel Itinerary: {destination} ({num_days} Days)\n\n"
    footer = "\n---\n🌱 **Carbon Footprint Summary**: By choosing green transport and eco-lodges, this trip saves an estimated 45% CO₂ compared to conventional travel.\n"
    return header + "\n".join(days) + footer
