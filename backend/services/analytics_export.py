import csv
import os
from datetime import datetime, timezone

_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
_CSV_PATH = os.path.join(_DATA_DIR, "prediction_logs.csv")

_FIELDS = [
    "timestamp",
    "predicted_disease",
    "confidence",
    "risk_score",
    "risk_level",
]


def _ensure_csv():
    """Create the CSV file with headers if it doesn't exist."""
    os.makedirs(_DATA_DIR, exist_ok=True)
    if not os.path.exists(_CSV_PATH):
        with open(_CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=_FIELDS)
            writer.writeheader()


class AnalyticsExporter:
    """Export prediction data to CSV for Power BI dashboards."""

    def __init__(self):
        _ensure_csv()

    def log_prediction(
        self,
        predicted_disease: str,
        confidence: float,
        risk_score: float,
        risk_level: str,
    ) -> None:
        """Append a prediction record to the analytics CSV."""
        row = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "predicted_disease": predicted_disease,
            "confidence": round(confidence, 4),
            "risk_score": round(risk_score, 4),
            "risk_level": risk_level,
        }
        with open(_CSV_PATH, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=_FIELDS)
            writer.writerow(row)

    @staticmethod
    def get_csv_path() -> str:
        return _CSV_PATH
