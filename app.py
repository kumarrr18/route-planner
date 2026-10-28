"""app.py - Web server for the Smart City Traffic Route Planner.

Run:  python app.py      then open  http://127.0.0.1:5050

It reuses the same graph, algorithms and traffic modules as the command-line
version and exposes them as a small JSON API for the browser frontend.
The city lives in memory, so traffic changes last until the server restarts.
"""
from flask import Flask, jsonify, render_template, request

from algorithms import astar, dijkstra
from city_data import DEFAULT_TRIP, LABEL_SIDE, build_city
from traffic import LEVELS, block_road, randomize_traffic, reset_traffic, set_traffic

app = Flask(__name__)
graph = build_city()

ALGORITHMS = {"dijkstra": dijkstra, "astar": astar}


def road_dict(road):
    if road.blocked:
        level = "blocked"
    else:
        level = next((n for n, v in LEVELS.items() if v == road.traffic), "custom")
    return {
        "a": road.a,
        "b": road.b,
        "length_km": road.length_km,
        "speed_limit": road.speed_limit,
        "traffic": road.traffic,
        "level": level,
        "blocked": road.blocked,
    }


def summarise(result):
    """Turn a RouteResult into JSON-friendly data, with per-leg details."""
    legs, total_km, total_min = [], 0.0, 0.0
    if result.found:
        for a, b in zip(result.path, result.path[1:]):
            road = graph.get_road(a, b)
            minutes = road.travel_time_min()
            legs.append({"from": a, "to": b, "km": road.length_km,
                         "min": round(minutes, 2), "level": road_dict(road)["level"]})
            total_km += road.length_km
            total_min += minutes
    return {
        "found": result.found,
        "path": result.path,
        "cost": round(result.cost, 3) if result.found else None,
        "explored": result.explored,
        "visited": result.visited,
        "legs": legs,
        "total_km": round(total_km, 2),
        "total_min": round(total_min, 2),
    }


def bad_request(message):
    return jsonify({"error": message}), 400


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/city")
def api_city():
    return jsonify({
        "nodes": [{"name": n, "x": x, "y": y, "label": LABEL_SIDE.get(n, "below")}
                  for n, (x, y) in graph.coords.items()],
        "roads": [road_dict(r) for r in graph.roads()],
        "levels": list(LEVELS),
        "default_trip": list(DEFAULT_TRIP),
    })


@app.route("/api/route", methods=["POST"])
def api_route():
    data = request.get_json(silent=True) or {}
    start, goal = data.get("start"), data.get("goal")
    mode = data.get("mode", "time")
    algorithm = data.get("algorithm", "compare")

    if start not in graph.coords or goal not in graph.coords:
        return bad_request("Choose a start and a destination from the map.")
    if mode not in ("time", "distance"):
        return bad_request("Mode must be 'time' or 'distance'.")
    if algorithm == "compare":
        names = list(ALGORITHMS)
    elif algorithm in ALGORITHMS:
        names = [algorithm]
    else:
        return bad_request("Algorithm must be 'dijkstra', 'astar' or 'compare'.")

    results = {n: summarise(ALGORITHMS[n](graph, start, goal, mode)) for n in names}
    return jsonify({"mode": mode, "results": results})


def _road_from_request():
    data = request.get_json(silent=True) or {}
    a, b = data.get("a"), data.get("b")
    if graph.get_road(a, b) is None:
        return None, data
    return (a, b), data


@app.route("/api/traffic", methods=["POST"])
def api_traffic():
    ends, data = _road_from_request()
    level = data.get("level")
    if ends is None:
        return bad_request("That road does not exist.")
    if level not in LEVELS:
        return bad_request("Unknown traffic level.")
    return jsonify(road_dict(set_traffic(graph, *ends, level)))


@app.route("/api/block", methods=["POST"])
def api_block():
    ends, data = _road_from_request()
    if ends is None:
        return bad_request("That road does not exist.")
    return jsonify(road_dict(block_road(graph, *ends, bool(data.get("blocked", True)))))


@app.route("/api/randomize", methods=["POST"])
def api_randomize():
    randomize_traffic(graph)
    return jsonify({"ok": True})


@app.route("/api/reset", methods=["POST"])
def api_reset():
    reset_traffic(graph)
    return jsonify({"ok": True})


if __name__ == "__main__":
    import os
    # Locally: http://127.0.0.1:5050 with debug on.
    # Online (Render sets PORT): listen on all addresses, debug off.
    port = int(os.environ.get("PORT", 5050))
    online = "PORT" in os.environ
    app.run(host="0.0.0.0" if online else "127.0.0.1", port=port, debug=not online)
