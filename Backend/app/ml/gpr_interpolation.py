# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""Gaussian Process Regression (GPR) spatial interpolation pipeline.

Runs every 30 minutes (via APScheduler). Pulls the most recent live
environmental readings from the LiveEnvironmentalReading table, trains
a GPR model on the available (lat, lon) → pm25/no2 readings, then
interpolates values across all EnvironmentalSegment rows that haven't
been updated from live data yet.

This closes the live data loop:
  Live API → LiveEnvironmentalReading → GPR → EnvironmentalSegment → Route scoring
"""

from __future__ import annotations
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


def run() -> dict:
    """Interpolate live AQ readings onto route segments using GPR.

    Returns a status dict describing how many segments were enriched.
    """
    try:
        return _run_interpolation()
    except Exception as exc:
        logger.warning("GPR interpolation failed: %s", exc)
        return {"status": "error", "module": "gpr_interpolation", "error": str(exc)}


def _run_interpolation() -> dict:
    import numpy as np
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import RBF, WhiteKernel

    from app.db.session import SessionLocal
    from app.db.models import LiveEnvironmentalReading, EnvironmentalSegment

    db = SessionLocal()
    try:
        # ── Step 1: Load recent live readings (last 2 hours) ──────────────────
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)
        pm25_rows = (
            db.query(LiveEnvironmentalReading)
            .filter(
                LiveEnvironmentalReading.parameter == "pm25",
                LiveEnvironmentalReading.fetched_at >= cutoff,
                LiveEnvironmentalReading.value.isnot(None),
            )
            .all()
        )
        no2_rows = (
            db.query(LiveEnvironmentalReading)
            .filter(
                LiveEnvironmentalReading.parameter == "no2",
                LiveEnvironmentalReading.fetched_at >= cutoff,
                LiveEnvironmentalReading.value.isnot(None),
            )
            .all()
        )

        if len(pm25_rows) < 2:
            logger.info("GPR: insufficient live PM2.5 readings (%d), skipping.", len(pm25_rows))
            return {"status": "skipped", "module": "gpr_interpolation", "reason": "insufficient_data"}

        # ── Step 2: Fit GPR models ────────────────────────────────────────────
        kernel = RBF(length_scale=0.1, length_scale_bounds=(0.01, 1.0)) + WhiteKernel(noise_level=1.0)

        def _fit_gpr(rows):
            X = np.array([[r.lat, r.lon] for r in rows])
            y = np.array([r.value for r in rows])
            gpr = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=2, normalize_y=True)
            gpr.fit(X, y)
            return gpr

        gpr_pm25 = _fit_gpr(pm25_rows)
        gpr_no2  = _fit_gpr(no2_rows) if len(no2_rows) >= 2 else None

        # ── Step 3: Load all segments and interpolate ─────────────────────────
        segments = db.query(EnvironmentalSegment).all()
        if not segments:
            return {"status": "ok", "module": "gpr_interpolation", "segments_updated": 0}

        # Parse rough centroids from segment_id (format: "lat_lon" or fallback)
        enriched = 0
        for seg in segments:
            try:
                parts = seg.segment_id.split("_")
                if len(parts) >= 2:
                    seg_lat = float(parts[0])
                    seg_lon = float(parts[1])
                else:
                    continue
            except (ValueError, AttributeError):
                continue

            X_pred = np.array([[seg_lat, seg_lon]])
            pm25_pred, _ = gpr_pm25.predict(X_pred, return_std=True)
            pm25_val = max(0.0, float(pm25_pred[0]))

            seg.pm25 = round(pm25_val, 1)
            if gpr_no2:
                no2_pred, _ = gpr_no2.predict(X_pred, return_std=True)
                seg.no2 = round(max(0.0, float(no2_pred[0])), 1)

            # Recompute ecoscore from updated values
            seg.ecoscore = max(0, min(100, int(
                100
                - (0.35 * seg.pm25)
                - (8.0 * float(seg.co2_per_min or 0))
                - (0.9 * float(seg.noise_db or 0))
                + (12.0 * float(seg.ndvi or 0))
            )))
            seg.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            enriched += 1

        db.commit()
        logger.info("GPR: enriched %d segments from %d live readings.", enriched, len(pm25_rows))
        return {
            "status":           "ok",
            "module":           "gpr_interpolation",
            "segments_updated": enriched,
            "pm25_readings":    len(pm25_rows),
            "no2_readings":     len(no2_rows),
        }
    finally:
        db.close()
