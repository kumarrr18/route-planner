"""algorithms.py - Dijkstra's algorithm and A* search.

Both use a min-heap (priority queue). They return a RouteResult that also
records how many nodes were explored, so you can compare the two algorithms.
"""
import heapq
import math
from dataclasses import dataclass, field


@dataclass
class RouteResult:
    found: bool
    path: list = field(default_factory=list)
    cost: float = math.inf       # minutes if mode='time', km if mode='distance'
    explored: int = 0            # nodes taken out of the priority queue
    visited: list = field(default_factory=list)   # those nodes, in order (for the UI)


def _reconstruct(prev, goal):
    path = [goal]
    while path[-1] in prev:
        path.append(prev[path[-1]])
    return path[::-1]


def dijkstra(graph, start, goal, mode="time"):
    """Shortest path by exploring outward in order of cost so far.
    Time: O((V + E) log V) with a binary heap."""
    dist = {start: 0.0}
    prev = {}
    heap = [(0.0, start)]
    visited = set()
    order = []
    explored = 0

    while heap:
        d, node = heapq.heappop(heap)
        if node in visited:
            continue                    # stale heap entry
        visited.add(node)
        order.append(node)
        explored += 1
        if node == goal:
            return RouteResult(True, _reconstruct(prev, goal), d, explored, order)

        for nbr, edge in graph.neighbours(node):
            w = edge.weight(mode)
            if w == math.inf:           # blocked road
                continue
            nd = d + w
            if nd < dist.get(nbr, math.inf):
                dist[nbr] = nd
                prev[nbr] = node
                heapq.heappush(heap, (nd, nbr))

    return RouteResult(False, explored=explored, visited=order)


def heuristic(graph, a, b, mode):
    """Optimistic estimate of the remaining cost from a to b.
    - distance mode: straight-line distance (a road can't be shorter).
    - time mode: straight-line distance at the fastest speed limit in the
      city (traffic only makes things slower, so this never overestimates).
    Never overestimating keeps A* optimal."""
    straight = graph.euclidean(a, b)
    if mode == "distance":
        return straight
    return straight / graph.max_speed() * 60


def astar(graph, start, goal, mode="time"):
    """Like Dijkstra, but orders the heap by  f = g + h  so it heads toward
    the goal instead of exploring in every direction."""
    g_score = {start: 0.0}
    prev = {}
    heap = [(heuristic(graph, start, goal, mode), 0.0, start)]
    visited = set()
    order = []
    explored = 0

    while heap:
        _, g, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        explored += 1
        if node == goal:
            return RouteResult(True, _reconstruct(prev, goal), g, explored, order)

        for nbr, edge in graph.neighbours(node):
            w = edge.weight(mode)
            if w == math.inf:
                continue
            ng = g + w
            if ng < g_score.get(nbr, math.inf):
                g_score[nbr] = ng
                prev[nbr] = node
                f = ng + heuristic(graph, nbr, goal, mode)
                heapq.heappush(heap, (f, ng, nbr))

    return RouteResult(False, explored=explored, visited=order)
