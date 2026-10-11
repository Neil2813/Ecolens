# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations

import numpy as np

try:
    import gymnasium as gym
    from gymnasium import spaces
except Exception:  # pragma: no cover - optional training dependency
    gym = None
    spaces = None

from app.ml.ppo_reward import compute_reward


if gym:
    class EcoLensRoutingEnv(gym.Env):
        """Synthetic routing environment for offline PPO training."""

        metadata = {"render_modes": []}

        def __init__(self, max_routes: int = 8):
            super().__init__()
            self.max_routes = max_routes
            obs_dim = (max_routes * 6) + 6
            self.observation_space = spaces.Box(
                low=0.0,
                high=1.0,
                shape=(obs_dim,),
                dtype=np.float32,
            )
            self.action_space = spaces.Discrete(max_routes)
            self.current_state = None
            self.step_count = 0

        def reset(self, seed=None, options=None):
            super().reset(seed=seed)
            self.current_state = self._sample_scenario()
            self.step_count = 0
            return self._flatten_state(self.current_state), {}

        def step(self, action):
            action = int(min(action, len(self.current_state["ecoscore_now"]) - 1))
            outcome = self._simulate_outcome(action, self.current_state)
            reward = compute_reward(action, self.current_state, outcome)
            self.current_state["current_load"][action] += 1
            self.step_count += 1
            terminated = self.step_count >= 200
            next_state = self._sample_scenario()
            self.current_state = next_state
            return self._flatten_state(next_state), reward, terminated, False, {}

        def _flatten_state(self, state):
            arr = []
            n = self.max_routes
            for key in [
                "ecoscore_now",
                "ecoscore_t10",
                "ecoscore_t20",
                "ecoscore_t30",
                "current_load",
                "degradation_rate",
            ]:
                vals = state.get(key, [0] * n)
                arr.extend([v / 100 for v in vals[:n]] + [0] * (n - len(vals)))
            arr.extend(state["user_preference"])
            arr.append(state["user_exposure_today"])
            arr.append(state["time_of_day"])
            arr.append(state["trip_urgency"])
            return np.array(arr, dtype=np.float32)

        def _sample_scenario(self):
            n = np.random.randint(3, self.max_routes + 1)
            ecoscore_now = np.random.uniform(40, 95, n).tolist()
            return {
                "ecoscore_now": ecoscore_now,
                "ecoscore_t10": np.random.uniform(35, 90, n).tolist(),
                "ecoscore_t20": np.random.uniform(30, 88, n).tolist(),
                "ecoscore_t30": np.random.uniform(28, 85, n).tolist(),
                "current_load": np.random.randint(0, 40, n).tolist(),
                "degradation_rate": np.random.uniform(0.3, 2.0, n).tolist(),
                "predicted_load_t10": np.random.randint(0, 45, n).tolist(),
                "carbon_scores": np.random.uniform(40, 300, n).tolist(),
                "time_scores": np.random.uniform(8, 45, n).tolist(),
                "user_preference": np.random.multinomial(1, [0.3, 0.5, 0.2]).tolist(),
                "user_exposure_today": float(np.random.uniform(0, 1)),
                "time_of_day": float(np.random.uniform(0, 1)),
                "trip_urgency": float(np.random.uniform(0, 1)),
            }

        def _simulate_outcome(self, action, state):
            base_pm25 = (1 - state["ecoscore_now"][action] / 100) * 300
            load_impact = state["current_load"][action] * 2.5
            actual_pm25 = base_pm25 + load_impact + np.random.normal(0, 10)
            return {
                "actual_pm25_inhaled": max(0, actual_pm25),
                "fastest_route_pm25": (1 - max(state["ecoscore_now"]) / 100) * 300 * 1.5,
                "route_load_at_t10": state["current_load"][action] + np.random.randint(1, 8),
            }
else:
    class EcoLensRoutingEnv:  # type: ignore[no-redef]
        def __init__(self, *args, **kwargs):
            raise RuntimeError("gymnasium is required for PPO training")
