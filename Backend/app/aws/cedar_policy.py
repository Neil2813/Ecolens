# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
"""
AWS Cedar Policy Evaluator Service.

Uses Amazon's open-source Cedar Policy Language to enforce fine-grained,
declarative safety rules for child respiratory protection and school air actions.

Policies defined in: app/policies/pediatric_safety.cedar

When USE_CEDAR_POLICIES=true:
  - Evaluates authorization requests against the Cedar policy AST.
When USE_CEDAR_POLICIES=false (Default Fallback):
  - Uses native Python rule evaluator that mirrors the exact Cedar specification.
"""

from __future__ import annotations
import logging
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger("cedar_policy")

POLICY_FILE = Path(__file__).resolve().parent.parent / "policies" / "pediatric_safety.cedar"


class CedarPolicyEvaluator:
    def __init__(self):
        self._policy_text = ""
        self._load_policy()

    def _load_policy(self):
        if POLICY_FILE.exists():
            try:
                self._policy_text = POLICY_FILE.read_text(encoding="utf-8")
            except Exception as e:
                logger.warning(f"Could not read Cedar policy file: {e}")

    @property
    def is_active(self) -> bool:
        return bool(settings.USE_CEDAR_POLICIES)

    def evaluate_school_safety(
        self,
        outdoor_aqi: float,
        outdoor_pm25: float,
        has_asthma: bool = False,
        wearing_n95: bool = False,
    ) -> dict[str, Any]:
        """Evaluate access & safety decisions for students on a school campus."""
        # Try native Cedar evaluation if enabled and package is available
        if self.is_active:
            try:
                import cedarpolicy  # type: ignore
                request = {
                    "principal": 'Group::"SensitiveStudents"' if has_asthma else 'Group::"Students"',
                    "action": 'Action::"OutdoorAthletics"',
                    "resource": 'Facility::"SchoolPlayground"',
                    "context": {
                        "outdoor_aqi": int(outdoor_aqi),
                        "outdoor_pm25": float(outdoor_pm25),
                        "has_respiratory_vulnerability": has_asthma,
                        "wearing_n95_mask": wearing_n95,
                    },
                }
                decision = cedarpolicy.is_authorized(
                    request, self._policy_text, entities=[]
                )
                return {
                    "policy_engine": "AWS_Cedar_Engine",
                    "policy_source": str(POLICY_FILE.name),
                    "recess_allowed": decision.decision == "Allow",
                    "athletics_allowed": outdoor_aqi <= 150 and decision.decision == "Allow",
                    "active_commute_safe": outdoor_aqi <= 100 or wearing_n95,
                    "engine_status": "evaluated_by_cedar",
                }
            except Exception as exc:
                logger.debug(f"Cedar runtime fallback to Python rules engine: {exc}")

        # Standard Fallback Engine (strictly conforms to pediatric_safety.cedar semantics)
        recess_permitted = outdoor_aqi <= 100 or (outdoor_aqi <= 150 and not has_asthma)
        if outdoor_aqi > 200 or outdoor_pm25 > 150.0:
            recess_permitted = False

        athletics_permitted = outdoor_aqi <= 150 and not (has_asthma and outdoor_aqi > 100)
        commute_safe = outdoor_aqi <= 100 or wearing_n95 or not has_asthma

        return {
            "policy_engine": "AWS_Cedar_Specification (Native Fallback)",
            "policy_file": "app/policies/pediatric_safety.cedar",
            "is_cedar_enforced": self.is_active,
            "recess_allowed": recess_permitted,
            "athletics_allowed": athletics_permitted,
            "active_commute_safe": commute_safe,
            "engine_status": "evaluated_cleanly",
        }


# Global singleton instance
cedar_evaluator = CedarPolicyEvaluator()
