from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import pandas as pd
from datetime import datetime
from ml.predict  import predict
from ml.anomaly  import detect_anomaly_server
from ml.fusion   import fuse_decisions
from ml.features import HORIZONS
from config      import settings

app = FastAPI(title="CO2 ML Service", version="1.0.0")

class SensorReading(BaseModel):
    co2_ppm:   float = Field(..., ge=300, le=5000)
    temp_c:    float = Field(..., ge=-10, le=60)
    hum_pct:   float = Field(..., ge=0, le=100)
    timestamp: str   = Field(default_factory=lambda: datetime.utcnow().isoformat())

class PredictRequest(BaseModel):
    readings: list[SensorReading]
    horizons: list[str] | None = None
    version:  str = "latest"

class AnomalyRequest(BaseModel):
    co2_ppm:      float
    temp_c:       float
    hum_pct:      float
    co2_prev:     float
    hour:         int  = Field(..., ge=0, le=23)
    edge_anomaly: bool = False
    version:      str  = "latest"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict")
def predict_co2(req: PredictRequest):
    if len(req.readings) < 3:
        raise HTTPException(422, "Au moins 3 mesures requises")
    df = pd.DataFrame([r.model_dump() for r in req.readings])
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    try:
        preds = predict(df, horizons=req.horizons, version=req.version)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    return {"predictions": preds, "unit": "ppm"}

@app.post("/anomaly")
def detect_anomaly(req: AnomalyRequest):
    result = detect_anomaly_server(
        co2=req.co2_ppm, temp=req.temp_c, hum=req.hum_pct,
        co2_prev=req.co2_prev, hour=req.hour, version=req.version)
    try:
        df_s = pd.DataFrame([{
            "timestamp": datetime.utcnow().isoformat(),
            "co2_ppm": req.co2_ppm, "temp_c": req.temp_c, "hum_pct": req.hum_pct
        }])
        df_s["timestamp"] = pd.to_datetime(df_s["timestamp"], utc=True)
        predicted_1h = predict(df_s, horizons=["1h"], version=req.version).get("1h")
    except Exception:
        predicted_1h = None
    fusion = fuse_decisions(req.co2_ppm, req.edge_anomaly,
                            result["is_anomaly"], result["confidence"], predicted_1h)
    return {"isolation_forest": result, "fusion": fusion, "predicted_1h_ppm": predicted_1h}