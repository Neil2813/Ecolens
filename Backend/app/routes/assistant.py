# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.utils.auth_dep import get_current_user
from app.schemas.assistant import AssistantChatRequest
from app.utils.llm_client import query_llm

router = APIRouter()

SYSTEM_HEALTH_AQI_PROMPT = """You are EcoLens AI Health & AQI Assistant — a friendly, clear, and easy-to-understand expert in air quality, AQI meters, atmospheric pollutants, and human health.

STRICT FORMATTING AND TONE RULES (CRITICAL):
1. NO GREETINGS OR REPETITION: NEVER start your response with "Hello", "Hi", "Welcome", "Hello!", or introductory sentences like "I am your EcoLens Assistant" or "I would be delighted to help". Jump directly into answering the user's question.
2. HUMAN-READABLE FORMULAS: NEVER output LaTeX, math, or raw code syntax (NEVER use $, \\text{}, \\mu, _, ^, {, }, or \\). Always write formulas and units in simple human-readable plain text. Write chemical names and symbols as PM2.5, PM10, NO2, SO2, CO, O3, and write units as micrograms per cubic meter.
3. NO MARKDOWN FORMATTING SYMBOLS: Do NOT use any markdown styling characters whatsoever. Specifically, NEVER use:
   - bold/italic stars: ** or *
   - horizontal rules: --- or ___
   - slashes: // or \\\\
   - backticks or code blocks: ` or ```
   - headers: #, ##, ###
   Write in clean, readable plain text paragraphs with simple numbers (1., 2.) or simple bullet points (•).
4. SIMPLE & GENTLE TERMINOLOGY: Explain everything using clear, simple, gentle everyday language. Avoid aggressive, alarming, or overly clinical technical jargon.
"""

def clean_formatting(text: str) -> str:
    """Post-processing to remove any LaTeX math syntax, markdown stars/dashes, or introductory greetings."""
    if not text:
        return ""
    
    # 1. Convert LaTeX chemical and unit expressions to plain text
    text = re.sub(r'\\\s*text\{([^\}]+)\}', r'\1', text)
    text = text.replace('\\mu', 'micrograms').replace('^3', ' cubic meter').replace('^2', ' square meter')
    text = text.replace('g/m3', 'grams per cubic meter').replace('g/m³', 'grams per cubic meter')
    text = text.replace('\\', '')
    text = re.sub(r'[\$_\{\}\^]', '', text)
    
    # 2. Strip leading greetings or repetitive introductions
    text = re.sub(
        r'^(Hello|Hi|Hey|Greetings|Welcome)[!\.,\s]+((I am|I\'m|my name is|this is)[^\n\.]*[\.\n]*)?',
        '',
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r'^(I would be delighted to|I\'d be happy to|Sure,|Certainly,)[^\n\.]*[\.\n]*',
        '',
        text,
        flags=re.IGNORECASE
    )

    # 3. Remove markdown stars (**), horizontal rules (---), code blocks, headers, and slashes
    text = text.replace('**', '').replace('---', '').replace('___', '').replace('```', '').replace('`', '')
    text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'[\/\\]{2,}', '', text)
    
    return text.strip()


@router.post("/chat")
def chat(payload: AssistantChatRequest, db: Session = Depends(get_db), user = Depends(get_current_user)):
    try:
        reply = query_llm(
            prompt=payload.message,
            system_instruction=SYSTEM_HEALTH_AQI_PROMPT
        )
        cleaned_reply = clean_formatting(reply)
        return {
            "reply": cleaned_reply,
            "sql_query": None,
            "query_results": []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assistant error: {str(e)}")




