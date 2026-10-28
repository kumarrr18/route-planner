"""main.py - Command-line interface for the Smart City Traffic Route Planner.

Run:  python main.py
"""
import math

from city_data import build_city
from algorithms import dijkstra, astar
from traffic import LEVELS, set_traffic, block_road, randomize_traffic, reset_traffic


def pick_location(graph, prompt):
    names = graph.locations()
    while True:
        raw = input(prompt).strip()
        if raw.isdigit() and 1 <= int(raw) <= len(names):
            return names[int(raw) - 1]
        for n in names:                  # also accept typed names
            if n.lower() == raw.lower():
                return n
        print("  Invalid choice, try again.")


def show_locations(graph):
    print("\nLocations:")
    for i, name in enumerate(graph.locations(), 1):
        print(f"  {i:2}. {name}")


def pick_mode():
    m = input("Optimise for (1) fastest time  (2) shortest distance: ").strip()
    return "distance" if m == "2" else "time"


def describe(result, mode, graph):
    if not result.found:
        print("  No route found (destination unreachable).")
        return
    unit = "min" if mode == "time" else "km"
    print("  Route :", " -> ".join(result.path))
    print(f"  Cost  : {result.cost:.1f} {unit}")
    if mode == "time":
        km = sum(graph.get_road(a, b).length_km
                 for a, b in zip(result.path, result.path[1:]))
        print(f"  Length: {km:.1f} km")
    print(f"  Nodes explored: {result.explored}")


def find_route(graph, use_astar):
    show_locations(graph)
    start = pick_location(graph, "From (number or name): ")
    goal = pick_location(graph, "To   (number or name): ")
    mode = pick_mode()
    algo = astar if use_astar else dijkstra
    print(f"\n[{'A*' if use_astar else 'Dijkstra'}]")
    describe(algo(graph, start, goal, mode), mode, graph)


def compare(graph):
    show_locations(graph)
    start = pick_location(graph, "From: ")
    goal = pick_location(graph, "To  : ")
    mode = pick_mode()
    for label, algo in (("Dijkstra", dijkstra), ("A*", astar)):
        print(f"\n[{label}]")
        describe(algo(graph, start, goal, mode), mode, graph)


def change_traffic(graph):
    show_locations(graph)
    a = pick_location(graph, "Road start: ")
    b = pick_location(graph, "Road end  : ")
    if graph.get_road(a, b) is None:
        print("  There is no direct road between those two places.")
        return
    print("  Levels:", ", ".join(LEVELS))
    level = input("  Traffic level: ").strip().lower()
    if level not in LEVELS:
        print("  Unknown level.")
        return
    set_traffic(graph, a, b, level)
    print(f"  Traffic on {a} <-> {b} set to '{level}'.")


def toggle_block(graph):
    show_locations(graph)
    a = pick_location(graph, "Road start: ")
    b = pick_location(graph, "Road end  : ")
    road = graph.get_road(a, b)
    if road is None:
        print("  There is no direct road between those two places.")
        return
    block_road(graph, a, b, not road.blocked)
    print(f"  Road {a} <-> {b} is now {'BLOCKED' if road.blocked else 'open'}.")


def show_roads(graph):
    print(f"\n{'Road':45} {'km':>6} {'limit':>6} {'traffic':>8}")
    for r in graph.roads():
        status = "BLOCKED" if r.blocked else f"x{r.traffic:.1f}"
        print(f"{r.a + ' <-> ' + r.b:45} {r.length_km:6.1f} {r.speed_limit:6} {status:>8}")


MENU = """
===== Smart City Traffic Route Planner =====
 1. Find route with Dijkstra
 2. Find route with A*
 3. Compare Dijkstra vs A*
 4. Set traffic on a road
 5. Block / unblock a road
 6. Simulate rush-hour traffic (random)
 7. Reset all traffic
 8. Show all roads
 9. Exit
"""


def main():
    graph = build_city()
    while True:
        print(MENU)
        choice = input("Choose: ").strip()
        if choice == "1":
            find_route(graph, use_astar=False)
        elif choice == "2":
            find_route(graph, use_astar=True)
        elif choice == "3":
            compare(graph)
        elif choice == "4":
            change_traffic(graph)
        elif choice == "5":
            toggle_block(graph)
        elif choice == "6":
            randomize_traffic(graph)
            print("  Rush-hour traffic applied.")
        elif choice == "7":
            reset_traffic(graph)
            print("  All traffic cleared.")
        elif choice == "8":
            show_roads(graph)
        elif choice == "9":
            print("Goodbye!")
            break
        else:
            print("  Invalid option.")


if __name__ == "__main__":
    main()
