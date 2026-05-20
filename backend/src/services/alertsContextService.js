const { Alert, Sensor } = require('../models');
const { HttpError } = require('../utils/httpError');
const { queryFluxRows } = require('./influxService');

function assertMysql() {
  if (String(process.env.MYSQL_ENABLED || 'true').toLowerCase() === 'false') {
    throw new HttpError(503, 'MySQL desactive', 'MYSQL_UNAVAILABLE');
  }
}

function resolveCompanyIdFromUserOrQuery(user, query = {}) {
  const q = query.companyId !== undefined ? Number(query.companyId) : null;
  const u = user?.activeCompanyId ? Number(user.activeCompanyId) : null;
  const companyId = q || u;
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new HttpError(400, 'companyId requis (token ou query)', 'VALIDATION_ERROR');
  }
  return companyId;
}

function escapeFluxString(value) {
  return String(value || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

async function getAlertWithSensor(alertId, user) {
  assertMysql();
  const companyId = resolveCompanyIdFromUserOrQuery(user, {});

  const alert = await Alert.findOne({
    where: { id: Number(alertId), companyId },
    include: [{ model: Sensor, as: 'sensor', required: false }]
  });
  if (!alert) throw new HttpError(404, 'Alerte introuvable', 'NOT_FOUND');

  return alert;
}

async function getAlertContextSeries({ alertId, user, beforeMinutes = 15, afterMinutes = 15, limit = 600 } = {}) {
  const alert = await getAlertWithSensor(alertId, user);
  const a = alert.toJSON ? alert.toJSON() : alert;

  const sensorUid = a.sensor?.sensorUid || a.metadata?.sensorUid || null;
  if (!sensorUid) {
    throw new HttpError(400, 'Impossible de resoudre sensorUid pour cette alerte', 'VALIDATION_ERROR');
  }

  const ts = a.triggeredAt ? new Date(a.triggeredAt) : null;
  if (!ts || Number.isNaN(ts.getTime())) {
    throw new HttpError(400, 'triggeredAt invalide', 'VALIDATION_ERROR');
  }

  const iso = ts.toISOString();
  const bucket = process.env.INFLUX_BUCKET || 'co2_data';
  const safeSensor = escapeFluxString(sensorUid);
  const safeIso = escapeFluxString(iso);

  const q = `
    from(bucket: "${bucket}")
      |> range(
        start: time(v: "${safeIso}") - ${Math.max(1, Number(beforeMinutes) || 15)}m,
        stop: time(v: "${safeIso}") + ${Math.max(1, Number(afterMinutes) || 15)}m
      )
      |> filter(fn: (r) => r._measurement == "co2_readings")
      |> filter(fn: (r) => r.sensorId == "${safeSensor}")
      |> filter(fn: (r) => r._field == "value")
      |> keep(columns: ["_time", "_value"])
      |> sort(columns: ["_time"])
      |> limit(n: ${Math.max(10, Math.min(Number(limit) || 600, 2000))})
  `;

  const rows = await queryFluxRows(q);
  const series = (rows || [])
    .map((r) => {
      const ppm = Number(r._value);
      if (!Number.isFinite(ppm)) return null;
      return { time: r._time, ppm: Math.round(ppm) };
    })
    .filter(Boolean);

  return {
    alert: {
      id: a.id,
      triggeredAt: a.triggeredAt,
      sensorUid,
      severity: a.severity,
      status: a.status,
      triggerValue: a.triggerValue,
      thresholdValue: a.thresholdValue,
      message: a.message
    },
    series
  };
}

module.exports = {
  getAlertContextSeries
};

