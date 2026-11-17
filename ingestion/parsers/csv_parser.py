"""
CSV metadata parser for Hugging Face datasets.
"""

import csv
from typing import Generator, Dict, Any, Optional

def parse_csv_stream(file_path: str, limit: Optional[int] = None) -> Generator[Dict[str, Any], None, None]:
    """
    Streams records from CSV file.
    Yields dictionary for each record with normalized column keys.
    """
    with open(file_path, mode="r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            if limit and count >= limit:
                break
            # Clean keys and values
            cleaned_row = {k.strip(): (v.strip() if v is not None else None) for k, v in row.items()}
            count += 1
            yield cleaned_row
