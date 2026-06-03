from influxdb_client import InfluxDBClient
import pandas as pd
from config import settings

def load_training_data(days: int = 180) -> pd.DataFrame:
    client = InfluxDBClient(
        url=settings.influx_url,
        token=settings.influx_token,
        org=settings.influx_org,
    )
    query = f"""
    from(bucket: "{settings.influx_bucket}")
      |> range(start: -{days}d)
      |> filter(fn: (r) => r._measurement == "co2_readings")
      |> filter(fn: (r) => r.sensorId == "{settings.sensor_uid}")
      |> filter(fn: (r) => r._field == "co2_ppm" or r._field == "temp_c" or r._field == "hum_pct")
      |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    """
    df = client.query_api().query_data_frame(query)
    client.close()

    df = df.rename(columns={"_time": "timestamp"})
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df[["timestamp","co2_ppm","temp_c","hum_pct"]].copy()