# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations


def compute_reward(action: int, state: dict, outcome: dict) -> float:
    actual_pm25 = float(outcome["actual_pm25_inhaled"])
    fastest_pm25 = max(float(outcome["fastest_route_pm25"]), 1.0)
    actual_load_after = float(outcome["route_load_at_t10"])
    predicted_load = float(state.get("predicted_load_t10", [0])[action])

    exposure_reward = (fastest_pm25 - actual_pm25) / fastest_pm25 * 10
    if actual_load_after > 30:
        load_penalty = -5
    elif actual_load_after > 20:
        load_penalty = -2
    else:
        load_penalty = 0

    prediction_error = abs(predicted_load - actual_load_after) / max(actual_load_after, 1)
    prediction_reward = max(0, 2 - prediction_error * 2)

    pref = state.get("user_preference", [0, 1, 0])
    if pref[1] == 1:
        pref_reward = 3 if action == max(range(len(state["ecoscore_now"])), key=state["ecoscore_now"].__getitem__) else 1
    elif pref[2] == 1:
        pref_reward = 3 if action == min(range(len(state["carbon_scores"])), key=state["carbon_scores"].__getitem__) else 1
    else:
        pref_reward = 3 if action == min(range(len(state["time_scores"])), key=state["time_scores"].__getitem__) else 1

    return exposure_reward + load_penalty + prediction_reward + pref_reward
