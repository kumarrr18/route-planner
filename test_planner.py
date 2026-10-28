"""test_planner.py - Run with:  python -m unittest -v"""
import itertools
import math
import unittest

from city_data import build_city
from algorithms import dijkstra, astar
from traffic import set_traffic, block_road, randomize_traffic


class TestRoutePlanner(unittest.TestCase):
    def setUp(self):
        self.g = build_city()

    def test_same_start_and_goal(self):
        r = dijkstra(self.g, "Airport", "Airport")
        self.assertTrue(r.found)
        self.assertEqual(r.path, ["Airport"])
        self.assertEqual(r.cost, 0)

    def test_astar_matches_dijkstra_everywhere(self):
        """A* must give the same optimal cost as Dijkstra for every pair,
        in both modes, with and without traffic."""
        for seed in (None, 1, 2, 3):
            if seed is not None:
                randomize_traffic(self.g, seed)
            for mode in ("time", "distance"):
                for a, b in itertools.permutations(self.g.locations(), 2):
                    d = dijkstra(self.g, a, b, mode)
                    s = astar(self.g, a, b, mode)
                    self.assertTrue(d.found and s.found)
                    self.assertAlmostEqual(d.cost, s.cost, places=6,
                                           msg=f"{a}->{b} {mode} seed={seed}")

    def test_astar_explores_no_more_on_average(self):
        total_d = total_a = 0
        for a, b in itertools.permutations(self.g.locations(), 2):
            total_d += dijkstra(self.g, a, b, "distance").explored
            total_a += astar(self.g, a, b, "distance").explored
        self.assertLessEqual(total_a, total_d)

    def test_traffic_changes_route(self):
        before = dijkstra(self.g, "Central Station", "Stadium", "time")
        # jam every road on the current route
        for a, b in zip(before.path, before.path[1:]):
            set_traffic(self.g, a, b, "jam")
        after = dijkstra(self.g, "Central Station", "Stadium", "time")
        self.assertGreater(after.cost, before.cost)

    def test_blocked_road_is_avoided(self):
        before = dijkstra(self.g, "Airport", "Central Station", "time")
        block_road(self.g, "Airport", "Central Station")
        after = dijkstra(self.g, "Airport", "Central Station", "time")
        self.assertTrue(after.found)
        self.assertNotEqual(before.path, after.path)
        self.assertNotIn(("Airport", "Central Station"),
                         list(zip(after.path, after.path[1:])))

    def test_unreachable_destination(self):
        # cut every road out of Beach
        for nbr in list(self.g.adj["Beach"]):
            block_road(self.g, "Beach", nbr)
        for algo in (dijkstra, astar):
            r = algo(self.g, "Airport", "Beach")
            self.assertFalse(r.found)
            self.assertEqual(r.cost, math.inf)


if __name__ == "__main__":
    unittest.main()
