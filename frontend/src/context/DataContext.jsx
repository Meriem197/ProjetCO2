import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import api, { USE_MOCK, resolveApiErrorMessage, unwrapApiData, unwrapApiMeta } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { CO2_DEFAULT_LIMITS, co2StatusLevel } from "@/lib/co2Metrology";
import {
  generateAlerts,
  generateForecast,
  generateHistory,
  generateSensorStatus,
  nextReading,
} from "@/services/mockData";

const DataContext = createContext(undefined);
const POLL_INTERVAL = 5000;
const ENV_SENSOR_ID = String(import.meta.env.VITE_SENSOR_ID || "").trim();

function resolveSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  const fromApi = import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, "");
  if (fromApi) return fromApi;
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    return window.location.origin;
  }
  return import.meta.env.VITE_BACKEND_PROXY_TARGET || "http://localhost:4000";
}

function normalizeHistoryPoints(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((p) => ({
      t: new Date(p.time).getTime(),
      ppm: Math.round(Number(p.value)),
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.ppm))
    .sort((a, b) => a.t - b.t);
}

function applyTelemetryToSensor(prev, telemetry, lastPoint) {
  const next = { ...prev };
  const tel = telemetry || {};
  if (Number.isFinite(tel.battery)) next.battery = Math.round(tel.battery);
  if (Number.isFinite(tel.wifiRssi)) next.wifi = Math.round(tel.wifiRssi);
  if (Number.isFinite(tel.temperature)) next.temperature = tel.temperature;
  if (Number.isFinite(tel.humidity)) next.humidity = tel.humidity;
  if (!Number.isFinite(next.battery) && lastPoint?.battery != null) {
    next.battery = Math.round(Number(lastPoint.battery));
  }
  if (!Number.isFinite(next.wifi) && lastPoint?.wifi != null) {
    next.wifi = Math.round(Number(lastPoint.wifi));
  }
  return next;
}

export function DataProvider({ children }) {
  const { token } = useAuth();
  const isAuthenticated = Boolean(token);

  const [history, setHistory] = useState([]);
  const [sensor, setSensor] = useState({
    battery: null,
    wifi: null,
    mqtt: "reconnecting",
    lastSeen: null,
    firmware: null,
    uptime: null,
    temperature: null,
    humidity: null,
  });
  const [threshold, setThresholdState] = useState(CO2_DEFAULT_LIMITS.moderate);
  const [limits, setLimits] = useState({
    healthy: CO2_DEFAULT_LIMITS.healthy,
    moderate: CO2_DEFAULT_LIMITS.moderate,
    critical: 1400,
  });
  const [horizonMinutes, setHorizonMinutes] = useState(30);
  const [sensorId, setSensorId] = useState(ENV_SENSOR_ID);
  const [forecast, setForecast] = useState([]);
  const [predictionMeta, setPredictionMeta] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const intervalRef = useRef(null);
  const socketRef = useRef(null);
  const lastMockPpmRef = useRef(null);

  const setThreshold = (v) => {
    setThresholdState(v);
    localStorage.setItem("airsense_threshold", String(v));
  };

  const refreshAlerts = useCallback(async (activeSensorId = sensorId) => {
    if (!isAuthenticated || USE_MOCK) return;
    try {
      const alertsUrl = activeSensorId
        ? `/alerts?sensorId=${encodeURIComponent(activeSensorId)}`
        : "/alerts";
      const alertsRes = await api.get(alertsUrl);
      const alertsData = unwrapApiData(alertsRes.data);
      setAlerts(Array.isArray(alertsData) ? alertsData.map(normalizeAlertRow).filter(Boolean) : []);
    } catch {
      setAlerts([]);
    }
  }, [isAuthenticated, sensorId]);

  useEffect(() => {
    if (!isAuthenticated || USE_MOCK) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/settings");
        const data = unwrapApiData(res.data);
        if (cancelled || !data) return;
        const healthy = Number(data.limitGood) || CO2_DEFAULT_LIMITS.healthy;
        const moderate = Number(data.limitWarning) || CO2_DEFAULT_LIMITS.moderate;
        const critical = Number(data.limitCritical) || 1400;
        setLimits({ healthy, moderate, critical });
        setThresholdState(moderate);
      } catch {
        // garde les valeurs par défaut
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  /** Résout le capteur : actifs Influx → liste MySQL → VITE_SENSOR_ID */
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const loadSensorId = async () => {
      try {
        const activeRes = await api.get("/co2/active-sensors");
        const active = unwrapApiData(activeRes.data);
        if (!cancelled && Array.isArray(active) && active.length > 0) {
          setSensorId(String(active[0]));
          return;
        }

        const sensorsRes = await api.get("/sensors");
        const sensors = unwrapApiData(sensorsRes.data);
        const first = Array.isArray(sensors)
          ? sensors.find((s) => String(s.sensorType || "").toUpperCase() === "CO2") || sensors[0]
          : null;
        const uid = first?.sensorUid || first?.mqttSensorId || "";
        if (!cancelled && uid) {
          setSensorId(String(uid));
          return;
        }

        if (!cancelled && ENV_SENSOR_ID) {
          setSensorId(ENV_SENSOR_ID);
        }
      } catch {
        if (!cancelled && ENV_SENSOR_ID) setSensorId(ENV_SENSOR_ID);
      }
    };

    loadSensorId();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSensor((prev) => ({ ...prev, mqtt: "reconnecting" }));
      setHistory([]);
      setAlerts([]);
      setIsLoading(false);
      setError(null);
      setPredictionMeta(null);
      return;
    }

    if (USE_MOCK) {
      const seed = generateHistory(24, 5);
      setHistory(seed);
      setAlerts(generateAlerts(seed));
      setSensor((prev) => ({ ...prev, ...generateSensorStatus() }));
      setForecast(generateForecast(seed, horizonMinutes));
      setPredictionMeta({
        method: "mock_generator",
        confidence: null,
        pointsUsed: seed.length,
      });
      setIsLoading(false);
      setError(null);
      lastMockPpmRef.current = seed[seed.length - 1]?.ppm ?? 500;

      intervalRef.current = window.setInterval(() => {
        const ppm = nextReading(lastMockPpmRef.current);
        lastMockPpmRef.current = ppm;
        const point = { t: Date.now(), ppm };

        setHistory((h) => {
          const nextHistory = [...h.slice(-287), point];
          setForecast(generateForecast(nextHistory, horizonMinutes));
          setAlerts(generateAlerts(nextHistory));
          return nextHistory;
        });

        setSensor((prev) => ({
          ...prev,
          ...generateSensorStatus(),
          mqtt: "connected",
          lastSeen: Date.now(),
        }));
        setLastUpdate(Date.now());
      }, POLL_INTERVAL);

      return () => {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
      };
    }

    const tick = async () => {
      setIsLoading(true);
      try {
        let historyUrl = sensorId
          ? `/co2/history?sensorId=${encodeURIComponent(sensorId)}&start=-24h`
          : "/co2/history?start=-24h";

        let historyRes = await api.get(historyUrl);
        let body = historyRes.data;
        let historyData = unwrapApiData(body);
        let meta = unwrapApiMeta(body) || {};

        // Fallback robuste: si un sensorId force ne renvoie rien, relancer sans sensorId
        // pour laisser le backend choisir un capteur actif automatiquement.
        if (sensorId && Array.isArray(historyData) && historyData.length === 0) {
          historyUrl = "/co2/history?start=-24h";
          historyRes = await api.get(historyUrl);
          body = historyRes.data;
          historyData = unwrapApiData(body);
          meta = unwrapApiMeta(body) || {};
        }

        const resolvedSensorId = meta.sensorId;
        if (resolvedSensorId && String(resolvedSensorId) !== String(sensorId)) {
          setSensorId(String(resolvedSensorId));
        }

        const normalized = normalizeHistoryPoints(historyData);
        setHistory(normalized);
        setSensor((prev) =>
          applyTelemetryToSensor(
            {
              ...prev,
              mqtt: normalized.length > 0 ? "connected" : prev.mqtt,
              lastSeen: normalized.length > 0 ? Date.now() : prev.lastSeen,
            },
            meta.telemetry,
            null
          )
        );

        if (normalized.length === 0 && meta.hint === "NO_SENSOR") {
          setError("Aucun capteur avec des mesures. Verifiez MQTT / InfluxDB.");
        } else {
          setError(null);
        }

        await refreshAlerts(sensorId);

        setLastUpdate(Date.now());
      } catch (err) {
        const code = err?.response?.data?.error?.code;
        if (code === "NO_ACTIVE_SENSOR" || err?.response?.status === 404) {
          setHistory([]);
          setError("Aucune donnee capteur pour le moment.");
        } else {
          setError(resolveApiErrorMessage(err, "Connexion API impossible"));
          setHistory([]);
        }
        setSensor((prev) => ({ ...prev, mqtt: "reconnecting" }));
      } finally {
        setIsLoading(false);
      }
    };

    tick();
    intervalRef.current = window.setInterval(tick, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, sensorId, refreshAlerts]);

  useEffect(() => {
    if (!isAuthenticated || USE_MOCK) return;

    const socket = io(resolveSocketUrl(), {
      transports: ["websocket", "polling"],
      withCredentials: false,
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSensor((prev) => ({ ...prev, mqtt: "connected", lastSeen: Date.now() }));
    });

    socket.on("co2:update", (payload) => {
      if (!payload || !Number.isFinite(payload.value)) return;
      if (sensorId && payload.sensorId && String(payload.sensorId) !== String(sensorId)) return;
      if (!sensorId && payload.sensorId) setSensorId(String(payload.sensorId));

      const point = {
        t: payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now(),
        ppm: Math.round(Number(payload.value)),
      };
      setHistory((h) => [...h.slice(-287), point]);
      setSensor((prev) =>
        applyTelemetryToSensor(
          { ...prev, mqtt: "connected", lastSeen: Date.now() },
          null,
          payload
        )
      );
      setLastUpdate(Date.now());
      setError(null);
    });

    socket.on("alerts:new", (payload) => {
      const normalized = normalizeAlertRow(payload);
      if (!normalized) return;
      setAlerts((prev) => {
        if (prev.some((a) => a.id === normalized.id)) return prev;
        return [normalized, ...prev].slice(0, 200);
      });
    });

    socket.on("disconnect", () => {
      setSensor((prev) => ({ ...prev, mqtt: "reconnecting" }));
    });

    socket.on("connect_error", () => {
      setSensor((prev) => ({ ...prev, mqtt: "reconnecting" }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, sensorId, token]);

  const current = history[history.length - 1]?.ppm ?? 0;
  const status = co2StatusLevel(current, limits);

  useEffect(() => {
    if (!isAuthenticated || USE_MOCK) {
      setForecast([]);
      setPredictionMeta(null);
      return;
    }
    const loadPrediction = async () => {
      try {
        const predictUrl = sensorId
          ? `/co2/predict?sensorId=${encodeURIComponent(sensorId)}&horizonMinutes=${horizonMinutes}`
          : `/co2/predict?horizonMinutes=${horizonMinutes}`;
        const res = await api.get(predictUrl);
        const payload = unwrapApiData(res.data);
        if (!payload) {
          setForecast([]);
          setPredictionMeta(null);
          return;
        }

        if (Array.isArray(payload.forecast) && payload.forecast.length > 0) {
          const normalizedForecast = payload.forecast
            .map((p) => ({
              t: new Date(p.t).getTime(),
              ppm: Math.round(Number(p.ppm)),
              lower: Number.isFinite(Number(p.lower)) ? Math.round(Number(p.lower)) : null,
              upper: Number.isFinite(Number(p.upper)) ? Math.round(Number(p.upper)) : null,
            }))
            .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.ppm));

          if (normalizedForecast.length > 0) {
            setForecast(normalizedForecast);
            setPredictionMeta({
              method: payload.method || null,
              confidence: Number.isFinite(Number(payload.confidence)) ? Number(payload.confidence) : null,
              pointsUsed: Number.isFinite(Number(payload.pointsUsed)) ? Number(payload.pointsUsed) : null,
              slopePpmPerMinute: Number.isFinite(Number(payload.slopePpmPerMinute))
                ? Number(payload.slopePpmPerMinute)
                : null,
            });
            return;
          }
        }

        if (Number.isFinite(payload.predictedPpm)) {
          const lastTime = history[history.length - 1]?.t ?? Date.now();
          setForecast([
            {
              t: lastTime + horizonMinutes * 60000,
              ppm: Math.round(payload.predictedPpm),
              lower: null,
              upper: null,
            },
          ]);
          setPredictionMeta({
            method: payload.method || "linear_regression",
            confidence: null,
            pointsUsed: Number.isFinite(Number(payload.pointsUsed)) ? Number(payload.pointsUsed) : null,
            slopePpmPerMinute: Number.isFinite(Number(payload.slopePpmPerMinute))
              ? Number(payload.slopePpmPerMinute)
              : null,
          });
          return;
        }

        setForecast([]);
        setPredictionMeta(null);
      } catch {
        setForecast([]);
        setPredictionMeta(null);
      }
    };
    loadPrediction();
  }, [horizonMinutes, history, isAuthenticated, sensorId]);

  const value = {
    current,
    status,
    history,
    forecast,
    predictionMeta,
    alerts,
    sensor,
    threshold,
    limits,
    setThreshold,
    refreshAlerts,
    horizonMinutes,
    setHorizonMinutes,
    isLive: sensor.mqtt === "connected",
    sensorId,
    lastUpdate,
    isLoading,
    error,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function mapSeverityToUiLevel(severity, triggerValue, thresholdValue) {
  const s = String(severity || "").toUpperCase();
  if (s === "CRITICAL" || s === "HIGH") return "critical";
  if (s === "MEDIUM") return "warning";
  if (s === "LOW") return "good";
  const v = Number(triggerValue);
  const thr = Number(thresholdValue);
  if (Number.isFinite(v) && Number.isFinite(thr) && thr > 0) {
    if (v > thr) return "critical";
    if (v >= 600) return "warning";
    return "good";
  }
  return "warning";
}

function mapStatusToUi(status) {
  const s = String(status || "").toUpperCase();
  if (s === "OPEN") return "active";
  if (s === "ACKNOWLEDGED") return "acquittee";
  if (s === "RESOLVED" || s === "CLOSED") return "resolue";
  if (s === "ACTIVE" || s === "ACQUITTEE" || s === "RESOLUE") return s.toLowerCase();
  return "active";
}

function normalizeAlertRow(row) {
  if (!row || typeof row !== "object") return null;
  const id = row.id ?? row.alertId ?? row._id;
  const triggeredAt = row.triggeredAt ?? row.triggered_at ?? row.date ?? row.timestamp ?? null;
  const ppm = row.triggerValue ?? row.ppm ?? row.value ?? row.trigger_value ?? null;
  const thresholdValue = row.thresholdValue ?? row.threshold ?? row.threshold_value ?? null;
  const severity = row.severity ?? row.level ?? null;
  const rawStatus = row.status ?? row.statut ?? null;
  const message = row.message ?? "Alerte CO₂";
  const sensor = row.sensorId ?? row.sensorUid ?? row.metadata?.sensorUid ?? null;
  return {
    id,
    triggeredAt,
    date: triggeredAt,
    ppm: ppm != null ? Math.round(Number(ppm)) : null,
    threshold: thresholdValue != null ? Math.round(Number(thresholdValue)) : null,
    severity: String(severity || "").toUpperCase() || null,
    status: mapStatusToUi(rawStatus),
    rawStatus,
    level: mapSeverityToUiLevel(severity, ppm, thresholdValue),
    message,
    sensorId: sensor,
  };
}

export function useCO2Data() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useCO2Data doit être utilisé dans <DataProvider>");
  return ctx;
}
