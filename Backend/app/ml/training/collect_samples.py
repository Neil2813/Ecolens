# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations

from datetime import datetime

from app.ml.ppo_reward import compute_reward


def collect_training_sample(trip_id: str, route_index: int, predicted_state: dict, actual_outcome: dict) -> dict:
    return {
        "trip_id": trip_id,
        "state_vector": predicted_state,
        "action": route_index,
        "reward": compute_reward(route_index, predicted_state, actual_outcome),
        "actual_pm25": actual_outcome.get("actual_pm25_inhaled"),
        "predicted_ecoscore_t10": predicted_state.get("ecoscore_t10", [None])[route_index],
        "actual_ecoscore_t10": actual_outcome.get("measured_ecoscore_t10"),
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
