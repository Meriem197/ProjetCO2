import json, joblib, shutil
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb

from config import settings
from data.loader import load_training_data
from ml.features import build_features, build_targets, get_feature_cols, HORIZONS

def build_pipeline(model_params):
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler",  StandardScaler()),
        ("model",   xgb.XGBRegressor(**model_params)),
    ])

def walk_forward_eval(X, y, model_params, n_splits=5):
    split_size = len(X) // (n_splits + 1)
    maes = []
    for i in range(1, n_splits + 1):
        train_end = i * split_size
        X_tr, y_tr = X.iloc[:train_end], y.iloc[:train_end]
        X_te, y_te = X.iloc[train_end:train_end+split_size], y.iloc[train_end:train_end+split_size]
        pipe = build_pipeline(model_params)
        pipe.fit(X_tr, y_tr)
        maes.append(mean_absolute_error(y_te, pipe.predict(X_te)))
    return np.mean(maes), np.std(maes)

def train_all():
    print("Chargement des donnees...")
    df = load_training_data(days=180)
    print(f"  {len(df):,} lignes chargees")
    df = build_features(df)
    df = build_targets(df)
    df = df.dropna().reset_index(drop=True)
    print(f"  {len(df):,} lignes apres nettoyage")
    FEATURES = get_feature_cols(df)
    X = df[FEATURES]

    xgb_params = dict(
        n_estimators=300, learning_rate=0.05, max_depth=6,
        subsample=0.8, colsample_bytree=0.8, random_state=42, verbosity=0
    )

    models, all_metrics = {}, {}
    for horizon_label in HORIZONS:
        print(f"\nEntrainement horizon {horizon_label}...")
        y = df[f"target_{horizon_label}"]
        mae_cv, mae_std = walk_forward_eval(X, y, xgb_params)
        pipe = build_pipeline(xgb_params)
        pipe.fit(X, y)
        models[horizon_label] = pipe
        y_pred = pipe.predict(X)
        all_metrics[horizon_label] = {
            "mae_cv":    round(float(mae_cv), 2),
            "mae_std":   round(float(mae_std), 2),
            "mae_train": round(float(mean_absolute_error(y, y_pred)), 2),
            "rmse":      round(float(np.sqrt(mean_squared_error(y, y_pred))), 2),
            "r2":        round(float(r2_score(y, y_pred)), 4),
        }
        print(f"  MAE_CV={mae_cv:.1f}+-{mae_std:.1f} ppm | R2={all_metrics[horizon_label]['r2']}")

    version = f"v{datetime.now().strftime('%Y%m%d_%H%M')}"
    save_dir = settings.models_dir / version
    save_dir.mkdir(parents=True, exist_ok=True)

    for horizon_label, pipe in models.items():
        joblib.dump(pipe, save_dir / f"xgb_{horizon_label}.pkl")

    with open(save_dir / "features.json", "w") as f:
        json.dump(FEATURES, f)
    with open(save_dir / "metrics.json", "w") as f:
        json.dump({"version": version, "metrics": all_metrics}, f, indent=2)

    latest = settings.models_dir / "latest"
    if latest.exists():
        shutil.rmtree(latest)
    shutil.copytree(save_dir, latest)

    print(f"\nModeles sauvegardes -> models/{version}/")
    print("Dossier latest mis a jour")
    return version, all_metrics

if __name__ == "__main__":
    train_all()