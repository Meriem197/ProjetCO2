from fastapi import FastAPI, HTTPException
from ml.placement import PlacementEngine
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
"""
Routes à AJOUTER dans main.py
------------------------------
Colle ce bloc APRÈS les routes /predict et /anomaly existantes.
Aucun import supplémentaire hormis PlacementEngine.

Ajoute aussi cette ligne dans les imports en haut de main.py :
    from ml.placement import PlacementEngine
"""

# ══════════════════════════════════════════════════════
# Modèles Pydantic pour le placement
# ══════════════════════════════════════════════════════

class StartSessionRequest(BaseModel):
    position_id: str = Field(..., description="Ex: 'coin_fenetre', 'bureau_centre'")
    description: str = Field(default="", description="Description libre de la position")

class MeasurementRequest(BaseModel):
    position_id: str
    co2_ppm:     float = Field(..., ge=300, le=5000)
    temp_c:      float = Field(..., ge=-10, le=60)
    hum_pct:     float = Field(..., ge=0,   le=100)
    hour:        int   = Field(..., ge=0,   le=23)
    co2_prev:    float = Field(default=None)
    version:     str   = "latest"

class EndSessionRequest(BaseModel):
    position_id: str

class BestPositionRequest(BaseModel):
    method: str = Field(default="borda", description="'borda' ou 'weighted'")


# ══════════════════════════════════════════════════════
# Routes FastAPI — à coller dans main.py
# ══════════════════════════════════════════════════════

@app.get("/placement/summary")
def placement_summary():
    """
    Retourne la liste de toutes les sessions de placement
    (actives et terminées) avec leurs statistiques.
    """
    engine = PlacementEngine.load()
    return engine.summary()


@app.post("/placement/start")
def placement_start(req: StartSessionRequest):
    """
    Démarre une nouvelle session de mesure pour une position candidate.

    Appeler une fois au début de chaque période de test d'une position.
    Ex : on pose le capteur près de la fenêtre → POST /placement/start
         avec position_id = "coin_fenetre"
    """
    engine = PlacementEngine.load()
    try:
        session = engine.start_session(req.position_id, req.description)
        engine.save()
        return {
            "status":      "started",
            "position_id": session.position_id,
            "started_at":  session.started_at,
        }
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/placement/measure")
def placement_measure(req: MeasurementRequest):
    """
    Enregistre une nouvelle mesure pour la session active.

    À appeler à chaque nouvelle donnée du capteur pendant la session.
    Calcule automatiquement :
      - l'erreur de prédiction XGBoost (horizon 10min)
      - si Isolation Forest détecte une anomalie
    """
    engine = PlacementEngine.load()
    try:
        result = engine.add_measurement(
            position_id=req.position_id,
            co2=req.co2_ppm, temp=req.temp_c, hum=req.hum_pct,
            hour=req.hour, co2_prev=req.co2_prev, version=req.version
        )
        engine.save()
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/placement/end")
def placement_end(req: EndSessionRequest):
    """
    Termine la session active pour une position.

    Appeler une fois quand on déplace le capteur vers la prochaine position.
    Retourne les statistiques finales de la session.
    """
    engine = PlacementEngine.load()
    try:
        session = engine.end_session(req.position_id)
        engine.save()
        return {
            "status":       "ended",
            "position_id":  session.position_id,
            "ended_at":     session.ended_at,
            "n_points":     session.n_points,
            "mae_ppm":      round(session.mae, 2),
            "co2_std_ppm":  round(session.co2_std, 2),
            "co2_mean_ppm": round(session.co2_mean, 1),
            "anomaly_rate_pct": round(session.anomaly_rate * 100, 1),
        }
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/placement/best")
def placement_best(req: BestPositionRequest):
    """
    Calcule et retourne la meilleure position parmi les sessions terminées.

    method = "borda"    → recommandé (robuste, multi-critères)
    method = "weighted" → score pondéré simple (plus rapide à expliquer)

    Retourne le classement complet de toutes les positions.
    """
    engine = PlacementEngine.load()
    try:
        result = engine.best_position(method=req.method)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))