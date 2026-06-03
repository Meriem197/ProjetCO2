from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path

class Settings(BaseSettings):
    influx_url: str = "http://localhost:8086"
    influx_token: str = ""
    influx_org: str = ""
    influx_bucket: str = "co2_data"
    sensor_uid: str = "SENSOR-SCD30-001"
    models_dir: Path = Path("models")
    ml_version: str = "latest"

    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
