"""city_data.py - A sample city. Replace this with your own city/map data.

Coordinates are (x, y) in km on a simple map. Speed limits are in km/h.
"""
from graph import Graph

LOCATIONS = {
    "Airport":          (0, 8),
    "Industrial Area":  (2, 11),
    "Central Station":  (6, 6),
    "City Hall":        (8, 8),
    "Old Town":         (5, 10),
    "University":       (10, 11),
    "Stadium":          (12, 7),
    "Hospital":         (9, 4),
    "Mall":             (13, 3),
    "Tech Park":        (15, 9),
    "Harbor":           (4, 1),
    "Beach":            (8, 0),
    "Residential East": (16, 4),
    "Residential West": (1, 4),
}

# (from, to, speed_limit_kmh)
ROADS = [
    ("Airport", "Industrial Area", 60),
    ("Airport", "Residential West", 50),
    ("Airport", "Central Station", 60),
    ("Industrial Area", "Old Town", 40),
    ("Old Town", "Central Station", 30),
    ("Old Town", "City Hall", 40),
    ("Old Town", "University", 50),
    ("Central Station", "City Hall", 30),
    ("Central Station", "Hospital", 40),
    ("Central Station", "Harbor", 50),
    ("Residential West", "Harbor", 40),
    ("Harbor", "Beach", 50),
    ("Beach", "Hospital", 40),
    ("City Hall", "University", 40),
    ("City Hall", "Stadium", 50),
    ("City Hall", "Hospital", 30),
    ("University", "Tech Park", 70),
    ("Stadium", "Tech Park", 60),
    ("Stadium", "Mall", 40),
    ("Hospital", "Mall", 50),
    ("Mall", "Residential East", 50),
    ("Tech Park", "Residential East", 60),
]


def build_city():
    g = Graph()
    for name, (x, y) in LOCATIONS.items():
        g.add_location(name, x, y)
    for a, b, speed in ROADS:
        g.add_road(a, b, speed)
    return g
