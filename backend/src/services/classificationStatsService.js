/**
 * classificationStatsService.js — Optimized InfluxDB Flux aggregations for Classification
 *
 * Computes max / mean / min directly in InfluxDB (Flux), per selected time window.
 * Also returns a bucketized time-series suitable for chart + tooltip sync.
 */

const { queryFluxRows } = require('./influxService');
const { HttpError } = require('../utils/httpError');

const WINDOW_MAP = {
  '24h': { start: '-24h', bucketEvery: '5m' },
  '7d': { start: '-7d', bucketEvery: '30m' },
  '30d': { start: '-30d', bucketEvery: '2h' },
  '1y': { start: '-365d', bucketEvery: '1d' },
};

const AGGREGATION_MAP = {
  raw: { key: 'raw' }, // raw points (limited)
  mean: { key: 'mean' }, // default (bucketEvery depends on window)
  monthly: { key: 'monthly', bucketEvery: '1mo' }, // aggregate by month
};

// Assumed standard IoT schema (can adapt later if needed)
const SENSOR_TAG = 'sensorId';
const MEASUREMENT = 'co2_readings';
// Aligné sur mqttHandler / influxService (field Influx = "value")
const FIELD = 'value';

function isValidWindow(period) {
  return period in WINDOW_MAP;
}

function sanitizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function classifyPpm(ppm, threshold = 1000) {
  const v = sanitizeNumber(ppm);
  if (v == null) return 'unknown';
  if (v < 600) return 'good';
  // IMPORTANT: seuil haut inclus dans "warning" (600–threshold)
  if (v <= threshold) return 'warning';
  return 'critical';
}

function isValidAggregation(aggregation) {
  return aggregation in AGGREGATION_MAP;
}

function resolveBucketEvery({ period, aggregation }) {
  if (aggregation === 'monthly') return AGGREGATION_MAP.monthly.bucketEvery;
  if (aggregation === 'mean') return WINDOW_MAP[period].bucketEvery;
  return null; // raw
}

function formatDurationCompact(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function periodLabelFr(period) {
  if (period === '24h') return 'ces dernières 24h';
  if (period === '7d') return 'cette semaine';
  if (period === '30d') return 'ce mois';
  if (period === '1y') return 'cette année';
  return `la période ${period}`;
}

function classLabelFr(state) {
  if (state === 'good') return 'air sain';
  if (state === 'warning') return 'qualité moyenne';
  if (state === 'critical') return 'critique';
  return '—';
}

function rangeLabelFr(state, threshold) {
  if (state === 'good') return '< 600 ppm';
  if (state === 'warning') return `600–${threshold} ppm`;
  if (state === 'critical') return `> ${threshold} ppm`;
  return '—';
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function estimateStepMs(timeSeries) {
  if (!Array.isArray(timeSeries) || timeSeries.length < 2) return 0;
  const diffs = [];
  for (let i = 1; i < timeSeries.length; i += 1) {
    const a = new Date(timeSeries[i - 1].time).getTime();
    const b = new Date(timeSeries[i].time).getTime();
    const d = b - a;
    if (Number.isFinite(d) && d > 0) diffs.push(d);
  }
  return Math.round(median(diffs));
}

function computeDistribution(timeSeriesWithStats) {
  const counts = { good: 0, warning: 0, critical: 0, unknown: 0 };
  for (const p of timeSeriesWithStats || []) {
    const cls = p?.class || 'unknown';
    if (cls in counts) counts[cls] += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  return {
    totalPoints: total,
    good: pct(counts.good),
    warning: pct(counts.warning),
    critical: pct(counts.critical),
    unknown: pct(counts.unknown),
    counts,
  };
}

function computeHistorySegments({ timeSeriesWithStats, threshold }) {
  const ts = Array.isArray(timeSeriesWithStats) ? timeSeriesWithStats : [];
  if (ts.length === 0) return [];

  const stepMs = estimateStepMs(ts);

  const segments = [];
  let segStart = ts[0].time;
  let segClass = ts[0].class || 'unknown';
  let segMax = ts[0].ppm ?? 0;
  let segMin = ts[0].ppm ?? 0;

  const flush = (endTime) => {
    const startMs = new Date(segStart).getTime();
    const endMs = new Date(endTime).getTime();
    const durMs = Math.max(0, endMs - startMs + stepMs);
    const durSeconds = Math.round(durMs / 1000);
    segments.push({
      state: segClass,
      stateLabel: classLabelFr(segClass),
      rangeLabel: rangeLabelFr(segClass, threshold),
      start: segStart,
      end: endTime,
      durationSeconds: durSeconds,
      durationLabel: formatDurationCompact(durSeconds),
      minPpm: Math.round(segMin),
      maxPpm: Math.round(segMax),
    });
  };

  for (let i = 1; i < ts.length; i += 1) {
    const cls = ts[i].class || 'unknown';
    const ppm = ts[i].ppm ?? 0;

    if (ppm > segMax) segMax = ppm;
    if (ppm < segMin) segMin = ppm;

    if (cls !== segClass) {
      flush(ts[i - 1].time);
      segStart = ts[i].time;
      segClass = cls;
      segMax = ppm;
      segMin = ppm;
    }
  }
  flush(ts[ts.length - 1].time);

  // Most recent first for table UX
  return segments.reverse().slice(0, 20);
}

function computeTrendPpmPerHour({ timeSeriesWithStats, current }) {
  const ts = Array.isArray(timeSeriesWithStats) ? timeSeriesWithStats : [];
  if (!ts.length) return { ppmPerHour: null, deltaPpm: null };

  const last = ts[ts.length - 1];
  const lastT = new Date(last.time).getTime();
  if (!Number.isFinite(lastT)) return { ppmPerHour: null, deltaPpm: null };

  const currentVal = sanitizeNumber(current) ?? sanitizeNumber(last.ppm) ?? null;
  if (currentVal == null) return { ppmPerHour: null, deltaPpm: null };

  const targetT = lastT - 60 * 60 * 1000;
  let best = null;
  let bestDiff = Infinity;
  for (const p of ts) {
    const t = new Date(p.time).getTime();
    if (!Number.isFinite(t) || t > targetT) continue;
    const diff = Math.abs(targetT - t);
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  if (!best) return { ppmPerHour: null, deltaPpm: null };

  const refT = new Date(best.time).getTime();
  const hours = (lastT - refT) / (60 * 60 * 1000);
  if (!Number.isFinite(hours) || hours <= 0.05) return { ppmPerHour: null, deltaPpm: null };

  const delta = currentVal - (sanitizeNumber(best.ppm) ?? 0);
  const perHour = delta / hours;
  return {
    deltaPpm: Math.round(delta),
    ppmPerHour: Math.round(perHour),
  };
}

function computeRecommendationFr({ distribution, threshold, timeSeriesWithStats }) {
  const d = distribution || {};
  const criticalPct = Number(d.critical) || 0;
  const warningPct = Number(d.warning) || 0;

  if (criticalPct > 0) {
    // Find rough "peak" period (server local time)
    const buckets = { nuit: 0, matin: 0, apresMidi: 0, soir: 0 };
    for (const p of timeSeriesWithStats || []) {
      if (p.class !== 'critical') continue;
      const h = new Date(p.time).getHours();
      if (h >= 0 && h < 6) buckets.nuit += 1;
      else if (h >= 6 && h < 12) buckets.matin += 1;
      else if (h >= 12 && h < 18) buckets.apresMidi += 1;
      else buckets.soir += 1;
    }
    const bestKey = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0] || 'apresMidi';
    const label = bestKey === 'nuit'
      ? "la nuit"
      : bestKey === 'matin'
        ? "le matin"
        : bestKey === 'soir'
          ? "en soirée"
          : "l'après-midi";

    return `Augmenter la ventilation ${label} et vérifier les sources d’émission lorsque le CO₂ dépasse ${threshold} ppm.`;
  }

  if (warningPct >= 35) {
    return "Mettre en place une ventilation périodique (ex. 10 minutes/heure) et surveiller les périodes de fréquentation.";
  }

  return "Maintenir la ventilation actuelle et poursuivre la surveillance (seuils stables).";
}

async function getClassificationStats({
  period = '24h',
  threshold = 1000,
  sensorId,
  limit = 2000,
  aggregation = 'mean',
} = {}) {
  if (!isValidWindow(period)) {
    throw new HttpError(400, `Invalid period: ${period}`);
  }
  if (!sensorId || typeof sensorId !== 'string') {
    throw new HttpError(400, 'sensorId is required');
  }
  if (!isValidAggregation(aggregation)) {
    throw new HttpError(400, `Invalid aggregation: ${aggregation}`);
  }

  const safeThreshold = sanitizeNumber(threshold) ?? 1000;
  const window = WINDOW_MAP[period];
  const influxBucket = process.env.INFLUX_BUCKET || 'co2_data';
  const bucketEvery = resolveBucketEvery({ period, aggregation });

  // Bucketize so tooltip sync works on a consistent x-axis.
  // Then compute max/mean/min over the bucketed values using Flux stats().
  const baseQuery = `
    from(bucket: "${influxBucket}")
      |> range(start: ${window.start})
      |> filter(fn: (r) => r._measurement == "${MEASUREMENT}")
      |> filter(fn: (r) => r.${SENSOR_TAG} == "${sensorId}")
      |> filter(fn: (r) => r._field == "${FIELD}")
  `;

  const bucketizedQuery = bucketEvery
    ? `${baseQuery}
      |> aggregateWindow(every: ${bucketEvery}, fn: mean, createEmpty: false)
      |> keep(columns: ["_time", "_value"])
    `
    : `${baseQuery}
      |> keep(columns: ["_time", "_value"])
    `;

  const bucketizeAndStatsQuery = `
    base = ${bucketizedQuery}
    base |> stats()
  `;

  const currentQuery = `
    from(bucket: "${influxBucket}")
      |> range(start: -2h)
      |> filter(fn: (r) => r._measurement == "${MEASUREMENT}")
      |> filter(fn: (r) => r.${SENSOR_TAG} == "${sensorId}")
      |> filter(fn: (r) => r._field == "${FIELD}")
      |> last()
  `;

  const timeSeriesLimit = aggregation === 'raw'
    ? Math.max(1, Math.min(limit, 5000))
    : Math.max(1, Math.min(limit, 50000));

  const timeSeriesQuery = `
    ${bucketizedQuery}
      |> sort(columns: ["_time"])
      |> limit(n: ${timeSeriesLimit})
  `;

  let statsRows;
  let currentRows;
  let tsRows;
  try {
    [statsRows, currentRows, tsRows] = await Promise.all([
      queryFluxRows(bucketizeAndStatsQuery),
      queryFluxRows(currentQuery),
      queryFluxRows(timeSeriesQuery),
    ]);
  } catch (err) {
    throw new HttpError(500, `InfluxDB classification stats query failed: ${err.message}`);
  }

  // stats() rows: contains statistic name in column `statistic` and value in `_value`
  let max = null;
  let mean = null;
  let min = null;
  for (const r of statsRows || []) {
    const statistic = r.statistic ?? r._statistic ?? r._field;
    const val = typeof r._value === 'number' ? r._value : sanitizeNumber(r._value);
    if (val == null) continue;

    const s = String(statistic).toLowerCase();
    if (s === 'max') max = val;
    if (s === 'mean') mean = val;
    if (s === 'min') min = val;
  }

  const currentObj = Array.isArray(currentRows) && currentRows.length ? currentRows[0] : null;
  const current = currentObj ? sanitizeNumber(currentObj._value) : null;
  const currentTime = currentObj?._time ?? null;

  const timeSeries = (tsRows || [])
    .map((r, idx) => {
      const t = r._time;
      const ppm = sanitizeNumber(r._value);
      if (!t || ppm == null) return null;
      return { i: idx, time: t, ppm };
    })
    .filter(Boolean);

  // Tooltip synchronization: each hovered bucket updates left stats.
  // Because buckets are single aggregated points, max/mean/min for that hovered interval
  // equal the bucket value.
  const timeSeriesWithStats = timeSeries.map((p) => {
    const cls = classifyPpm(p.ppm, safeThreshold);
    return {
      ...p,
      class: cls,
      max: p.ppm,
      mean: p.ppm,
      min: p.ppm,
    };
  });

  const distribution = computeDistribution(timeSeriesWithStats);
  const historySegments = computeHistorySegments({ timeSeriesWithStats, threshold: safeThreshold });
  const trend = computeTrendPpmPerHour({ timeSeriesWithStats, current: current ?? 0 });

  const predominantState = ['good', 'warning', 'critical'].sort(
    (a, b) => (distribution[b] || 0) - (distribution[a] || 0)
  )[0] || 'unknown';

  const extraCritical =
    Number(distribution.critical) > 10
      ? ` Le milieu a dépassé le seuil critique pendant ${distribution.critical}% du temps.`
      : '';

  const report = {
    periodLabel: periodLabelFr(period),
    predominantState,
    predominantStateLabel: classLabelFr(predominantState),
    summary: `Le milieu a été principalement de ${classLabelFr(predominantState)} (${distribution[predominantState] || 0}% du temps) durant ${periodLabelFr(period)}.${extraCritical}`,
    recommendation: computeRecommendationFr({
      distribution,
      threshold: safeThreshold,
      timeSeriesWithStats,
    }),
  };

  return {
    sensorId,
    period,
    threshold: safeThreshold,
    aggregation,
    bucketEvery: bucketEvery || null,
    current: current ?? 0,
    currentTime,
    trend,
    stats: {
      max: max ?? 0,
      mean: mean ?? 0,
      min: min ?? 0,
      maxClass: classifyPpm(max ?? 0, safeThreshold),
      meanClass: classifyPpm(mean ?? 0, safeThreshold),
      minClass: classifyPpm(min ?? 0, safeThreshold),
    },
    distribution: {
      good: distribution.good,
      warning: distribution.warning,
      critical: distribution.critical,
      unknown: distribution.unknown,
      totalPoints: distribution.totalPoints,
    },
    history: historySegments,
    report,
    timeSeries: timeSeriesWithStats,
  };
}

module.exports = {
  getClassificationStats,
  isValidWindow,
  isValidAggregation,
};

