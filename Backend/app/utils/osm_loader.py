# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from __future__ import annotations
import math
from pathlib import Path
import networkx as nx
from app.core.config import settings

_GRAPH = None

def _build_demo_graph():
    g = nx.Graph()
    base_lat, base_lng = 13.0012, 80.2565
    step = 0.004
    for i in range(4):
        for j in range(4):
            n = f"n_{i}_{j}"
            g.add_node(n, x=base_lng + j * step, y=base_lat + i * step)
    for i in range(4):
        for j in range(4):
            if j < 3:
                a, b = f"n_{i}_{j}", f"n_{i}_{j+1}"
                dist = 0.45
                g.add_edge(a, b, length=dist, travel_time=dist * 4, segment_id=f"seg_{i}{j}h")
            if i < 3:
                a, b = f"n_{i}_{j}", f"n_{i+1}_{j}"
                dist = 0.45
                g.add_edge(a, b, length=dist, travel_time=dist * 5, segment_id=f"seg_{i}{j}v")
    return g

def load_graph():
    global _GRAPH
    if _GRAPH is not None:
        return _GRAPH
    path = Path(settings.OSM_GRAPH_PATH)
    if path.exists():
        try:
            _GRAPH = nx.read_graphml(path)
            return _GRAPH
        except Exception:
            pass
    _GRAPH = _build_demo_graph()
    return _GRAPH

def nearest_node(graph, lat: float, lng: float):
    best = None
    best_d = 1e18
    for node, data in graph.nodes(data=True):
        x = float(data.get("x", 0))
        y = float(data.get("y", 0))
        d = (x - lng) ** 2 + (y - lat) ** 2
        if d < best_d:
            best, best_d = node, d
    return best
