"""
Parquet and GeoJSON metadata parsers for Hugging Face datasets.
"""

from typing import Generator, Dict, Any, Optional
import json

def parse_parquet_stream(file_path: str, limit: Optional[int] = None) -> Generator[Dict[str, Any], None, None]:
    """
    Streams records from Parquet file using pyarrow.
    """
    import pyarrow.parquet as pq
    table = pq.read_table(file_path)
    count = 0
    for batch in table.to_batches():
        dicts = batch.to_pylist()
        for row in dicts:
            if limit and count >= limit:
                return
            count += 1
            yield row

def parse_geojson_stream(file_path: str, limit: Optional[int] = None) -> Generator[Dict[str, Any], None, None]:
    """
    Streams records from GeoJSON FeatureCollection.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    features = data.get("features", [])
    count = 0
    for feat in features:
        if limit and count >= limit:
            break
        props = feat.get("properties", {})
        geometry = feat.get("geometry", {})
        if geometry and geometry.get("type") == "Point":
            coords = geometry.get("coordinates", [])
            if len(coords) >= 2:
                props["longitude"] = coords[0]
                props["latitude"] = coords[1]
        count += 1
        yield props
