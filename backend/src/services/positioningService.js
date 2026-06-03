const { PositioningPosition, sequelize } = require('../models');
const { HttpError } = require('../utils/httpError');
const { queryFluxRows } = require('./influxService');

function assertMysql() {
  if (String(process.env.MYSQL_ENABLED || 'true').toLowerCase() === 'false') {
    throw new HttpError(503, 'MySQL desactive', 'MYSQL_UNAVAILABLE');
  }
}

function resolveCompanyId(user) {
  const companyId = user?.activeCompanyId ? Number(user.activeCompanyId) : null;
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new HttpError(400, 'companyId requis (token)', 'VALIDATION_ERROR');
  }
  return companyId;
}

function safeId(id) {
  const v = String(id || '').trim();
  if (!/^\d+$/.test(v)) throw new HttpError(400, 'id invalide', 'VALIDATION_ERROR');
  return v;
}

function stats(values) {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return { mean: 0, stddev: 0, n: 0 };
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length;
  return { mean, stddev: Math.sqrt(variance), n: v.length };
}

function normalize01(x, min, max) {
  if (!Number.isFinite(x)) return 0;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0.5;
  return Math.max(0, Math.min(1, (x - min) / (max - min)));
}

function retentionFromMean(mean) {
  if (!Number.isFinite(mean) || mean <= 0) return null;
  return Math.max(55, Math.min(98, Math.round(100 - Math.max(0, mean - 500) / 12)));
}

async function queryPositionMeanCo2(positionId, durationMinutes) {
  const bucket = process.env.INFLUX_BUCKET || 'co2_data';
  const duration = Math.max(5, Math.min(Number(durationMinutes) || 30, 240));
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: -${duration}m)
      |> filter(fn: (r) => r._measurement == "co2_readings")
      |> filter(fn: (r) => r._field == "value")
      |> filter(fn: (r) => (r.positionId == "${positionId}" or r.position_id == "${positionId}"))
      |> mean()
  `;
  try {
    const points = await queryFluxRows(fluxQuery);
    const values = points.map((p) => Number(p._value)).filter((n) => Number.isFinite(n));
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  } catch {
    return null;
  }
}

async function listPositions(user) {
  try {
    assertMysql();
    const companyId = resolveCompanyId(user);
    const rows = await PositioningPosition.findAll({
      where: { companyId },
      order: [['created_at', 'DESC']]
    });

    const enriched = [];
    for (const row of rows) {
      const json = row.toJSON();
      const mean = await queryPositionMeanCo2(json.id, json.durationMinutes);
      if (mean != null) {
        json.avgCo2Ppm = Number(mean.toFixed(1));
        json.retentionRate = retentionFromMean(mean);
      }
      enriched.push(json);
    }
    return enriched;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, 'Service temporairement indisponible');
  }
}

async function createPosition(payload, user) {
  try {
    assertMysql();
    const companyId = resolveCompanyId(user);
    const name = String(payload?.name || '').trim();
    const zone = String(payload?.zone || '').trim();
    const durationMinutes = Math.max(5, Math.min(Number(payload?.durationMinutes) || 30, 240));
    if (!name || !zone) throw new HttpError(400, 'name et zone requis', 'VALIDATION_ERROR');

    const lat = Number(payload?.latitude);
    const lng = Number(payload?.longitude);
    const created = await PositioningPosition.create({
      companyId,
      name,
      zone,
      durationMinutes,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      locationNote: payload?.locationNote ? String(payload.locationNote) : null
    });
    return created;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, 'Service temporairement indisponible');
  }
}

async function deletePosition(id, user) {
  try {
    assertMysql();
    const companyId = resolveCompanyId(user);
    const pid = safeId(id);
    const row = await PositioningPosition.findOne({ where: { id: pid, companyId } });
    if (!row) throw new HttpError(404, 'Position introuvable', 'NOT_FOUND');
    await row.destroy();
    return true;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, 'Service temporairement indisponible');
  }
}

/**
 * Compare positions via InfluxDB.
 *
 * Hypothèse Influx:
 * - measurement = "co2_readings"
 * - field = "value"
 * - tag requis = positionId (ou position_id) avec l'id MySQL de la position
 */
async function comparePositions(ids = [], user) {
  const companyId = resolveCompanyId(user);
  void companyId; // future: filtrage companyId dans influx via tag

  const bucket = process.env.INFLUX_BUCKET || 'co2_data';
  const uniqueIds = Array.from(new Set(ids.map(safeId)));
  if (uniqueIds.length < 2) throw new HttpError(400, 'Au moins 2 ids requis', 'VALIDATION_ERROR');

  assertMysql();
  const rows = await PositioningPosition.findAll({
    where: { id: uniqueIds },
    order: [['created_at', 'DESC']]
  });

  // Map id -> position (garde l'ordre demandé)
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const ordered = uniqueIds.map((id) => byId.get(String(id))).filter(Boolean);

  const metricsRaw = [];
  for (const pos of ordered) {
    const positionId = String(pos.id);
    const durationMinutes = Math.max(5, Math.min(Number(pos.durationMinutes) || 30, 240));

    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: -${durationMinutes}m)
        |> filter(fn: (r) => r._measurement == "co2_readings")
        |> filter(fn: (r) => r._field == "value")
        |> filter(fn: (r) => (r.positionId == "${positionId}" or r.position_id == "${positionId}"))
        |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
        |> keep(columns: ["_time","_value"])
        |> sort(columns: ["_time"])
    `;

    let points = [];
    try {
      points = await queryFluxRows(fluxQuery);
    } catch {
      points = [];
    }
    const values = points.map((p) => Number(p._value)).filter((n) => Number.isFinite(n));
    const s = stats(values);

    // Interférences: spikes abrupts (heuristique)
    let spikes = 0;
    const spikeDelta = 120; // ppm (ajustable)
    for (let i = 1; i < values.length; i += 1) {
      if (Math.abs(values[i] - values[i - 1]) >= spikeDelta) spikes += 1;
    }
    const interferenceRate = values.length > 1 ? spikes / (values.length - 1) : 0;

    metricsRaw.push({
      id: positionId,
      mean: s.mean,
      stddev: s.stddev,
      interferenceRate,
      n: s.n
    });
  }

  const means = metricsRaw.map((m) => m.mean);
  const stds = metricsRaw.map((m) => m.stddev);
  const minMean = Math.min(...means);
  const maxMean = Math.max(...means);
  const maxStd = Math.max(...stds, 0.00001);

  const positions = metricsRaw.map((m) => {
    const pos = byId.get(String(m.id));
    const co2Capture = Math.round(normalize01(m.mean, minMean, maxMean) * 100);
    const stability = Math.round((1 - Math.min(1, m.stddev / maxStd)) * 100);
    const interference = Math.round((1 - Math.min(1, m.interferenceRate)) * 100);

    const score = Math.round(0.45 * co2Capture + 0.35 * stability + 0.20 * interference);
    const confidence = Math.max(50, Math.min(99.9, score + 2.5)); // “fiabilité de collecte” (UI)

    return {
      id: pos.id,
      name: pos.name,
      zone: pos.zone,
      durationMinutes: pos.durationMinutes,
      metrics: {
        co2Capture,
        stability,
        interference,
        score,
        confidence,
        // debug/tech
        meanPpm: Number(m.mean.toFixed(2)),
        stddevPpm: Number(m.stddev.toFixed(2)),
        points: m.n
      }
    };
  });

  const recommended = positions.reduce((best, cur) => (!best || cur.metrics.score > best.metrics.score ? cur : best), null);

  return {
    positions,
    recommended: recommended
      ? { id: recommended.id, name: recommended.name, confidence: recommended.metrics.confidence, score: recommended.metrics.score }
      : null
  };
}

async function finalizePosition(positionId, user) {
  try {
    assertMysql();
    const companyId = resolveCompanyId(user);
    const pid = safeId(positionId);

    return await sequelize.transaction(async (t) => {
      const row = await PositioningPosition.findOne({ where: { id: pid, companyId }, transaction: t, lock: t.LOCK.UPDATE });
      if (!row) throw new HttpError(404, 'Position introuvable', 'NOT_FOUND');

      await PositioningPosition.update(
        { isFinal: false, finalizedAt: null },
        { where: { companyId }, transaction: t }
      );

      await row.update({ isFinal: true, finalizedAt: new Date() }, { transaction: t });
      return row;
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, 'Service temporairement indisponible');
  }
}

async function updatePositionNote(positionId, payload, user) {
  try {
    assertMysql();
    const companyId = resolveCompanyId(user);
    const pid = safeId(positionId);
    const row = await PositioningPosition.findOne({ where: { id: pid, companyId } });
    if (!row) throw new HttpError(404, 'Position introuvable', 'NOT_FOUND');

    const patch = {};
    if (payload?.locationNote !== undefined) patch.locationNote = String(payload.locationNote || '').trim() || null;
    if (payload?.latitude !== undefined) {
      const lat = Number(payload.latitude);
      patch.latitude = Number.isFinite(lat) ? lat : null;
    }
    if (payload?.longitude !== undefined) {
      const lng = Number(payload.longitude);
      patch.longitude = Number.isFinite(lng) ? lng : null;
    }
    if (payload?.retentionRate !== undefined) {
      const retention = Number(payload.retentionRate);
      patch.retentionRate = Number.isFinite(retention) ? retention : null;
    }
    await row.update(patch);
    return row;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, 'Service temporairement indisponible');
  }
}

module.exports = {
  listPositions,
  createPosition,
  deletePosition,
  comparePositions,
  finalizePosition,
  updatePositionNote
};

