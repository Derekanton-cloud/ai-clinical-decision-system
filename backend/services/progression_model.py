import numpy as np

# Disease-specific progression profiles (daily risk increment if untreated)
_PROGRESSION_PROFILES = {
    "Pneumonia":         {"rate": 0.018, "acceleration": 0.0008},
    "Tuberculosis":      {"rate": 0.012, "acceleration": 0.0005},
    "COVID-19":          {"rate": 0.022, "acceleration": 0.0010},
    "Lung Cancer":       {"rate": 0.015, "acceleration": 0.0012},
    "Pleural Effusion":  {"rate": 0.010, "acceleration": 0.0004},
    "Normal":            {"rate": 0.001, "acceleration": 0.0000},
    "Uncertain":         {"rate": 0.005, "acceleration": 0.0002},
}

# Standard time points for the progression timeline
_TIMELINE_DAYS = [0, 1, 2, 3, 5, 7, 10, 14]


class ProgressionModel:
    """Simulate how disease severity may progress if untreated."""

    def predict_progression(
        self,
        predicted_disease: str,
        risk_score: float,
    ) -> dict:
        """
        Generate a 14-day disease progression timeline.

        Returns:
            {
                "timeline": {"day0": float, "day1": float, ..., "day14": float},
                "projected_peak": float
            }
        """
        profile = _PROGRESSION_PROFILES.get(
            predicted_disease,
            _PROGRESSION_PROFILES.get(predicted_disease.title(), _PROGRESSION_PROFILES["Uncertain"]),
        )

        rate = profile["rate"]
        accel = profile["acceleration"]

        timeline = {}
        for day in _TIMELINE_DAYS:
            # Quadratic progression: risk + rate*day + accel*day^2
            projected = risk_score + rate * day + accel * (day ** 2)
            timeline[f"day{day}"] = round(float(np.clip(projected, 0.0, 1.0)), 4)

        peak = max(timeline.values())

        return {
            "timeline": timeline,
            "projected_peak": round(peak, 4),
        }
