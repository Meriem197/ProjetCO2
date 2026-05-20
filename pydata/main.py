from __future__ import annotations

import hashlib
import logging
import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import mysql.connector
from dotenv import load_dotenv
from faker import Faker
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger(__name__)
fake = Faker("fr_FR")


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
            raise EnvironmentError(f"Variables manquantes dans {env_file}: {', '.join(missing)}")

        return cls(
            mysql_host=os.getenv("MYSQL_HOST", "localhost"),
            mysql_port=int(os.getenv("MYSQL_PORT", "3306")),
            mysql_user=os.getenv("MYSQL_USER", "root"),
            mysql_password=os.getenv("MYSQL_PASSWORD", ""),
            mysql_database=os.getenv("MYSQL_DATABASE", "co2_industrial_db"),
            influx_url=os.getenv("INFLUX_URL", "http://localhost:8086"),
            influx_token=os.getenv("INFLUX_TOKEN", ""),
            influx_org=os.getenv("INFLUX_ORG", ""),
            influx_bucket=os.getenv("INFLUX_BUCKET", "co2_data"),
        )


class MySQLManager:
    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._conn: mysql.connector.MySQLConnection | None = None

    def __enter__(self) -> "MySQLManager":
        self._conn = mysql.connector.connect(
            host=self._config.mysql_host,
            port=self._config.mysql_port,
            user=self._config.mysql_user,
            password=self._config.mysql_password,
            database=self._config.mysql_database,
            autocommit=False,
            charset="utf8mb4",
        )
        log.info("MySQL connecté")
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._conn:
            self._conn.close()
            log.info("MySQL fermé")

    def execute(self, sql: str, params: tuple = ()) -> int:
        cur = self._conn.cursor()
        try:
            cur.execute(sql, params)
            return cur.lastrowid
        finally:
            cur.close()

    def fetchone(self, sql: str, params: tuple = ()):
        cur = self._conn.cursor()
        try:
            cur.execute(sql, params)
            return cur.fetchone()
        finally:
            cur.close()

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()


class InfluxManager:
    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._client: InfluxDBClient | None = None
        self._write_api = None

    def __enter__(self) -> "InfluxManager":
        self._client = InfluxDBClient(url=self._config.influx_url, token=self._config.influx_token, org=self._config.influx_org)
        self._write_api = self._client.write_api(write_options=SYNCHRONOUS)
        log.info("InfluxDB connecté")
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._write_api:
            self._write_api.close()
        if self._client:
            self._client.close()
            log.info("InfluxDB fermé")

    def write(self, points: list[Point]) -> None:
        if not points:
            return
        self._write_api.write(bucket=self._config.influx_bucket, org=self._config.influx_org, record=points)


class Seeder:
    def __init__(self, db: MySQLManager, inf: InfluxManager) -> None:
        self.db = db
        self.inf = inf
        self.company_id: int | None = None
        self.site_ids: list[int] = []
        self.sensor_uids: list[str] = []

    def _hash(self, raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    def seed_roles(self) -> dict[str, int]:
        rows = {
            "ADMIN": "Administrateur",
            "CLIENT": "Client",
            "TECHNICIAN": "Technicien",
        }
        role_ids: dict[str, int] = {}
        for code, name in rows.items():
            self.db.execute(
                """
                INSERT INTO roles (code, name, description, is_system_role)
                VALUES (%s, %s, %s, 1)
                ON DUPLICATE KEY UPDATE name = VALUES(name)
                """,
                (code, name, f"Rôle {name}"),
            )
            role_ids[code] = int(self.db.fetchone("SELECT id FROM roles WHERE code = %s", (code,))[0])
        return role_ids

    def seed_company(self) -> int:
        tenant_key = "techvent"
        self.db.execute(
            """
            INSERT INTO companies (tenant_key, legal_name, display_name, status, timezone, created_at, updated_at)
            VALUES (%s, %s, %s, 'ACTIVE', 'Europe/Paris', NOW(), NOW())
            ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), updated_at = NOW()
            """,
            (tenant_key, "TechVent Industries", "TechVent"),
        )
        return int(self.db.fetchone("SELECT id FROM companies WHERE tenant_key = %s", (tenant_key,))[0])

    def seed_users(self, role_ids: dict[str, int]) -> None:
        users = [
            ("admin@techvent.local", "Admin TechVent", True, "ADMIN"),
            ("client@techvent.local", "Client TechVent", False, "CLIENT"),
            ("tech@techvent.local", "Tech TechVent", False, "TECHNICIAN"),
        ]

        for email, name, is_admin, role_code in users:
            self.db.execute(
                """
                INSERT INTO users (email, password_hash, name, is_platform_admin, created_at, updated_at)
                VALUES (%s, %s, %s, %s, NOW(), NOW())
                ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW()
                """,
                (email, self._hash("Temp@1234!"), name, 1 if is_admin else 0),
            )
            user_id = int(self.db.fetchone("SELECT id FROM users WHERE email = %s", (email,))[0])

            self.db.execute(
                """
                INSERT INTO company_users (company_id, user_id, membership_status, joined_at, created_at, updated_at)
                VALUES (%s, %s, 'ACTIVE', NOW(), NOW(), NOW())
                ON DUPLICATE KEY UPDATE membership_status = 'ACTIVE', updated_at = NOW()
                """,
                (self.company_id, user_id),
            )

            cu_id = int(self.db.fetchone("SELECT id FROM company_users WHERE company_id = %s AND user_id = %s", (self.company_id, user_id))[0])
            self.db.execute(
                """
                INSERT INTO company_user_roles (company_user_id, role_id, assigned_at)
                VALUES (%s, %s, NOW())
                ON DUPLICATE KEY UPDATE assigned_at = VALUES(assigned_at)
                """,
                (cu_id, role_ids[role_code]),
            )

    def seed_sites_lines_devices_sensors(self) -> None:
        sites = [
            ("TN-TUN-01", "Site Tunis", "Tunis", 36.8065, 10.1815),
            ("TN-SFX-01", "Site Sfax", "Sfax", 34.7400, 10.7600),
        ]

        for idx, (site_code, name, city, lat, lon) in enumerate(sites, start=1):
            self.db.execute(
                """
                INSERT INTO sites (company_id, site_code, name, country_code, city, address_line1, latitude, longitude, status, created_at, updated_at)
                VALUES (%s, %s, %s, 'TN', %s, %s, %s, %s, 'ACTIVE', NOW(), NOW())
                ON DUPLICATE KEY UPDATE name = VALUES(name), city = VALUES(city), updated_at = NOW()
                """,
                (self.company_id, site_code, name, city, fake.street_address(), lat, lon),
            )
            site_id = int(self.db.fetchone("SELECT id FROM sites WHERE company_id = %s AND site_code = %s", (self.company_id, site_code))[0])
            self.site_ids.append(site_id)

            line_code = f"LINE-{idx:02d}"
            self.db.execute(
                """
                INSERT INTO production_lines (site_id, line_code, name, status, created_at, updated_at)
                VALUES (%s, %s, %s, 'ACTIVE', NOW(), NOW())
                ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW()
                """,
                (site_id, line_code, f"Ligne {idx}"),
            )
            line_id = int(self.db.fetchone("SELECT id FROM production_lines WHERE site_id = %s AND line_code = %s", (site_id, line_code))[0])

            for d in range(1, 3):
                device_uid = f"DEV-{site_code}-{d:02d}"
                self.db.execute(
                    """
                    INSERT INTO edge_devices (production_line_id, device_uid, name, hardware_model, firmware_version, connectivity_type, status, last_seen_at, created_at, updated_at)
                    VALUES (%s, %s, %s, 'ESP32-WROOM-32', 'v2.1.0', 'MQTT', 'ACTIVE', NOW(), NOW(), NOW())
                    ON DUPLICATE KEY UPDATE last_seen_at = NOW(), updated_at = NOW()
                    """,
                    (line_id, device_uid, f"Gateway {site_code}-{d}"),
                )
                device_id = int(self.db.fetchone("SELECT id FROM edge_devices WHERE device_uid = %s", (device_uid,))[0])

                sensor_uid = f"SENSOR-{site_code}-{d:02d}"
                self.db.execute(
                    """
                    INSERT INTO sensors (edge_device_id, sensor_uid, name, sensor_type, unit_default, sampling_interval_ms, calibration_offset, calibration_scale, installed_at, status, created_at, updated_at)
                    VALUES (%s, %s, %s, 'CO2', 'ppm', 5000, 0, 1, NOW(), 'ACTIVE', NOW(), NOW())
                    ON DUPLICATE KEY UPDATE edge_device_id = VALUES(edge_device_id), updated_at = NOW()
                    """,
                    (device_id, sensor_uid, f"Capteur CO2 {sensor_uid}"),
                )
                self.sensor_uids.append(sensor_uid)

    def seed_alerts(self) -> None:
        if not self.sensor_uids:
            return
        first_sensor_id = int(self.db.fetchone("SELECT id FROM sensors WHERE sensor_uid = %s", (self.sensor_uids[0],))[0])
        self.db.execute(
            """
            INSERT INTO alerts (
              company_id, site_id, sensor_id, alert_type, severity, status,
              triggered_at, trigger_value, threshold_value, message, metadata, created_at, updated_at
            ) VALUES (
              %s, %s, %s, 'THRESHOLD_BREACH', 'HIGH', 'OPEN',
              NOW() - INTERVAL 2 HOUR, %s, %s, %s, JSON_OBJECT('source', 'pydata-seeder'), NOW(), NOW()
            )
            """,
            (self.company_id, self.site_ids[0], first_sensor_id, 1250.0, 1000.0, "Seuil CO2 dépassé"),
        )

    def seed_influx(self) -> None:
        now = datetime.now(timezone.utc)
        interval = timedelta(minutes=5)
        points: list[Point] = []

        for sensor_uid in self.sensor_uids:
            current = now - timedelta(hours=24)
            while current <= now:
                base = 600 + random.uniform(-60, 120)
                if 8 <= current.hour <= 18:
                    base += random.uniform(100, 450)
                value = max(380.0, base)

                points.append(
                    Point("co2_readings")
                    .tag("sensorId", sensor_uid)
                    .field("value", float(round(value, 1)))
                    .time(current, WritePrecision.S)
                )
                current += interval

        self.inf.write(points)
        log.info("InfluxDB: %d points insérés", len(points))

    def run(self) -> None:
        role_ids = self.seed_roles()
        self.company_id = self.seed_company()
        self.seed_users(role_ids)
        self.seed_sites_lines_devices_sensors()
        self.seed_alerts()
        self.seed_influx()


def main() -> None:
    try:
        config = AppConfig.from_env(".env")
    except EnvironmentError as exc:
        log.error(str(exc))
        raise SystemExit(1) from exc

    try:
        with MySQLManager(config) as db, InfluxManager(config) as inf:
            seeder = Seeder(db, inf)
            seeder.run()
            db.commit()
            log.info("Seeding terminé avec succès")
    except Exception as exc:
        log.exception("Erreur de seeding: %s", exc)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
