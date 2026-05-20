/**
 * Générateur de données simulées CO₂ — utilisé tant que VITE_API_URL
 * n'est pas branché sur le vrai backend MQTT/InfluxDB/IA.
 */
export function classify(ppm, threshold = 1500) {
    if (400 <= ppm && ppm <= 800)
        return "good";
    if (ppm < threshold)
        return "warning";
    return "critical";
}
export function statusLabel(s) {
    return s === "good" ? "Air sain" : s === "warning" ? "Qualité moyenne" : "Critique";
}
// Profil journalier réaliste (ppm) — plus haut en journée
function baseline(date) {
    const h = date.getHours() + date.getMinutes() / 60;
    // courbe en cloche journée + bruit
    const day = 420 + 380 * Math.exp(-Math.pow((h - 14) / 4.5, 2));
    return day;
}
export function generateHistory(hours = 24, stepMin = 5) {
    const now = Date.now();
    const points = [];
    const total = (hours * 60) / stepMin;
    let ppm = 500;
    for (let i = total; i >= 0; i--) {
        const t = now - i * stepMin * 60000;
        const target = baseline(new Date(t));
        ppm += (target - ppm) * 0.15 + (Math.random() - 0.5) * 40;
        if (Math.random() < 0.02)
            ppm += 200; // pic occasionnel
        ppm = Math.max(380, Math.min(1600, ppm));
        points.push({ t, ppm: Math.round(ppm) });
    }
    return points;
}
export function nextReading(prev) {
    const target = baseline(new Date());
    const base = prev ?? target;
    const v = base + (target - base) * 0.2 + (Math.random() - 0.5) * 35;
    return Math.max(380, Math.min(1800, Math.round(v)));
}
export function generateForecast(history, horizonMinutes, stepMin = 5) {
    if (history.length === 0)
        return [];
    const last = history[history.length - 1];
    const steps = Math.ceil(horizonMinutes / stepMin);
    const out = [];
    let v = last.ppm;
    for (let i = 1; i <= steps; i++) {
        const t = last.t + i * stepMin * 60000;
        const target = baseline(new Date(t));
        v += (target - v) * 0.18;
        const uncertainty = 25 + i * 6;
        out.push({
            t,
            ppm: Math.round(v),
            lower: Math.round(v - uncertainty),
            upper: Math.round(v + uncertainty),
        });
    }
    return out;
}
export function generateAlerts(history) {
    const alerts = [];
    let cooldown = 0;
    history.forEach((p, idx) => {
        if (cooldown > 0) {
            cooldown--;
            return;
        }
        if (p.ppm > 1500) {
            alerts.push({
                id: `A-${p.t}`,
                date: p.t,
                level: "critical",
                ppm: p.ppm,
                message: `Seuil critique dépassé (${p.ppm} ppm)`,
                status: idx < history.length - 6 ? "resolue" : "active",
            });
            cooldown = 6;
        }
        else if (800 < p.ppm && p.ppm <= 1500) {
            alerts.push({
                id: `A-${p.t}`,

                date: p.t,
                level: "warning",
                ppm: p.ppm,
                message: `Concentration élevée (${p.ppm} ppm)`,
                status: idx < history.length - 12 ? "resolue" : "acquittee",
            });
            cooldown = 4;
        }
    });
    return alerts.slice(-30).reverse();
}
// Statut capteur simulé
export function generateSensorStatus() {
    return {
        battery: 78 + Math.round(Math.random() * 10),
        wifi: -45 - Math.round(Math.random() * 20),
        mqtt: Math.random() > 0.05 ? "connected" : "reconnecting",
        lastSeen: Date.now() - Math.round(Math.random() * 4000),
        firmware: "v2.4.1",
        uptime: 86400 * 4 + Math.round(Math.random() * 3600),
    };
}
export const MOCK_SENSORS = [
    { id: "esp1", name: "Atelier A — Ligne 1", lat: 48.8566, lng: 2.3522, ppm: 540, zone: "Production" },
    { id: "esp1", name: "Atelier B — Soudure", lat: 48.8606, lng: 2.3376, ppm: 920, zone: "Production" },
    { id: "esp1", name: "Entrepôt Nord", lat: 48.8738, lng: 2.295, ppm: 480, zone: "Logistique" },
    { id: "esp1", name: "Bureau R&D", lat: 48.853, lng: 2.3499, ppm: 1120, zone: "Bureaux" },
    { id: "esp1", name: "Salle serveurs", lat: 48.8584, lng: 2.2945, ppm: 610, zone: "IT" },
];
