"""
Seeder CO2 v2 — Données simulées réalistes
1 seul capteur physique (SCD30 + GPS NEO-6M)
Comparaison de positions : le capteur est déplacé dans 4 zones successivement
Remplit : MySQL (toutes les tables utiles) + InfluxDB
"""
from __future__ import annotations

import hashlib
import logging
import math
import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum

import mysql.connector
from dotenv import load_dotenv
from faker import Faker
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger(__name__)
fake = Faker("fr_FR")

# ─────────────────────────────────────────────────────────────
# PARAMÈTRES DE SIMULATION — modifier ici selon tes besoins
# ─────────────────────────────────────────────────────────────
SIMULATION_DAYS    = 180    # durée totale simulée (6 mois)
INTERVAL_SECONDS   = 30     # fréquence de mesure SCD30 (30s)
SIMULATION_DAYS = 7   # points par lot InfluxDB

# Seuils CO2 — norme OMS + usage industriel tunisien
SEUIL_BON       = 800    # ppm  → qualité bonne
SEUIL_ATTENTION = 1000   # ppm  → dégradée, action recommandée
SEUIL_CRITIQUE  = 1500   # ppm  → évacuation recommandée
CO2_EXTERIEUR   = 420    # ppm  → référence air extérieur

# ─────────────────────────────────────────────────────────────
# POSITIONS DE TEST DU CAPTEUR
# Le même capteur physique est placé successivement dans
# chaque zone pendant POSITION_DURATION_DAYS jours.
# Cela correspond à la table positioning_positions de MySQL.
# ─────────────────────────────────────────────────────────────
POSITION_DURATION_DAYS = 30   # durée par position (30j × 4 positions = 120j sur 180)

POSITIONS = [
    {
        "id":          "POS-A",
        "name":        "Coin fenêtre nord",
        "zone":        "Zone A — Fenêtre",
        # Coordonnées GPS réelles du site Tunis (simulées dans la salle)
        # Le NEO-6M donne la position GPS fixe de l'installation
        "latitude":    36.806500,
        "longitude":   10.181500,
        # Position cartographique dans le plan de salle (mètres)
        "position_x":  2.5,
        "position_y":  1.0,
        "floor":       1,
        # Caractéristiques physiques de cette position
        "co2_offset":       -80,   # près fenêtre → CO2 plus bas
        "ventilation_bonus": 0.20,  # 20% de ventilation naturelle en plus
        "description": "Près de la fenêtre nord, bonne ventilation naturelle",
    },
    {
        "id":          "POS-B",
        "name":        "Centre salle",
        "zone":        "Zone B — Centre",
        "latitude":    36.806480,
        "longitude":   10.181520,
        "position_x":  5.0,
        "position_y":  4.0,
        "floor":       1,
        "co2_offset":       +50,
        "ventilation_bonus": 0.0,
        "description": "Centre de la salle, ventilation moyenne",
    },
    {
        "id":          "POS-C",
        "name":        "Couloir entrée",
        "zone":        "Zone C — Entrée",
        "latitude":    36.806460,
        "longitude":   10.181540,
        "position_x":  1.0,
        "position_y":  7.5,
        "floor":       1,
        "co2_offset":       -30,
        "ventilation_bonus": 0.10,
        "description": "Près de la porte d'entrée, renouvellement d'air fréquent",
    },
    {
        "id":          "POS-D",
        "name":        "Coin opposé fenêtre",
        "zone":        "Zone D — Angle mort",
        "latitude":    36.806440,
        "longitude":   10.181560,
        "position_x":  9.0,
        "position_y":  7.0,
        "floor":       1,
        "co2_offset":       +130,
        "ventilation_bonus": -0.15,  # coin mort, ventilation réduite
        "description": "Angle mort, mauvaise circulation d'air",
    },
]


class AnomalyType(Enum):
    NONE         = "none"
    SPIKE        = "spike"
    SENSOR_DRIFT = "sensor_drift"
    VENTILATION  = "ventilation_failure"
    WINDOW_OPEN  = "window_open"


@dataclass
class AppConfig:
    mysql_host: str
    mysql_port: int
    mysql_user: str
    mysql_password: str
    mysql_database: str
    influx_url: str
    influx_token: str
    influx_org: str
    influx_bucket: str

    @classmethod
    def from_env(cls, env_file: str = ".env") -> "AppConfig":
        load_dotenv(env_file)
        required = [
            "MYSQL_HOST", "MYSQL_PORT", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE",
            "INFLUX_URL", "INFLUX_TOKEN", "INFLUX_ORG", "INFLUX_BUCKET",
        ]
        missing = [k for k in required if not os.getenv(k)]
        if missing:
            raise EnvironmentError(f"Variables manquantes : {', '.join(missing)}")
        return cls(
            mysql_host     = os.getenv("MYSQL_HOST", "localhost"),
            mysql_port     = int(os.getenv("MYSQL_PORT", "3306")),
            mysql_user     = os.getenv("MYSQL_USER", "root"),
            mysql_password = os.getenv("MYSQL_PASSWORD", ""),
            mysql_database = os.getenv("MYSQL_DATABASE", "co2_industrial_db"),
            influx_url     = os.getenv("INFLUX_URL", "http://localhost:8086"),
            influx_token   = os.getenv("INFLUX_TOKEN", ""),
            influx_org     = os.getenv("INFLUX_ORG", ""),
            influx_bucket  = os.getenv("INFLUX_BUCKET", "co2_data"),
        )


class MySQLManager:
    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._conn = None

    def __enter__(self):
        self._conn = mysql.connector.connect(
            host      = self._config.mysql_host,
            port      = self._config.mysql_port,
            user      = self._config.mysql_user,
            password  = self._config.mysql_password,
            database  = self._config.mysql_database,
            autocommit= False,
            charset   = "utf8mb4",
        )
        log.info("MySQL connecté")
        return self

    def __exit__(self, *_):
        if self._conn:
            self._conn.close()
            log.info("MySQL fermé")

    def execute(self, sql, params=()):
        cur = self._conn.cursor()
        try:
            cur.execute(sql, params)
            return cur.lastrowid
        finally:
            cur.close()

    def executemany(self, sql, params_list):
        cur = self._conn.cursor()
        try:
            cur.executemany(sql, params_list)
            return cur.rowcount
        finally:
            cur.close()

    def fetchone(self, sql, params=()):
        cur = self._conn.cursor()
        try:
            cur.execute(sql, params)
            return cur.fetchone()
        finally:
            cur.close()

    def commit(self):
        self._conn.commit()


class InfluxManager:
    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._client = None
        self._write_api = None

    def __enter__(self):
        self._client = InfluxDBClient(
            url   = self._config.influx_url,
            token = self._config.influx_token,
            org   = self._config.influx_org,
        )
        self._write_api = self._client.write_api(write_options=SYNCHRONOUS)
        log.info("InfluxDB connecté")
        return self

    def __exit__(self, *_):
        if self._write_api:
            self._write_api.close()
        if self._client:
            self._client.close()
            log.info("InfluxDB fermé")

    def write_batch(self, points):
        if points:
            self._write_api.write(
                bucket = self._config.influx_bucket,
                org    = self._config.influx_org,
                record = points,
            )


# ─────────────────────────────────────────────────────────────
# FONCTIONS DE SIMULATION PHYSIQUE
# ─────────────────────────────────────────────────────────────

def is_working_day(dt: datetime) -> bool:
    return dt.weekday() < 5  # lundi=0 … vendredi=4

def is_ramadan_2025(dt: datetime) -> bool:
    """Ramadan 2025 en Tunisie : ~1er mars au 30 mars."""
    return dt.year == 2025 and dt.month == 3 and 1 <= dt.day <= 30

def get_occupancy(dt: datetime) -> float:
    """Facteur d'occupation [0.0–1.0] selon heure, jour, Ramadan."""
    h = dt.hour + dt.minute / 60.0

    if not is_working_day(dt):
        return random.uniform(0.0, 0.08) if not (9 <= dt.hour <= 11) else random.uniform(0.05, 0.15)

    if is_ramadan_2025(dt):
        # Horaires décalés Ramadan : 8h-14h puis fin
        if 8 <= h < 13:   return random.uniform(0.6, 0.9)
        if 13 <= h < 14:  return random.uniform(0.2, 0.5)
        return 0.0

    # Journée ouvrable normale
    if h < 7.5:           return 0.0
    elif h < 8.0:         return random.uniform(0.1, 0.3)
    elif h < 9.0:         return random.uniform(0.4, 0.75)
    elif h < 12.0:        return random.uniform(0.8, 1.0)
    elif h < 13.0:        return random.uniform(0.25, 0.55)
    elif h < 14.0:        return random.uniform(0.1, 0.3)
    elif h < 16.5:        return random.uniform(0.75, 1.0)
    elif h < 17.5:        return random.uniform(0.3, 0.6)
    elif h < 18.0:        return random.uniform(0.05, 0.2)
    else:                 return 0.0

def get_ventilation(dt: datetime) -> float:
    """Efficacité ventilation mécanique [0.0–1.0]."""
    h = dt.hour
    if not is_working_day(dt):
        return random.uniform(0.15, 0.35)
    if 7 <= h <= 19:   return random.uniform(0.65, 1.0)
    if 19 < h <= 21:   return random.uniform(0.35, 0.55)
    return random.uniform(0.1, 0.25)

def simulate_gps(base_lat: float, base_lon: float) -> tuple[float, float]:
    """
    Simule le bruit GPS du module NEO-6M en intérieur.
    Précision typique en intérieur : ±5 à 15 mètres
    1 degré latitude ≈ 111 000 m → 10m ≈ 0.00009°
    """
    noise_lat = random.gauss(0, 0.00008)
    noise_lon = random.gauss(0, 0.00008)
    return round(base_lat + noise_lat, 7), round(base_lon + noise_lon, 7)

def simulate_temperature(dt: datetime) -> float:
    """
    Température intérieure simulée (°C).
    Varie selon la saison (été chaud en Tunisie) et l'heure.
    """
    month = dt.month
    hour  = dt.hour
    # Température de base mensuelle (Tunisie intérieur)
    monthly_base = {1: 18, 2: 19, 3: 21, 4: 23, 5: 26, 6: 29,
                    7: 32, 8: 31, 9: 28, 10: 24, 11: 21, 12: 18}
    base = monthly_base.get(month, 22)
    # Variation circadienne (plus chaud l'après-midi)
    circadian = 3.0 * math.sin(math.pi * (hour - 6) / 14) if 6 <= hour <= 20 else -1.5
    noise = random.gauss(0, 0.4)
    return round(base + circadian + noise, 2)

def simulate_humidity(dt: datetime, temperature: float) -> float:
    """
    Humidité relative simulée (%).
    Corrélée négativement avec la température (physique réelle).
    """
    month = dt.month
    monthly_base = {1: 72, 2: 70, 3: 65, 4: 62, 5: 58, 6: 52,
                    7: 48, 8: 50, 9: 56, 10: 63, 11: 68, 12: 73}
    base = monthly_base.get(month, 62)
    # Correction température : +1°C → -1.5% humidité
    temp_correction = -(temperature - 22) * 1.5
    noise = random.gauss(0, 2.0)
    return round(max(20.0, min(95.0, base + temp_correction + noise)), 2)

def compute_co2(
    dt: datetime,
    position: dict,
    prev_value: float | None = None,
) -> tuple[float, float, float, AnomalyType]:
    """
    Calcule CO2, température, humidité pour un instant donné.

    Modèle CO2 :
      CO2 = CO2_extérieur
          + contribution_humaine × (1 - efficacité_ventilation)
          + variation_circadienne
          + offset_position
          + bruit_capteur_SCD30
          + inertie_thermique

    Retourne (co2_ppm, temperature_c, humidity_pct, anomaly_type)
    """
    occupancy   = get_occupancy(dt)
    ventilation = get_ventilation(dt) + position["ventilation_bonus"]
    ventilation = max(0.0, min(1.0, ventilation))

    # Contribution humaine : pleine occupation ≈ +800 ppm sans ventilation
    human_co2 = occupancy * 800 * (1.0 - ventilation * 0.65)

    # Variation circadienne légère (effet température sur solubilité CO2)
    h = dt.hour
    circadian = 25 * math.sin(math.pi * (h - 6) / 12) if 6 <= h <= 18 else 0

    base = CO2_EXTERIEUR + human_co2 + circadian + position["co2_offset"]
    base = max(CO2_EXTERIEUR - 10, base)

    # Inertie temporelle (le CO2 monte/descend progressivement, pas en saut)
    if prev_value is not None:
        alpha = 0.12   # constante de lissage exponentiel
        base  = alpha * base + (1 - alpha) * prev_value

    # Bruit de mesure SCD30 : ±(30 ppm + 3% de la valeur mesurée)
    noise = random.gauss(0, 12) + base * random.uniform(-0.015, 0.015)
    value = base + noise

    # ── Injection d'anomalies réalistes ──────────────────────
    anomaly = AnomalyType.NONE

    roll = random.random()
    if roll < 0.004:
        # Pic soudain (réunion imprévue, incident ponctuel)
        value  += random.uniform(350, 800)
        anomaly = AnomalyType.SPIKE

    elif roll < 0.006:
        # Panne ventilation : CO2 s'accumule
        value  *= random.uniform(1.35, 1.75)
        anomaly = AnomalyType.VENTILATION

    elif roll < 0.007:
        # Dérive capteur SCD30 (mesures trop basses — recalibrage requis)
        value  *= random.uniform(0.45, 0.65)
        anomaly = AnomalyType.SENSOR_DRIFT

    elif not is_working_day(dt) and roll < 0.025:
        # Fenêtre ouverte le weekend : CO2 chute vers extérieur
        value   = random.uniform(CO2_EXTERIEUR, CO2_EXTERIEUR + 70)
        anomaly = AnomalyType.WINDOW_OPEN

    value = round(max(CO2_EXTERIEUR - 20, min(value, 5000)), 1)

    temperature = simulate_temperature(dt)
    humidity    = simulate_humidity(dt, temperature)

    return value, temperature, humidity, anomaly


# ─────────────────────────────────────────────────────────────
# SEEDER PRINCIPAL
# ─────────────────────────────────────────────────────────────

class Seeder:
    def __init__(self, db: MySQLManager, inf: InfluxManager) -> None:
        self.db         = db
        self.inf        = inf
        self.company_id = None
        self.site_id    = None
        self.sensor_uid = "SENSOR-SCD30-001"   # 1 seul capteur physique
        self.sensor_id  = None
        self.position_db_ids: dict[str, int] = {}   # POS-A → id MySQL

    def _hash(self, raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    # ── Rôles ────────────────────────────────────────────────
    def seed_roles(self) -> dict[str, int]:
        roles = {"ADMIN": "Administrateur", "CLIENT": "Client", "TECHNICIAN": "Technicien"}
        ids   = {}
        for code, name in roles.items():
            self.db.execute(
                "INSERT INTO roles (code, name, description, is_system_role) VALUES (%s,%s,%s,1) "
                "ON DUPLICATE KEY UPDATE name=VALUES(name)",
                (code, name, f"Rôle {name}"),
            )
            ids[code] = int(self.db.fetchone("SELECT id FROM roles WHERE code=%s", (code,))[0])
        return ids

    # ── Entreprise ───────────────────────────────────────────
    def seed_company(self) -> int:
        key = "techvent"
        self.db.execute(
            "INSERT INTO companies (tenant_key,legal_name,display_name,status,timezone,created_at,updated_at) "
            "VALUES (%s,%s,%s,'ACTIVE','Africa/Tunis',NOW(),NOW()) "
            "ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),updated_at=NOW()",
            (key, "TechVent Industries", "TechVent"),
        )
        return int(self.db.fetchone("SELECT id FROM companies WHERE tenant_key=%s", (key,))[0])

    # ── Paramètres entreprise (seuils CO2 + config IA) ───────
    def seed_company_settings(self) -> None:
        self.db.execute(
            "INSERT INTO company_settings "
            "(company_id, limit_good, limit_warning, limit_critical, ai_model, "
            " horizon_minutes, sampling_interval_seconds, created_at, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW()) "
            "ON DUPLICATE KEY UPDATE updated_at=NOW()",
            (self.company_id, SEUIL_BON, SEUIL_ATTENTION, SEUIL_CRITIQUE,
             "prophet",   # modèle IA actif
             60,          # horizon de prédiction par défaut : 1h
             INTERVAL_SECONDS),
        )

    # ── Utilisateurs ─────────────────────────────────────────
    def seed_users(self, role_ids: dict[str, int]) -> None:
        users = [
            ("admin@techvent.local",  "Admin TechVent",  True,  "ADMIN"),
            ("client@techvent.local", "Client TechVent", False, "CLIENT"),
            ("tech@techvent.local",   "Tech TechVent",   False, "TECHNICIAN"),
        ]
        for email, name, is_admin, role_code in users:
            self.db.execute(
                "INSERT INTO users (email,password_hash,name,is_platform_admin,created_at,updated_at) "
                "VALUES (%s,%s,%s,%s,NOW(),NOW()) "
                "ON DUPLICATE KEY UPDATE name=VALUES(name),updated_at=NOW()",
                (email, self._hash("Temp@1234!"), name, 1 if is_admin else 0),
            )
            uid = int(self.db.fetchone("SELECT id FROM users WHERE email=%s", (email,))[0])
            self.db.execute(
                "INSERT INTO company_users (company_id,user_id,membership_status,joined_at,created_at,updated_at) "
                "VALUES (%s,%s,'ACTIVE',NOW(),NOW(),NOW()) "
                "ON DUPLICATE KEY UPDATE membership_status='ACTIVE',updated_at=NOW()",
                (self.company_id, uid),
            )
            cu_id = int(self.db.fetchone(
                "SELECT id FROM company_users WHERE company_id=%s AND user_id=%s",
                (self.company_id, uid))[0])
            self.db.execute(
                "INSERT INTO company_user_roles (company_user_id,role_id,assigned_at) "
                "VALUES (%s,%s,NOW()) ON DUPLICATE KEY UPDATE assigned_at=VALUES(assigned_at)",
                (cu_id, role_ids[role_code]),
            )

    # ── Site + Ligne + Capteur (1 seul) ──────────────────────
    def seed_infrastructure(self) -> None:
        """
        1 site (Tunis) → 1 ligne de production → 1 ESP32 → 1 capteur SCD30+GPS
        """
        # Site
        self.db.execute(
            "INSERT INTO sites (company_id,site_code,name,country_code,city,address_line1,"
            "latitude,longitude,status,timezone,created_at,updated_at) "
            "VALUES (%s,'TN-TUN-01','Site Tunis','TN','Tunis',%s,36.8065,10.1815,'ACTIVE','Africa/Tunis',NOW(),NOW()) "
            "ON DUPLICATE KEY UPDATE name=VALUES(name),updated_at=NOW()",
            (self.company_id, fake.street_address()),
        )
        self.site_id = int(self.db.fetchone(
            "SELECT id FROM sites WHERE company_id=%s AND site_code='TN-TUN-01'",
            (self.company_id,))[0])

        # Ligne de production
        self.db.execute(
            "INSERT INTO production_lines (site_id,line_code,name,status,zone,latitude,longitude,created_at,updated_at) "
            "VALUES (%s,'LINE-01','Ligne Principale','ACTIVE','Zone Principale',36.8065,10.1815,NOW(),NOW()) "
            "ON DUPLICATE KEY UPDATE name=VALUES(name),updated_at=NOW()",
            (self.site_id,),
        )
        line_id = int(self.db.fetchone(
            "SELECT id FROM production_lines WHERE site_id=%s AND line_code='LINE-01'",
            (self.site_id,))[0])

        # ESP32 (1 seul)
        self.db.execute(
            "INSERT INTO edge_devices (production_line_id,device_uid,name,hardware_model,"
            "firmware_version,connectivity_type,status,last_seen_at,latitude,longitude,created_at,updated_at) "
            "VALUES (%s,'DEV-ESP32-001','Gateway Principal','ESP32-WROOM-32',"
            "'v2.1.0','MQTT','ACTIVE',NOW(),36.8065,10.1815,NOW(),NOW()) "
            "ON DUPLICATE KEY UPDATE last_seen_at=NOW(),updated_at=NOW()",
            (line_id,),
        )
        device_id = int(self.db.fetchone(
            "SELECT id FROM edge_devices WHERE device_uid='DEV-ESP32-001'")[0])

        # Capteur SCD30 + GPS NEO-6M (1 seul capteur physique)
        # La position initiale est POS-A (coin fenêtre)
        pos_a = POSITIONS[0]
        self.db.execute(
            "INSERT INTO sensors (edge_device_id,sensor_uid,name,sensor_type,unit_default,"
            "sampling_interval_ms,calibration_offset,calibration_scale,"
            "position_x,position_y,zone,latitude,longitude,floor,"
            "installed_at,status,created_at,updated_at) "
            "VALUES (%s,%s,'Capteur CO2+GPS SCD30','CO2','ppm',"
            "%s,0,1,"
            "%s,%s,%s,%s,%s,%s,"
            "NOW(),'ACTIVE',NOW(),NOW()) "
            "ON DUPLICATE KEY UPDATE zone=VALUES(zone),updated_at=NOW()",
            (device_id, self.sensor_uid,
             INTERVAL_SECONDS * 1000,
             pos_a["position_x"], pos_a["position_y"], pos_a["zone"],
             pos_a["latitude"], pos_a["longitude"], pos_a["floor"]),
        )
        self.sensor_id = int(self.db.fetchone(
            "SELECT id FROM sensors WHERE sensor_uid=%s", (self.sensor_uid,))[0])
        log.info("Capteur unique créé : %s (id=%d)", self.sensor_uid, self.sensor_id)

    # ── Positions (table positioning_positions) ───────────────
    def seed_positions(self, now: datetime) -> None:
        """
        Enregistre les 4 positions de test dans positioning_positions.
        Chaque position correspond à une période de POSITION_DURATION_DAYS jours.
        La position D est marquée comme 'non finale' — c'est l'IA qui choisira la meilleure.
        """
        start = now - timedelta(days=SIMULATION_DAYS)

        for i, pos in enumerate(POSITIONS):
            pos_start = start + timedelta(days=i * POSITION_DURATION_DAYS)
            pos_end   = pos_start + timedelta(days=POSITION_DURATION_DAYS)
            is_final  = 0   # sera mis à 1 par l'IA après analyse
            finalized_at = None

            self.db.execute(
                "INSERT INTO positioning_positions "
                "(company_id,name,zone,duration_minutes,sensor_id,is_final,finalized_at,created_at,updated_at) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "ON DUPLICATE KEY UPDATE zone=VALUES(zone),updated_at=NOW()",
                (
                    self.company_id,
                    pos["name"],
                    pos["zone"],
                    POSITION_DURATION_DAYS * 24 * 60,  # durée en minutes
                    self.sensor_uid,
                    is_final,
                    finalized_at,
                    pos_start.strftime("%Y-%m-%d %H:%M:%S"),
                    pos_end.strftime("%Y-%m-%d %H:%M:%S"),
                ),
            )
            self.position_db_ids[pos["id"]] = int(self.db.fetchone(
                "SELECT id FROM positioning_positions WHERE company_id=%s AND name=%s",
                (self.company_id, pos["name"]))[0])
            log.info("Position %s enregistrée : %s → %s",
                     pos["id"],
                     pos_start.strftime("%Y-%m-%d"),
                     pos_end.strftime("%Y-%m-%d"))

    # ── Politiques de seuils ──────────────────────────────────
    def seed_threshold_policies(self) -> None:
        self.db.execute(
            "INSERT INTO sensor_threshold_policies "
            "(sensor_id,metric,low_threshold,high_threshold,severity_low,severity_high,is_enabled,created_at,updated_at) "
            "VALUES (%s,'CO2',%s,%s,'LOW','CRITICAL',1,NOW(),NOW()) "
            "ON DUPLICATE KEY UPDATE high_threshold=VALUES(high_threshold),updated_at=NOW()",
            (self.sensor_id, SEUIL_BON, SEUIL_CRITIQUE),
        )

    # ── Modèles ML (enregistrement des métadonnées) ───────────
    def seed_ml_models(self) -> None:
        """
        Enregistre les 3 modèles ML qui seront entraînés.
        Les versions seront ajoutées après entraînement réel.
        """
        models = [
            ("arima_co2",    "ARIMA CO2",           "FORECAST"),
            ("prophet_co2",  "Prophet CO2",          "FORECAST"),
            ("iforest_co2",  "Isolation Forest CO2", "ANOMALY"),
        ]
        for key, name, ptype in models:
            self.db.execute(
                "INSERT INTO ml_models (company_id,model_key,name,problem_type,target_metric,is_active,created_at,updated_at) "
                "VALUES (%s,%s,%s,%s,'CO2',0,NOW(),NOW()) "
                "ON DUPLICATE KEY UPDATE name=VALUES(name),updated_at=NOW()",
                (self.company_id, key, name, ptype),
            )

    # ── Données InfluxDB + sensor_measurements MySQL ──────────
    def seed_measurements(self, now: datetime) -> None:
        """
        Génère SIMULATION_DAYS jours de mesures à INTERVAL_SECONDS secondes.

        Chaque mesure est écrite dans :
          1. InfluxDB (co2_readings) — série temporelle principale, tags GPS inclus
          2. MySQL sensor_measurements — échantillon toutes les 5 min pour éviter
             de saturer MySQL (MySQL n'est pas fait pour des millions de lignes à 30s)

        Les tags InfluxDB incluent la position et les coordonnées GPS simulées
        pour permettre la comparaison de positions par l'IA.
        """
        start    = now - timedelta(days=SIMULATION_DAYS)
        interval = timedelta(seconds=INTERVAL_SECONDS)
        pos_dur  = timedelta(days=POSITION_DURATION_DAYS)

        total_points = int(SIMULATION_DAYS * 24 * 3600 / INTERVAL_SECONDS)
        log.info(
            "Génération de %d points (%.1fM) sur %d jours à %ds d'intervalle",
            total_points, total_points / 1_000_000, SIMULATION_DAYS, INTERVAL_SECONDS,
        )

        influx_batch  = []
        mysql_batch   = []   # toutes les 5 min seulement
        prev_co2      = None
        points_done   = 0
        mysql_counter = 0
        MYSQL_SAMPLE_EVERY = int(300 / INTERVAL_SECONDS)  # 1 ligne MySQL / 5 min

        current = start
        while current <= now:
            # Déterminer la position active selon la période
            elapsed_days = (current - start).days
            pos_index    = min(elapsed_days // POSITION_DURATION_DAYS, len(POSITIONS) - 1)
            position     = POSITIONS[pos_index]

            # Simuler GPS du NEO-6M (bruit intérieur)
            gps_lat, gps_lon = simulate_gps(position["latitude"], position["longitude"])

            # Calculer les valeurs physiques
            co2, temp, hum, anomaly = compute_co2(current, position, prev_co2)
            prev_co2 = co2

            # ── InfluxDB : chaque mesure (30s) ────────────────
            p = (
                Point("co2_readings")
                .tag("sensorId",    self.sensor_uid)
                .tag("sensorDbId",  str(self.sensor_id))
                .tag("positionId",  position["id"])
                .tag("posLabel",    position["name"])
                .tag("zone",        position["zone"])
                .tag("anomaly",     anomaly.value)
                .field("co2_ppm",   float(co2))
                .field("temp_c",    float(temp))
                .field("hum_pct",   float(hum))
                .field("gps_lat",   float(gps_lat))
                .field("gps_lon",   float(gps_lon))
                .field("is_anomaly", 1 if anomaly != AnomalyType.NONE else 0)
                .time(current, WritePrecision.S)
            )
            influx_batch.append(p)

            # ── MySQL sensor_measurements : 1 ligne / 5 min ───
            mysql_counter += 1
            if mysql_counter >= MYSQL_SAMPLE_EVERY:
                quality = "SUSPECT" if anomaly == AnomalyType.SENSOR_DRIFT else \
                          "INVALID" if co2 > 4000 else "OK"
                mysql_batch.append((
                    self.sensor_id,
                    current.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                    current.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                    co2, temp, hum,
                    quality,
                    "SIMULATED",
                    f'{{"co2":{co2},"temp":{temp},"hum":{hum},"pos":"{position["id"]}","gps_lat":{gps_lat},"gps_lon":{gps_lon},"anomaly":"{anomaly.value}"}}',
                ))
                mysql_counter = 0

            # Envoi par lots
            if len(influx_batch) >= BATCH_SIZE:
                self.inf.write_batch(influx_batch)
                points_done += len(influx_batch)
                influx_batch = []
                log.info("  InfluxDB : %d / %d points (%.1f%%)",
                         points_done, total_points, 100 * points_done / total_points)

            if len(mysql_batch) >= 500:
                self.db.executemany(
                    "INSERT INTO sensor_measurements "
                    "(sensor_id,measured_at,ingested_at,co2_ppm,temperature_c,humidity_pct,"
                    "quality_flag,source_protocol,raw_payload) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    mysql_batch,
                )
                mysql_batch = []

            current += interval

        # Vider les restes
        if influx_batch:
            self.inf.write_batch(influx_batch)
        if mysql_batch:
            self.db.executemany(
                "INSERT INTO sensor_measurements "
                "(sensor_id,measured_at,ingested_at,co2_ppm,temperature_c,humidity_pct,"
                "quality_flag,source_protocol,raw_payload) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                mysql_batch,
            )
        log.info("✓ Mesures terminées")

    # ── Alertes d'exemple ────────────────────────────────────
    def seed_alerts(self) -> None:
        scenarios = [
            ("THRESHOLD_BREACH", "HIGH",     1280.0, SEUIL_ATTENTION, "Seuil CO2 dépassé — ventilation requise"),
            ("THRESHOLD_BREACH", "CRITICAL", 1720.0, SEUIL_CRITIQUE,  "CO2 critique — évacuation recommandée"),
            ("ANOMALY_DETECTED", "MEDIUM",    490.0, None,            "Dérive capteur SCD30 détectée — recalibrage requis"),
            ("ANOMALY_DETECTED", "HIGH",     1900.0, None,            "Pic CO2 anormal détecté — vérification requise"),
        ]
        for a_type, severity, trig, thresh, msg in scenarios:
            self.db.execute(
                "INSERT INTO alerts (company_id,site_id,sensor_id,alert_type,severity,status,"
                "triggered_at,trigger_value,threshold_value,message,metadata,created_at,updated_at) "
                "VALUES (%s,%s,%s,%s,%s,'OPEN',NOW()-INTERVAL 3 HOUR,%s,%s,%s,"
                "JSON_OBJECT('source','seeder','sensor_uid',%s),NOW(),NOW())",
                (self.company_id, self.site_id, self.sensor_id,
                 a_type, severity, trig, thresh or 0.0, msg, self.sensor_uid),
            )

    # ── Point d'entrée principal ──────────────────────────────
    def run(self) -> None:
        log.info("═══════════════════════════════════════════")
        log.info("  Seeder CO2 v2 — 1 capteur SCD30 + GPS   ")
        log.info("  %d jours | %ds intervalle | %d positions ", SIMULATION_DAYS, INTERVAL_SECONDS, len(POSITIONS))
        log.info("═══════════════════════════════════════════")

        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)

        role_ids = self.seed_roles()
        self.company_id = self.seed_company()
        self.seed_company_settings()
        self.seed_users(role_ids)
        self.seed_infrastructure()
        self.seed_positions(now)
        self.seed_threshold_policies()
        self.seed_ml_models()
        self.db.commit()
        log.info("✓ Infrastructure MySQL validée et committée")

        self.seed_measurements(now)
        self.db.commit()
        log.info("✓ Mesures committées")

        self.seed_alerts()
        self.db.commit()
        log.info("✓ Alertes committées")

        log.info("═══ Seeding terminé avec succès ═══")


# ─────────────────────────────────────────────────────────────
def main() -> None:
    try:
        config = AppConfig.from_env(".env")
    except EnvironmentError as exc:
        log.error(str(exc))
        raise SystemExit(1) from exc

    try:
        with MySQLManager(config) as db, InfluxManager(config) as inf:
            Seeder(db, inf).run()
    except Exception as exc:
        log.exception("Erreur fatale : %s", exc)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()