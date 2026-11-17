"""
Taxonomy normalization rules for urban infrastructure auditor.
Maps raw dataset feature labels to normalized taxonomy category IDs.
"""

from typing import Optional, Dict

# Normalized category mappings
FEATURE_TO_CATEGORY: Dict[str, str] = {
    # Green Infrastructure
    "street tree": "street_trees",
    "street trees": "street_trees",
    "street_tree": "street_trees",
    "bike lane": "bike_lanes",
    "bike lanes": "bike_lanes",
    "bike_lane": "bike_lanes",
    "bicycle lane": "bike_lanes",
    "solar panel": "solar_panels",
    "solar panels": "solar_panels",
    "solar_panel": "solar_panels",
    "ev charger": "ev_chargers",
    "ev chargers": "ev_chargers",
    "ev_charger": "ev_chargers",
    "electric vehicle charger": "ev_chargers",
    "rain garden": "rain_gardens",
    "rain gardens": "rain_gardens",
    "rain_garden": "rain_gardens",
    "bioswale": "rain_gardens",
    "green roof": "green_roofs",
    "green roofs": "green_roofs",
    "green_roof": "green_roofs",

    # Construction & Public Works
    "construction site": "construction_sites",
    "construction sites": "construction_sites",
    "construction_site": "construction_sites",
    "roadwork": "roadwork",
    "road work": "roadwork",
    "road_work": "roadwork",
    "crane": "cranes",
    "cranes": "cranes",
    "excavator": "excavators",
    "excavators": "excavators",
    "scaffolding": "scaffolding",
    "pothole": "potholes",
    "potholes": "potholes",
}

def normalize_category(raw_feature: Optional[str]) -> Optional[str]:
    """
    Normalizes raw feature string to standard taxonomy category ID.
    Returns None if no mapping exists.
    """
    if not raw_feature:
        return None
    cleaned = raw_feature.strip().lower()
    return FEATURE_TO_CATEGORY.get(cleaned)
