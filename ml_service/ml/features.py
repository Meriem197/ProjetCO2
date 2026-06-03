import pandas as pd
import numpy as np

HORIZONS = {
    "10min":  2,
    "1h":    12,
    "6h":    72,
    "24h":  288,
}

FEATURE_COLS = [
    "co2_ppm", "temp_c", "hum_pct",
    "heure_sin", "heure_cos", "jour_sin", "jour_cos",
    "est_weekend",
    "co2_lag_1", "co2_lag_2", "co2_lag_3",
    "co2_lag_6", "co2_lag_12", "co2_lag_24",
    "co2_roll_mean_12", "co2_roll_std_12", "co2_roll_mean_48",
    "co2_diff_1", "co2_diff_6",
]

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy().sort_values("timestamp").reset_index(drop=True)
    for col in ["co2_ppm", "temp_c", "hum_pct"]:
        if col in df.columns:
            df[col] = df[col].interpolate(method="linear", limit=6).ffill().bfill()
    df["heure"]        = df["timestamp"].dt.hour
    df["jour_semaine"] = df["timestamp"].dt.dayofweek
    df["est_weekend"]  = (df["jour_semaine"] >= 5).astype(int)
    df["heure_sin"]    = np.sin(2 * np.pi * df["heure"] / 24)
    df["heure_cos"]    = np.cos(2 * np.pi * df["heure"] / 24)
    df["jour_sin"]     = np.sin(2 * np.pi * df["jour_semaine"] / 7)
    df["jour_cos"]     = np.cos(2 * np.pi * df["jour_semaine"] / 7)
    for lag in [1, 2, 3, 6, 12, 24]:
        df[f"co2_lag_{lag}"] = df["co2_ppm"].shift(lag)
    df["co2_roll_mean_12"] = df["co2_ppm"].rolling(12, min_periods=3).mean()
    df["co2_roll_std_12"]  = df["co2_ppm"].rolling(12, min_periods=3).std()
    df["co2_roll_mean_48"] = df["co2_ppm"].rolling(48, min_periods=6).mean()
    df["co2_diff_1"] = df["co2_ppm"].diff(1)
    df["co2_diff_6"] = df["co2_ppm"].diff(6)
    return df

def build_targets(df: pd.DataFrame) -> pd.DataFrame:
    for label, steps in HORIZONS.items():
        df[f"target_{label}"] = df["co2_ppm"].shift(-steps)
    return df

def get_feature_cols(df: pd.DataFrame) -> list:
    return [c for c in FEATURE_COLS if c in df.columns]