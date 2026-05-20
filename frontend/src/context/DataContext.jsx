import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import api, { unwrapApiData } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
const DataContext = createContext(undefined);
const POLL_INTERVAL = 5000;
const SENSOR_ID = import.meta.env.VITE_SENSOR_ID ?? "";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ??
    import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, "") ??
    import.meta.env.VITE_BACKEND_PROXY_TARGET ??
    "http://localhost:4002";
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
    });
    const [threshold, setThresholdState] = useState(() => {
        const v = localStorage.getItem("airsense_threshold");
        return v ? Number(v) : 1000;
    });
    const [horizonMinutes, setHorizonMinutes] = useState(30);
    const [sensorId, setSensorId] = useState(SENSOR_ID);
    const [forecast, setForecast] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(Date.now());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const intervalRef = useRef(null);
    const socketRef = useRef(null);
    const setThreshold = (v) => {
        setThresholdState(v);
        localStorage.setItem("airsense_threshold", String(v));
    };
    useEffect(() => {
        if (!isAuthenticated)
            return;
        console.log("[DEBUG] token", token);
        const loadSensorId = async () => {
            try {
                if (SENSOR_ID) {
                    setSensorId(SENSOR_ID);
                    return;
                }
                const activeSensorsResponse = await api.get("/co2/active-sensors");
                const activeSensors = unwrapApiData(activeSensorsResponse.data);
                if (Array.isArray(activeSensors) && activeSensors.length > 0) {
                    setSensorId(String(activeSensors[0]));
                    return;
                }
                const response = await api.get("/sensors");
                const sensors = unwrapApiData(response.data);
                const first = Array.isArray(sensors) ? sensors.find((s) => String(s.sensorType || "").toUpperCase() === "CO2") || sensors[0] : null;
                const uid = first?.sensorUid || first?.mqttSensorId || "";
                setSensorId(uid);
            }
            catch (error) {
                console.warn("[DEBUG] loadSensorId failed", error);
                setSensorId("");
            }
        };
        loadSensorId();
    }, [isAuthenticated]);
    // Polling temps réel — toutes les 5s
    useEffect(() => {
        if (!isAuthenticated) {
            setSensor((prev) => ({ ...prev, mqtt: "reconnecting" }));
            setHistory([]);
            setIsLoading(false);
            return;
        }
        const tick = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const historyUrl = sensorId
                    ? `/co2/history?sensorId=${encodeURIComponent(sensorId)}&start=-24h`
                    : "/co2/history?start=-24h";
                const historyRes = await api.get(historyUrl);
                const historyData = unwrapApiData(historyRes.data);
                console.log("[DEBUG] historyData", historyData);
                const resolvedSensorId = historyRes?.data?.meta?.sensorId;
                if (resolvedSensorId && resolvedSensorId !== sensorId) {
                    setSensorId(String(resolvedSensorId));
                }
                const normalized = Array.isArray(historyData)
                    ? historyData
                        .map((p) => ({
                        t: new Date(p.time).getTime(),
                        ppm: Math.round(Number(p.value)),
                    }))
                        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.ppm))
                        .sort((a, b) => a.t - b.t)
                    : [];
                setHistory(normalized);
                setSensor((prev) => ({
                    ...prev,
                    mqtt: normalized.length > 0 ? "connected" : "reconnecting",
                    lastSeen: normalized.length > 0 ? Date.now() : prev.lastSeen,
                }));
                try {
                    const statsUrl = sensorId
                        ? `/co2/stats?sensorId=${encodeURIComponent(sensorId)}&start=-24h`
                        : "/co2/stats?start=-24h";
                    const statsRes = await api.get(statsUrl);
                    const stats = unwrapApiData(statsRes.data);
                    console.log("[DEBUG] statsData", stats);
                    if (typeof stats.mean === "number" && Number.isFinite(stats.mean)) {
                        setThresholdState((currentThreshold) => currentThreshold > 0 ? currentThreshold : Math.round(stats.mean + 300));
                    }
                }
                catch (error) {
                    console.warn("[DEBUG] stats request failed", error);
                }
                try {
                    const alertsUrl = sensorId ? `/alerts?sensorId=${encodeURIComponent(sensorId)}` : "/alerts";
                    const alertsRes = await api.get(alertsUrl);
                    const alertsData = unwrapApiData(alertsRes.data);
                    setAlerts(Array.isArray(alertsData) ? alertsData.map(normalizeAlertRow).filter(Boolean) : []);
                }
                catch (error) {
                    console.warn("[DEBUG] alerts request failed", error);
                    setAlerts([]);
                }
                setLastUpdate(Date.now());
                setIsLoading(false);
            }
            catch (err) {
                console.error("[DEBUG] history request failed", err);
                setError(err?.response?.data?.error?.message || "Connexion API impossible");
                setSensor((prev) => ({ ...prev, mqtt: "reconnecting" }));
                setHistory([]);
                setAlerts([]);
                setIsLoading(false);
            }
        };
        tick();
        intervalRef.current = window.setInterval(tick, POLL_INTERVAL);
        return () => {
            if (intervalRef.current)
                window.clearInterval(intervalRef.current);
        };
    }, [isAuthenticated, sensorId]);
    useEffect(() => {
        if (!isAuthenticated)
            return;
        const socket = io(SOCKET_URL, {
            transports: ["websocket", "polling"],
            withCredentials: false,
        });
        socketRef.current = socket;
        socket.on("connect", () => {
            setSensor((prev) => ({ ...prev, mqtt: "connected", lastSeen: Date.now() }));
        });
        socket.on("co2:update", (payload) => {
            if (!payload || !Number.isFinite(payload.value))
                return;
            if (sensorId && payload.sensorId !== sensorId)
                return;
            if (!sensorId && payload.sensorId)
                setSensorId(String(payload.sensorId));
            const point = {
                t: payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now(),
                ppm: Math.round(Number(payload.value)),
            };
            setHistory((h) => [...h.slice(-287), point]);
            setSensor((prev) => ({ ...prev, mqtt: "connected", lastSeen: Date.now() }));
            setLastUpdate(Date.now());
        });

        // Alertes persistées (push backend) — page Alertes sans polling lourd
        socket.on("alerts:new", (payload) => {
            const normalized = normalizeAlertRow(payload);
            if (!normalized)
                return;
            setAlerts((prev) => {
                const exists = prev.some((a) => a.id === normalized.id);
                if (exists)
                    return prev;
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
    }, [isAuthenticated, sensorId]);
    const current = history[history.length - 1]?.ppm ?? 0;
    const status = current < 600 ? "good" : current < threshold ? "warning" : "critical";
    useEffect(() => {
        if (!isAuthenticated) {
            setForecast([]);
            return;
        }
        const loadPrediction = async () => {
            try {
                const predictUrl = sensorId
                    ? `/co2/predict?sensorId=${encodeURIComponent(sensorId)}&horizonMinutes=${horizonMinutes}`
                    : `/co2/predict?horizonMinutes=${horizonMinutes}`;
                const res = await api.get(predictUrl);
                const payload = unwrapApiData(res.data);
                if (!payload || !Number.isFinite(payload.predictedPpm)) {
                    setForecast([]);
                    return;
                }
                const lastTime = history[history.length - 1]?.t ?? Date.now();
                setForecast([{ t: lastTime + horizonMinutes * 60000, ppm: Math.round(payload.predictedPpm), lower: null, upper: null }]);
            }
            catch {
                console.warn("[DEBUG] predict request failed");
                setForecast([]);
            }
        };
        loadPrediction();
    }, [horizonMinutes, history, isAuthenticated, sensorId]);
    const value = {
        current,
        status,
        history,
        forecast,
        alerts,
        sensor,
        threshold,
        setThreshold,
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
    if (s === "CRITICAL" || s === "HIGH")
        return "critical";
    if (s === "MEDIUM")
        return "warning";
    if (s === "LOW")
        return "good";
    // fallback from ppm/threshold
    const v = Number(triggerValue);
    const thr = Number(thresholdValue);
    if (Number.isFinite(v) && Number.isFinite(thr) && thr > 0) {
        if (v > thr)
            return "critical";
        if (v >= 600)
            return "warning";
        return "good";
    }
    return "warning";
}

function mapStatusToUi(status) {
    const s = String(status || "").toUpperCase();
    if (s === "OPEN")
        return "active";
    if (s === "ACKNOWLEDGED")
        return "acquittee";
    if (s === "RESOLVED" || s === "CLOSED")
        return "resolue";
    // legacy déjà côté front
    if (s === "ACTIVE" || s === "ACQUITTEE" || s === "RESOLUE")
        return s.toLowerCase();
    return "active";
}

function normalizeAlertRow(row) {
    if (!row || typeof row !== "object")
        return null;
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
    if (!ctx)
        throw new Error("useCO2Data doit être utilisé dans <DataProvider>");
    return ctx;
}
