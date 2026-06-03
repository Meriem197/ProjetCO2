import json, joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from config import settings
from data.loader import load_training_data
from ml.features import build_features

IF_FEATURES = ["co2_ppm", "temp_c", "hum_pct", "co2_diff_1", "heure_sin", "heure_cos"]
_cache = {}

def train_isolation_forest(version: str):
    df = load_training_data(days=180)
    df = build_features(df)
    present = [f for f in IF_FEATURES if f in df.columns]
    df = df.dropna(subset=present).reset_index(drop=True)
    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("model",  IsolationForest(n_estimators=200, contamination=0.02, random_state=42, n_jobs=-1)),
    ])
    pipe.fit(df[present])
    save_dir = settings.models_dir / version
    save_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, save_dir / "iso_forest.pkl")
    with open(save_dir / "if_features.json", "w") as f:
        json.dump(present, f)
    print(f"Isolation Forest sauvegarde -> models/{version}/")

def detect_anomaly_server(co2, temp, hum, co2_prev, hour, version="latest") -> dict:
    if version not in _cache:
        d = settings.models_dir / version
        _cache[version] = {
            "pipe":     joblib.load(d / "iso_forest.pkl"),
            "features": json.load(open(d / "if_features.json"))
        }
    pipe     = _cache[version]["pipe"]
    features = _cache[version]["features"]
    row = {
        "co2_ppm":   co2,   "temp_c": temp, "hum_pct": hum,
        "co2_diff_1": co2 - co2_prev,
        "heure_sin": np.sin(2 * np.pi * hour / 24),
        "heure_cos": np.cos(2 * np.pi * hour / 24),
    }
    X     = np.array([[row[f] for f in features if f in row]])
    pred  = pipe.predict(X)[0]
    score = float(pipe.score_samples(X)[0])
    confidence = "high" if score < -0.6 else "medium" if score < -0.4 else "low"
    return {"is_anomaly": pred == -1, "score": round(score, 4), "confidence": confidence}