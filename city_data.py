"""city_data.py - Kolkata road network (25 landmarks, 48 roads).

Each landmark has its real latitude and longitude. Road lengths are worked out
from those coordinates with the haversine formula, times a detour factor of 1.3
because city roads are never perfectly straight. So distances are realistic
estimates, not surveyed measurements. Speed limits are typical urban values
in km/h (what a car manages on that corridor, not the signed limit).

To use real surveyed distances, replace ROADS with data from OpenStreetMap.
"""
import math

from graph import Graph

DETOUR_FACTOR = 1.3
DEFAULT_TRIP = ("Airport", "Garia")      # trip shown when the page first opens

# name: (latitude, longitude)
LANDMARKS = {
    "Airport":           (22.6547, 88.4467),
    "Dakshineswar":      (22.6549, 88.3576),
    "Dum Dum":           (22.6226, 88.3935),
    "Shyambazar":        (22.6014, 88.3735),
    "Ultadanga":         (22.5961, 88.3956),
    "Howrah":            (22.5833, 88.3426),
    "Sealdah":           (22.5678, 88.3704),
    "Esplanade":         (22.5645, 88.3514),
    "Victoria Memorial": (22.5448, 88.3426),
    "Kidderpore":        (22.5437, 88.3222),
    "Alipore":           (22.5381, 88.3314),
    "Park Circus":       (22.5391, 88.3688),
    "Kalighat":          (22.5196, 88.3422),
    "Gariahat":          (22.5181, 88.3669),
    "Tollygunge":        (22.4985, 88.3470),
    "Jadavpur":          (22.4993, 88.3714),
    "Garia":             (22.4640, 88.3850),
    "Behala":            (22.4980, 88.3133),
    "Ruby Hospital":     (22.5148, 88.4012),
    "Science City":      (22.5397, 88.3963),
    "Beleghata":         (22.5658, 88.3950),
    "Salt Lake Stadium": (22.5683, 88.4070),
    "City Centre":       (22.5875, 88.4107),
    "Sector V":          (22.5736, 88.4331),
    "Eco Park":          (22.6038, 88.4669),
}

# Which side of its dot each name is drawn on (keeps the dense centre readable).
# Anything not listed is drawn below its dot.
LABEL_SIDE = {
    "Dakshineswar": "right", "Dum Dum": "right", "Shyambazar": "left", "Ultadanga": "left",
    "Howrah": "left", "Esplanade": "left", "Victoria Memorial": "right", "Kidderpore": "left",
    "Alipore": "below", "Sealdah": "below", "Beleghata": "above", "Salt Lake Stadium": "right",
    "City Centre": "right", "Park Circus": "below", "Science City": "right",
    "Ruby Hospital": "right", "Kalighat": "left", "Gariahat": "right", "Jadavpur": "right",
    "Tollygunge": "below", "Behala": "below", "Garia": "below", "Eco Park": "right",
    "Sector V": "right", "Airport": "left",
}

# (from, to, typical speed in km/h)
ROADS = [
    # north
    ("Airport", "Dum Dum", 50),
    ("Airport", "Ultadanga", 50),
    ("Airport", "City Centre", 50),
    ("Airport", "Eco Park", 50),
    ("Dakshineswar", "Dum Dum", 40),
    ("Dakshineswar", "Shyambazar", 40),
    ("Dum Dum", "Shyambazar", 40),
    ("Dum Dum", "Ultadanga", 40),
    ("Shyambazar", "Ultadanga", 40),
    ("Shyambazar", "Sealdah", 30),
    ("Shyambazar", "Howrah", 30),
    # central
    ("Howrah", "Esplanade", 30),
    ("Howrah", "Kidderpore", 30),
    ("Sealdah", "Esplanade", 30),
    ("Sealdah", "Beleghata", 40),
    ("Sealdah", "Park Circus", 30),
    ("Sealdah", "Ultadanga", 40),
    ("Esplanade", "Victoria Memorial", 30),
    ("Esplanade", "Park Circus", 30),
    ("Esplanade", "Kidderpore", 30),
    ("Victoria Memorial", "Alipore", 30),
    ("Victoria Memorial", "Kalighat", 30),
    ("Victoria Memorial", "Park Circus", 30),
    ("Kidderpore", "Alipore", 30),
    # south
    ("Alipore", "Kalighat", 30),
    ("Alipore", "Behala", 40),
    ("Kalighat", "Gariahat", 30),
    ("Kalighat", "Tollygunge", 30),
    ("Gariahat", "Park Circus", 30),
    ("Gariahat", "Jadavpur", 30),
    ("Jadavpur", "Tollygunge", 30),
    ("Jadavpur", "Garia", 40),
    ("Jadavpur", "Ruby Hospital", 40),
    ("Tollygunge", "Garia", 40),
    ("Tollygunge", "Behala", 40),
    # east (EM Bypass and Salt Lake)
    ("Garia", "Ruby Hospital", 50),
    ("Ruby Hospital", "Science City", 60),
    ("Park Circus", "Science City", 40),
    ("Science City", "Beleghata", 60),
    ("Beleghata", "Ultadanga", 40),
    ("Beleghata", "Salt Lake Stadium", 40),
    ("Beleghata", "Sector V", 50),
    ("Salt Lake Stadium", "City Centre", 40),
    ("Salt Lake Stadium", "Sector V", 40),
    ("City Centre", "Sector V", 40),
    ("City Centre", "Ultadanga", 50),
    ("Sector V", "Eco Park", 50),
]


def haversine_km(lat1, lon1, lat2, lon2):
    """Straight-line distance over the earth's surface, in km."""
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def project(lat, lon, lat0, lon0):
    """Turn latitude/longitude into x, y in km (x east, y north) around a
    reference point. Accurate enough for a city-sized map."""
    x = math.radians(lon - lon0) * 6371.0088 * math.cos(math.radians(lat0))
    y = math.radians(lat - lat0) * 6371.0088
    return x, y


def build_city():
    g = Graph()
    lat0 = min(lat for lat, _ in LANDMARKS.values())
    lon0 = min(lon for _, lon in LANDMARKS.values())
    for name, (lat, lon) in LANDMARKS.items():
        x, y = project(lat, lon, lat0, lon0)
        g.add_location(name, round(x, 3), round(y, 3))
    for a, b, speed in ROADS:
        (la, oa), (lb, ob) = LANDMARKS[a], LANDMARKS[b]
        length = haversine_km(la, oa, lb, ob) * DETOUR_FACTOR
        g.add_road(a, b, speed, length_km=length)
    return g
