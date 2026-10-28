"""traffic.py - Simulated live traffic data.

In a real system these numbers would come from sensors or a traffic API.
Here we simulate them so the planner reacts to changing conditions.
"""
import random

LEVELS = {
    "free": 1.0,
    "light": 1.3,
    "moderate": 2.0,
    "heavy": 3.0,
    "jam": 5.0,
}


def set_traffic(graph, a, b, level):
    """Set traffic on one road. level: a name from LEVELS or a number >= 1."""
    road = graph.get_road(a, b)
    if road is None:
        raise ValueError(f"No road between {a} and {b}")
    road.traffic = LEVELS[level] if isinstance(level, str) else max(1.0, float(level))
    return road


def block_road(graph, a, b, blocked=True):
    road = graph.get_road(a, b)
    if road is None:
        raise ValueError(f"No road between {a} and {b}")
    road.blocked = blocked
    return road


def randomize_traffic(graph, seed=None):
    """Give every road a random traffic level (rush-hour simulation)."""
    rng = random.Random(seed)
    names = list(LEVELS)
    weights = [40, 25, 20, 10, 5]       # most roads are fairly clear
    for road in graph.roads():
        road.blocked = False
        road.traffic = LEVELS[rng.choices(names, weights)[0]]


def reset_traffic(graph):
    for road in graph.roads():
        road.traffic = 1.0
        road.blocked = False
