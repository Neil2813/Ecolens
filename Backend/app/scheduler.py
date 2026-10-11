# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
import os
import urllib.request
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from app.ml import gpr_interpolation, carbon_calculator, lstm_forecast, heat_island, ndvi_processor, noise_model
from app.utils.push_handler import check_and_notify
from app.environmental import cache_warmer as env_cache_warmer

logger = logging.getLogger("scheduler")

scheduler = BackgroundScheduler(daemon=True)
_started = False

def ping_self():
    url = os.getenv("RENDER_EXTERNAL_URL")
    if not url:
        logger.info("RENDER_EXTERNAL_URL not set. Skipping self-ping.")
        return
    try:
        logger.info(f"Self-pinging to keep awake: {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "EcoLens-KeepAwake-Bot"})
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.getcode()
            logger.info(f"Self-ping response code: {status}")
    except Exception as e:
        logger.error(f"Failed to self-ping keep-alive: {e}")

def start_scheduler():
    global _started
    if _started:
        return
    # ML & sensor processing jobs
    scheduler.add_job(gpr_interpolation.run, "interval", minutes=30, id="gpr", replace_existing=True)
    scheduler.add_job(carbon_calculator.run, "interval", minutes=30, id="carbon", replace_existing=True)
    scheduler.add_job(lstm_forecast.run, "cron", hour=23, minute=0, id="lstm", replace_existing=True)
    scheduler.add_job(heat_island.run, "interval", days=8, id="heat", replace_existing=True)
    scheduler.add_job(ndvi_processor.run, "interval", days=10, id="ndvi", replace_existing=True)
    scheduler.add_job(noise_model.run, "interval", hours=12, id="noise", replace_existing=True)
    # Notification push
    scheduler.add_job(check_and_notify, "interval", minutes=5, id="push", replace_existing=True)
    # Live environmental API cache warmer — keeps TTLCache hot for major cities
    scheduler.add_job(
        env_cache_warmer.run,
        "interval",
        minutes=15,
        id="env_warm",
        replace_existing=True,
    )
    # Render Keep-Alive job (every 10 minutes to stay under the 15-minute timeout)
    scheduler.add_job(ping_self, "interval", minutes=10, id="keep_awake", replace_existing=True)
    
    scheduler.start()
    _started = True

def stop_scheduler():
    global _started
    if scheduler.running:
        scheduler.shutdown(wait=False)
    _started = False
