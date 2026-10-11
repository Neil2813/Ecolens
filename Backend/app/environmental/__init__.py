# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""Environmental data module.

Sub-modules (one per data source):
  open_meteo_aq      — PM2.5 / PM10 / NO2 / SO2 / O3 / CO via Open-Meteo Air Quality API (keyless)
  open_meteo_weather — temperature / humidity / wind / UV via Open-Meteo Forecast API (keyless)
  open_meteo_soil    — soil moisture & temperature via Open-Meteo Forecast API (keyless)
  openaq_client      — station-level AQ via OpenAQ v3 (free key, graceful fallback)
  waqi_client        — AQI index via WAQI (free token, graceful fallback)
  usgs_water         — pH / DO / turbidity via USGS Water Services (keyless, US-only)
  nasa_eonet         — wildfire / storm / volcano events via NASA EONET (keyless)
  aggregator         — unified multi-source fetch with TTLCache + DB persistence
  cache              — shared cachetools.TTLCache instances
  cache_warmer       — APScheduler job to pre-warm city bounding boxes
  router             — FastAPI router exposing /api/env/* endpoints
"""
