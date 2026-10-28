# Smart City Traffic Route Planner

Finds the fastest or shortest route between two points in a city using
**Dijkstra's algorithm** and **A\* search**, and reacts to traffic and road closures.

## Run
```
python main.py              # interactive menu
python -m unittest -v       # run tests
```
Needs Python 3.8+ and no extra packages.

## Files
| File | Purpose |
|---|---|
| `graph.py` | Graph (adjacency list) + `Edge` class holding length, speed limit, traffic, blocked flag |
| `city_data.py` | Kolkata map: 25 landmarks with real latitude/longitude and 47 roads |
| `sample_city.py` | The original small made-up city (optional, for comparison) |
| `algorithms.py` | `dijkstra()`, `astar()` and the A* heuristic (both use a min-heap) |
| `traffic.py` | Set traffic level, block roads, random rush-hour simulation |
| `main.py` | Menu-driven command-line interface |
| `test_planner.py` | Unit tests (A* must equal Dijkstra on every pair) |

## How it works
- **Graph:** locations are nodes, roads are weighted edges. Weight is either
  distance (km) or travel time (min) = length / (speed limit / traffic factor).
- **Dijkstra:** always expands the cheapest unvisited node. O((V+E) log V).
- **A\*:** same, but orders the heap by `f = g + h`, where `h` is an optimistic
  straight-line estimate to the goal. It explores fewer nodes and still finds the
  optimal path because `h` never overestimates.
- **Traffic:** a multiplier >= 1 slows a road; a blocked road has infinite cost
  and is skipped, so routes change automatically.

## About the Kolkata map
- Landmarks use their approximate real coordinates (Airport, Howrah, Sealdah, Esplanade, Salt Lake, Garia and more).
- Each road's length = straight-line (haversine) distance x 1.3 detour factor, so distances are realistic estimates, not surveyed values.
- Speeds are typical urban speeds per corridor. Edit `LANDMARKS`, `ROADS` and `DETOUR_FACTOR` in `city_data.py` to change the map.
- To use the old city, change `from city_data import ...` to `from sample_city import ...` (the web labels and default trip need `city_data.py`).

## Web frontend
```
pip install -r requirements.txt     # installs Flask (one time)
python app.py                       # then open http://127.0.0.1:5050
```
| File | Purpose |
|---|---|
| `app.py` | Flask server: serves the page and a JSON API that reuses the modules above |
| `templates/index.html` | Page structure |
| `static/style.css` | Styling |
| `static/app.js` | Draws the SVG map, calls the API, shows the route and itinerary |

In the browser: click two locations (or use the dropdowns) and press **Find route**.
Click a road to set its traffic or close it; the route re-plans automatically.
**Compare** runs Dijkstra and A* side by side and shows how many locations each searched.

## Ideas to extend
- Load a real map (OpenStreetMap / OSMnx) instead of `city_data.py`
- One-way roads (store directed edges)
- Draw the map and route with matplotlib
- Time-of-day traffic profiles
