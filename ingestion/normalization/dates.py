"""
Date parsing and normalization for observation timelines.
"""

from typing import Optional, Tuple
from datetime import datetime, timezone
import dateutil.parser

def parse_observation_date(date_str: any) -> Tuple[Optional[datetime], bool]:
    """
    Parses raw observation date string into UTC datetime.
    Returns: (parsed_datetime, has_timestamp)
    """
    if not date_str or str(date_str).strip() == "" or str(date_str).lower() == "nan":
        return None, False

    clean_str = str(date_str).strip()
    try:
        dt = dateutil.parser.isoparse(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt, True
    except Exception:
        pass

    try:
        dt = dateutil.parser.parse(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt, True
    except Exception:
        return None, False
