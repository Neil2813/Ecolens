# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations

import os
import time
from collections import defaultdict, deque

try:
    import redis
except Exception:  # pragma: no cover - optional runtime dependency
    redis = None


class RouteLoadTracker:
    """Redis-backed route load tracker with an in-process fallback."""

    def __init__(self):
        self._redis = None
        redis_url = os.getenv("REDIS_URL")
        if redis and redis_url:
            try:
                self._redis = redis.Redis.from_url(redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None
        self._loads: dict[str, tuple[int, float]] = {}
        self._inflows: dict[str, deque[float]] = defaultdict(deque)

    def register_user_on_route(self, route_id: str, duration_min: float) -> None:
        ttl = int(duration_min * 60) + 300
        if self._redis:
            key = f"route_load:{route_id}"
            self._redis.incr(key)
            self._redis.expire(key, ttl)
            self.update_inflow_rate(route_id)
            return

        count, _ = self._loads.get(route_id, (0, 0.0))
        self._loads[route_id] = (count + 1, time.time() + ttl)
        self.update_inflow_rate(route_id)

    def deregister_user_from_route(self, route_id: str) -> None:
        if self._redis:
            key = f"route_load:{route_id}"
            current = int(self._redis.get(key) or 0)
            if current > 0:
                self._redis.decr(key)
            return

        count, expiry = self._loads.get(route_id, (0, 0.0))
        self._loads[route_id] = (max(0, count - 1), expiry)

    def get_route_load(self, route_id: str) -> int:
        if self._redis:
            return int(self._redis.get(f"route_load:{route_id}") or 0)

        count, expiry = self._loads.get(route_id, (0, 0.0))
        if expiry and expiry < time.time():
            self._loads.pop(route_id, None)
            return 0
        return count

    def update_inflow_rate(self, route_id: str) -> None:
        if self._redis:
            key = f"route_inflow:{route_id}:{int(time.time() // 60)}"
            self._redis.incr(key)
            self._redis.expire(key, 120)
            return

        now = time.time()
        q = self._inflows[route_id]
        q.append(now)
        while q and q[0] < now - 120:
            q.popleft()

    def get_inflow_rate(self, route_id: str) -> float:
        if self._redis:
            now_bucket = int(time.time() // 60)
            total = 0
            for bucket in (now_bucket, now_bucket - 1):
                total += int(self._redis.get(f"route_inflow:{route_id}:{bucket}") or 0)
            return total / 2.0

        now = time.time()
        q = self._inflows[route_id]
        while q and q[0] < now - 120:
            q.popleft()
        return len(q) / 2.0


tracker = RouteLoadTracker()
