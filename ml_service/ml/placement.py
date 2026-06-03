"""
ml/placement.py
---------------
Placement intelligent du capteur CO2.

Logique :
  1. Pour chaque position candidate P_i, on enregistre une session de mesures
     pendant une durée configurable (ex : 2h à quelques jours).
  2. À chaque nouvelle mesure on calcule :
       - l'erreur de prédiction XGBoost (MAE instantanée)
       - si Isolation Forest considère le point comme anomalie
  3. Après la session on calcule un score global pour P_i (plus bas = meilleur).
  4. Après ~5 positions on choisit la meilleure via :
       - score pondéré  (rapide, interprétable)
       - Borda count    (robuste, multi-critères)
  5. Une route FastAPI /placement/* permet de piloter tout ça depuis le frontend.

Intégration dans ton projet :
  - Importe predict()  depuis ml.predict  (déjà fait)
  - Importe detect_anomaly_server() depuis ml.anomaly  (déjà fait)
  - Sauvegarde les sessions dans  models/placement_sessions.json
  - Aucune dépendance nouvelle : pandas, numpy, pathlib déjà utilisés
"""

import json
import numpy as np
import pandas as pd
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from config import settings
from ml.predict import predict
from ml.anomaly import detect_anomaly_server

# ──────────────────────────────────────────────
# Fichier de persistance des sessions
# ──────────────────────────────────────────────
SESSIONS_FILE = settings.models_dir / "placement_sessions.json"


# ══════════════════════════════════════════════
# 1. Structure de données : une session = une position
# ══════════════════════════════════════════════

@dataclass
class PlacementSession:
    """
    Représente toutes les mesures faites pour une position candidate.

    Attributs
    ---------
    position_id   : identifiant libre  ex. "coin_fenetre", "bureau_centre"
    description   : texte libre pour le rapport final
    started_at    : horodatage ISO du début de la session
    co2_values    : liste des valeurs CO2 mesurées (ppm)
    temp_values   : liste des températures (°C)
    hum_values    : liste des humidités (%)
    xgb_errors    : |co2_reel - co2_predit_10min| pour chaque point
    anomaly_flags : True si Isolation Forest détecte une anomalie
    timestamps    : horodatages de chaque mesure
    ended_at      : horodatage ISO de fin (None = session en cours)
    """
    position_id:   str
    description:   str  = ""
    started_at:    str  = field(default_factory=lambda: datetime.utcnow().isoformat())
    co2_values:    List[float] = field(default_factory=list)
    temp_values:   List[float] = field(default_factory=list)
    hum_values:    List[float] = field(default_factory=list)
    xgb_errors:    List[float] = field(default_factory=list)
    anomaly_flags: List[bool]  = field(default_factory=list)
    timestamps:    List[str]   = field(default_factory=list)
    ended_at:      Optional[str] = None

    # ── métriques calculées ──────────────────

    @property
    def n_points(self) -> int:
        return len(self.co2_values)

    @property
    def mae(self) -> float:
        """Erreur moyenne de prédiction XGBoost — plus bas = position prédictible."""
        return float(np.mean(self.xgb_errors)) if self.xgb_errors else 9999.0

    @property
    def co2_std(self) -> float:
        """Écart-type du CO2 — plus bas = position stable."""
        return float(np.std(self.co2_values)) if self.co2_values else 9999.0

    @property
    def co2_mean(self) -> float:
        return float(np.mean(self.co2_values)) if self.co2_values else 0.0

    @property
    def anomaly_rate(self) -> float:
        """Part de mesures anormales détectées par IF (0.0 – 1.0)."""
        return float(np.mean(self.anomaly_flags)) if self.anomaly_flags else 0.0

    def weighted_score(self,
                       w_mae: float = 0.40,
                       w_std: float = 0.30,
                       w_ano: float = 0.30) -> float:
        """
        Score pondéré global (plus bas = meilleur emplacement).

        Les trois critères sont normalisés sur des plages typiques :
          - MAE  normalisée sur [0, 200] ppm
          - std  normalisée sur [0, 150] ppm
          - taux d'anomalies déjà dans [0, 1]
        """
        mae_norm = min(self.mae / 200.0, 1.0)
        std_norm = min(self.co2_std / 150.0, 1.0)
        ano_norm = self.anomaly_rate
        return w_mae * mae_norm + w_std * std_norm + w_ano * ano_norm

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "PlacementSession":
        return cls(**d)


# ══════════════════════════════════════════════
# 2. Moteur de placement
# ══════════════════════════════════════════════

class PlacementEngine:
    """
    Gère toutes les sessions de placement.

    Utilisation typique (depuis l'API) :
    -------------------------------------
    engine = PlacementEngine.load()

    # Démarrer une nouvelle session
    engine.start_session("coin_fenetre", "Près de la fenêtre nord")
    engine.save()

    # Ajouter une mesure (appelé à chaque nouvelle donnée capteur)
    engine.add_measurement("coin_fenetre", co2=850, temp=22.1, hum=45, hour=14)
    engine.save()

    # Terminer la session
    engine.end_session("coin_fenetre")
    engine.save()

    # Choisir la meilleure position
    result = engine.best_position(method="borda")
    print(result)
    """

    def __init__(self):
        self.sessions: List[PlacementSession] = []

    # ── persistance ─────────────────────────

    def save(self):
        SESSIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SESSIONS_FILE, "w") as f:
            json.dump([s.to_dict() for s in self.sessions], f, indent=2)

    @classmethod
    def load(cls) -> "PlacementEngine":
        engine = cls()
        if SESSIONS_FILE.exists():
            with open(SESSIONS_FILE) as f:
                engine.sessions = [PlacementSession.from_dict(d) for d in json.load(f)]
        return engine

    # ── gestion des sessions ─────────────────

    def start_session(self, position_id: str, description: str = "") -> PlacementSession:
        """Démarre une nouvelle session pour une position donnée."""
        # On ne permet pas deux sessions actives pour le même emplacement
        existing = self._get_session(position_id)
        if existing and existing.ended_at is None:
            raise ValueError(f"Session active déjà ouverte pour '{position_id}'. "
                             "Terminez-la avant d'en ouvrir une nouvelle.")
        session = PlacementSession(position_id=position_id, description=description)
        self.sessions.append(session)
        return session

    def end_session(self, position_id: str) -> PlacementSession:
        """Marque une session comme terminée."""
        session = self._get_active_session(position_id)
        session.ended_at = datetime.utcnow().isoformat()
        return session

    def _get_session(self, position_id: str) -> Optional[PlacementSession]:
        """Retourne la dernière session pour un position_id (active ou terminée)."""
        matches = [s for s in self.sessions if s.position_id == position_id]
        return matches[-1] if matches else None

    def _get_active_session(self, position_id: str) -> PlacementSession:
        session = self._get_session(position_id)
        if session is None:
            raise ValueError(f"Aucune session trouvée pour '{position_id}'.")
        if session.ended_at is not None:
            raise ValueError(f"La session '{position_id}' est déjà terminée.")
        return session

    # ── ajout d'une mesure ───────────────────

    def add_measurement(self,
                        position_id: str,
                        co2: float,
                        temp: float,
                        hum: float,
                        hour: int,
                        co2_prev: float = None,
                        version: str = "latest") -> dict:
        """
        Enregistre une nouvelle mesure pour la session active de position_id.

        - Appelle predict() pour obtenir la prédiction XGBoost à 10 min
        - Appelle detect_anomaly_server() pour Isolation Forest
        - Met à jour les listes de la session

        Retourne un dict avec les résultats instantanés.
        """
        session = self._get_active_session(position_id)

        # ── prédiction XGBoost ──
        co2_pred_10min = None
        xgb_error = None
        try:
            # On construit un mini-DataFrame avec le point courant
            # (predict() a besoin d'au moins 1 ligne avec timestamp)
            mini_df = pd.DataFrame([{
                "timestamp": datetime.utcnow().isoformat(),
                "co2_ppm":  co2,
                "temp_c":   temp,
                "hum_pct":  hum,
            }])
            mini_df["timestamp"] = pd.to_datetime(mini_df["timestamp"], utc=True)
            preds = predict(mini_df, horizons=["10min"], version=version)
            co2_pred_10min = preds.get("10min")
            if co2_pred_10min is not None:
                xgb_error = abs(co2 - co2_pred_10min)
        except Exception:
            # Si le modèle n'est pas disponible on continue sans erreur XGBoost
            pass

        # ── Isolation Forest ──
        co2_prev_val = co2_prev if co2_prev is not None else co2
        try:
            if_result = detect_anomaly_server(
                co2=co2, temp=temp, hum=hum,
                co2_prev=co2_prev_val, hour=hour, version=version
            )
            is_anomaly = if_result["is_anomaly"]
        except Exception:
            is_anomaly = False
            if_result = {}

        # ── mise à jour session ──
        session.co2_values.append(co2)
        session.temp_values.append(temp)
        session.hum_values.append(hum)
        session.timestamps.append(datetime.utcnow().isoformat())
        session.anomaly_flags.append(is_anomaly)
        if xgb_error is not None:
            session.xgb_errors.append(xgb_error)

        return {
            "position_id":     position_id,
            "co2_ppm":         co2,
            "co2_pred_10min":  co2_pred_10min,
            "xgb_error":       xgb_error,
            "is_anomaly":      is_anomaly,
            "if_score":        if_result.get("score"),
            "session_n_points": session.n_points,
        }

    # ── sélection de la meilleure position ───

    def completed_sessions(self) -> List[PlacementSession]:
        """Retourne uniquement les sessions terminées."""
        return [s for s in self.sessions if s.ended_at is not None]

    def best_position(self, method: str = "borda") -> dict:
        """
        Choisit la meilleure position parmi les sessions terminées.

        method = "weighted"  → score pondéré simple (MAE + std + anomaly_rate)
        method = "borda"     → Borda count sur les 3 critères séparément
                               (plus robuste, recommandé pour le rapport PFE)

        Retourne un dict complet avec le classement de toutes les positions.
        """
        sessions = self.completed_sessions()
        if not sessions:
            raise ValueError("Aucune session terminée disponible pour le classement.")
        if len(sessions) == 1:
            best = sessions[0]
            return self._format_result(sessions, best, method="seule_session")

        if method == "weighted":
            best = min(sessions, key=lambda s: s.weighted_score())

        elif method == "borda":
            # Pour chaque critère on classe les positions (rang 0 = meilleur)
            # puis on additionne les rangs → le plus petit total gagne
            n = len(sessions)
            borda_scores = np.zeros(n)

            for criterion in ["mae", "co2_std", "anomaly_rate"]:
                values = [getattr(s, criterion) for s in sessions]
                # argsort donne les indices triés du plus petit au plus grand
                ranks = np.argsort(np.argsort(values))
                borda_scores += ranks

            best = sessions[int(np.argmin(borda_scores))]

        else:
            raise ValueError(f"Méthode inconnue : '{method}'. Utiliser 'weighted' ou 'borda'.")

        return self._format_result(sessions, best, method)

    def _format_result(self,
                       sessions: List[PlacementSession],
                       best: PlacementSession,
                       method: str) -> dict:
        """Formate le résultat final du classement."""
        ranking = sorted(sessions, key=lambda s: s.weighted_score())
        return {
            "best_position": {
                "position_id":   best.position_id,
                "description":   best.description,
                "mae_ppm":       round(best.mae, 2),
                "co2_std_ppm":   round(best.co2_std, 2),
                "co2_mean_ppm":  round(best.co2_mean, 1),
                "anomaly_rate_pct": round(best.anomaly_rate * 100, 1),
                "n_points":      best.n_points,
                "weighted_score": round(best.weighted_score(), 4),
            },
            "method_used": method,
            "n_positions_compared": len(sessions),
            "ranking": [
                {
                    "rank":           i + 1,
                    "position_id":    s.position_id,
                    "description":    s.description,
                    "mae_ppm":        round(s.mae, 2),
                    "co2_std_ppm":    round(s.co2_std, 2),
                    "co2_mean_ppm":   round(s.co2_mean, 1),
                    "anomaly_rate_pct": round(s.anomaly_rate * 100, 1),
                    "n_points":       s.n_points,
                    "weighted_score": round(s.weighted_score(), 4),
                }
                for i, s in enumerate(ranking)
            ],
        }

    # ── résumé pour l'API ────────────────────

    def summary(self) -> dict:
        """Vue d'ensemble de toutes les sessions (actives + terminées)."""
        active    = [s for s in self.sessions if s.ended_at is None]
        completed = self.completed_sessions()
        return {
            "total_sessions":    len(self.sessions),
            "active_sessions":   [s.position_id for s in active],
            "completed_sessions": len(completed),
            "positions": [
                {
                    "position_id":  s.position_id,
                    "description":  s.description,
                    "status":       "active" if s.ended_at is None else "completed",
                    "n_points":     s.n_points,
                    "co2_mean_ppm": round(s.co2_mean, 1),
                    "mae_ppm":      round(s.mae, 2),
                    "anomaly_rate_pct": round(s.anomaly_rate * 100, 1),
                    "started_at":   s.started_at,
                    "ended_at":     s.ended_at,
                }
                for s in self.sessions
            ],
        }