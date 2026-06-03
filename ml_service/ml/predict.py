import json, joblib
import pandas as pd
from config import settings
from ml.features import build_features, HORIZONS

_cache = {}

def _load(version="latest"):
    if version in _cache:
        return _cache[version]
    d = settings.models_dir / version
    if not d.exists():
        raise FileNotFoundError(f"Modele introuvable: {d}")
    with open(d / "features.json") as f:
        features = json.load(f)
    pipes = {h: joblib.load(d / f"xgb_{h}.pkl") for h in HORIZONS if (d / f"xgb_{h}.pkl").exists()}
    _cache[version] = {"pipes": pipes, "features": features}
    return _cache[version]

def predict(recent_df: pd.DataFrame, horizons=None, version="latest") -> dict:
    if horizons is None:
        horizons = list(HORIZONS.keys())
    loaded = _load(version)
    df_feat = build_features(recent_df.copy())
    last_row = df_feat.iloc[[-1]]
    X = last_row[[f for f in loaded["features"] if f in last_row.columns]]
    results = {}
    for h in horizons:
        if h in loaded["pipes"]:
            val = float(loaded["pipes"][h].predict(X)[0])
            results[h] = round(max(400.0, min(5000.0, val)), 1)
    return results