
import os
import csv
import io
import requests

from pathlib import Path
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load NASA API key from project root .env
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

API_KEY = os.getenv("NASA_FIRMS_MAP_KEY")

app = Flask(__name__)
CORS(app)

BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# NASA FIRMS satellite sources
SOURCES = [
    ("MODIS_NRT", "MODIS"),
    ("VIIRS_SNPP_NRT", "VIIRS"),
    ("VIIRS_NOAA20_NRT", "VIIRS"),
    ("VIIRS_NOAA21_NRT", "VIIRS")
]

# Global coverage
WORLD_AREA = "world"


@app.route("/")
def home():
    return jsonify({
        "project": "AGNIWATCH",
        "coverage": "Global",
        "status": "running"
    })


@app.route("/api/health")
def health():
    return jsonify({
        "status": "online",
        "api_key_configured": bool(API_KEY),
        "coverage": "Global"
    })


@app.route("/api/fires")
def fires():

    if not API_KEY:
        return jsonify({
            "error": "NASA FIRMS API key missing"
        }), 500

    all_fires = []
    warnings = []

    for source, sensor in SOURCES:

        url = (
            f"{BASE_URL}/{API_KEY}/"
            f"{source}/{WORLD_AREA}/1"
        )

        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()

            reader = csv.DictReader(
                io.StringIO(response.text)
            )

            for row in reader:
                try:
                    all_fires.append({
                        "latitude": float(row["latitude"]),
                        "longitude": float(row["longitude"]),
                        "date": row.get("acq_date", ""),
                        "time": row.get("acq_time", ""),
                        "sensor": sensor,
                        "satellite": row.get("satellite", ""),
                        "confidence": row.get("confidence", ""),
                        "frp": float(row.get("frp") or 0),
                        "source": source
                    })

                except (ValueError, KeyError, TypeError):
                    continue

        except requests.RequestException as error:
            warnings.append(
                f"{source}: {str(error)}"
            )

    return jsonify({
        "region": "Global",
        "total_detections": len(all_fires),
        "fires": all_fires,
        "warnings": warnings,
        "note": (
            "Global satellite hotspot detections. "
            "These are thermal anomalies, not confirmed fire perimeters."
        )
    })
if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
