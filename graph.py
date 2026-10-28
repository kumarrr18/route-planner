"""graph.py - Graph data structure for the city road network.

Each location is a node (with x, y coordinates in km).
Each road is an undirected edge that stores length, speed limit and traffic.
"""
import math


class Edge:
    """A road between two locations. The same Edge object is shared by both
    directions, so updating traffic once affects both ways."""

    def __init__(self, a, b, length_km, speed_limit):
        self.a = a
        self.b = b
        self.length_km = length_km
        self.speed_limit = speed_limit      # km/h
        self.traffic = 1.0                  # 1.0 = free flow, 3.0 = 3x slower
        self.blocked = False

    def travel_time_min(self):
        """Travel time in minutes, taking traffic into account."""
        if self.blocked:
            return math.inf
        effective_speed = self.speed_limit / self.traffic
        return self.length_km / effective_speed * 60

    def weight(self, mode):
        """Edge cost used by the algorithms. mode: 'time' or 'distance'."""
        if self.blocked:
            return math.inf
        return self.travel_time_min() if mode == "time" else self.length_km


class Graph:
    def __init__(self):
        self.coords = {}      # name -> (x, y)
        self.adj = {}         # name -> {neighbour: Edge}  (adjacency list)

    # ---------- building the graph ----------
    def add_location(self, name, x, y):
        self.coords[name] = (x, y)
        self.adj.setdefault(name, {})

    def euclidean(self, a, b):
        (x1, y1), (x2, y2) = self.coords[a], self.coords[b]
        return math.hypot(x1 - x2, y1 - y2)

    def add_road(self, a, b, speed_limit=40, length_km=None):
        """Add a two-way road. If length is not given, it is the straight-line
        distance times 1.15 (roads are never perfectly straight). Length is
        never allowed to be shorter than the straight line, which keeps the
        A* heuristic valid."""
        straight = self.euclidean(a, b)
        if length_km is None:
            length_km = straight * 1.15
        length_km = max(length_km, straight)
        edge = Edge(a, b, round(length_km, 2), speed_limit)
        self.adj[a][b] = edge
        self.adj[b][a] = edge

    # ---------- queries ----------
    def neighbours(self, node):
        return self.adj[node].items()

    def locations(self):
        return sorted(self.coords)

    def max_speed(self):
        speeds = [e.speed_limit for nbrs in self.adj.values() for e in nbrs.values()]
        return max(speeds) if speeds else 1

    def roads(self):
        seen, result = set(), []
        for a, nbrs in self.adj.items():
            for b, edge in nbrs.items():
                if id(edge) not in seen:
                    seen.add(id(edge))
                    result.append(edge)
        return result

    def get_road(self, a, b):
        return self.adj.get(a, {}).get(b)
