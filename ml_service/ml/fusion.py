from enum import Enum

class AlertLevel(str, Enum):
    OK       = "ok"
    WATCH    = "watch"
    WARNING  = "warning"
    CRITICAL = "critical"

def fuse_decisions(co2_ppm, edge_anomaly, server_anomaly, server_confidence, predicted_1h=None) -> dict:
    reasons = []
    if co2_ppm >= 1500:
        reasons.append(f"CO2 critique ({co2_ppm:.0f} ppm)")
    elif co2_ppm >= 1000:
        reasons.append(f"CO2 eleve ({co2_ppm:.0f} ppm)")
    if predicted_1h is not None and predicted_1h >= 1000 and co2_ppm < 1000:
        reasons.append(f"Prediction +1h depasse 1000 ppm ({predicted_1h:.0f})")
    anomaly_sources = []
    if edge_anomaly:
        anomaly_sources.append("edge_zscore")
    if server_anomaly and server_confidence in ("medium", "high"):
        anomaly_sources.append(f"server_IF_{server_confidence}")
    if co2_ppm >= 1500 or len(anomaly_sources) >= 2:
        level = AlertLevel.CRITICAL
    elif co2_ppm >= 1000 or (len(anomaly_sources) == 1 and server_confidence == "high"):
        level = AlertLevel.WARNING
    elif anomaly_sources or (predicted_1h is not None and predicted_1h >= 1000):
        level = AlertLevel.WATCH
    else:
        level = AlertLevel.OK
    return {
        "alert_level":     level,
        "reasons":         reasons,
        "anomaly_sources": anomaly_sources,
        "co2_ppm":         co2_ppm,
        "predicted_1h":    predicted_1h
    }