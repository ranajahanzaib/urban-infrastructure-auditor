"""
Coordinate validation and sanitization for geospatial observation ingestion.
"""

from typing import Tuple, Optional
import math

def validate_coordinates(lat_val: any, lon_val: any) -> Tuple[bool, Optional[float], Optional[float], Optional[str]]:
    """
    Validates latitude and longitude values.
    Returns: (is_valid, lat, lon, quarantine_reason)
    """
    try:
        lat = float(lat_val)
        lon = float(lon_val)
    except (ValueError, TypeError):
        return False, None, None, "Invalid numerical format for coordinates"

    if math.isnan(lat) or math.isnan(lon) or math.isinf(lat) or math.isinf(lon):
        return False, None, None, "Coordinate contains NaN or Inf"

    # Check bounds
    if not (-90.0 <= lat <= 90.0):
        return False, lat, lon, f"Latitude {lat} out of bounds [-90, 90]"

    if not (-180.0 <= lon <= 180.0):
        return False, lat, lon, f"Longitude {lon} out of bounds [-180, 180]"

    # Null Island check (0, 0)
    if abs(lat) < 1e-6 and abs(lon) < 1e-6:
        return False, lat, lon, "Null Island (0, 0) coordinate quarantined"

    return True, lat, lon, None
