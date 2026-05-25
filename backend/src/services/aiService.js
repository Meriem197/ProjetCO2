/**
 * Couche IA / qualite de l'air (cahier des charges : classification, prevision).
 * - Classification : regles a seuils (en attendant modele ML entraine).
 * - Prediction : modele "smart" hybride (tendance + momentum + saisonnalite)
 *   avec intervalle de confiance empirique.
 */
const { HttpError } = require('../utils/httpError');

/**
 * Classes type « air sain / moyen / pollue » (ppm CO2 interieur courant).
 */
function classifyPpm(ppm) {
  const v = Number(ppm);
  if (!Number.isFinite(v)) {
    throw new HttpError(400, 'valeur ppm invalide', 'VALIDATION_ERROR');
  }
  if (v < 800) {
    return {
      classe: 'sain',
      label: 'Air sain',
      niveau: 'normal',
      couleur: 'vert',
      ppm: v
    };
  }
  if (v < 1000) {
    return {
      classe: 'acceptable',
      label: 'Qualite acceptable',
      niveau: 'attention',
      couleur: 'jaune',
      ppm: v
    };
  }
  if (v < 1500) {
    return {
      classe: 'moyen',
      label: 'Air moyennement charge',
      niveau: 'attention',
      couleur: 'orange',
      ppm: v
    };
  }
  return {
    classe: 'pollue',
    label: 'Air pollue — ventiler',
    niveau: 'critique',
    couleur: 'rouge',
    ppm: v
  };
}

/**
 * Regression lineaire : y = a + b*t (t en minutes depuis le premier point).
 * Extrapolation sur horizonMinutes pas de temps 1 min (aligne cahier 10–30 min).
 */
function predictLinear(points, horizonMinutes) {
  if (!points || points.length < 2) {
    throw new HttpError(400, 'Pas assez de points pour predire (min 2)', 'VALIDATION_ERROR');
  }
  const h = Math.max(5, Math.min(Number(horizonMinutes) || 30, 120));
  const vals = points.map((p) => Number(p.value)).filter((x) => Number.isFinite(x));
  const t0 = new Date(points[0].time).getTime();
  const xs = points.map((p) => (new Date(p.time).getTime() - t0) / 60000);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = vals.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (vals[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const b = den === 0 ? 0 : num / den;
  const a = meanY - b * meanX;
  const tLast = xs[n - 1];
  const tFuture = tLast + h;
  const predicted = a + b * tFuture;
  return {
    horizonMinutes: h,
    method: 'linear_regression',
    pointsUsed: n,
    predictedPpm: Math.round(predicted * 10) / 10,
    slopePpmPerMinute: Math.round(b * 1000) / 1000,
    disclaimer:
      'Prototype : entrainer un modele ML (Random Forest, etc.) pour conformite complete au cahier des charges.'
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(Math.floor((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[idx];
}

/**
 * Prediction hybride:
 * - tendance locale par regression lineaire (fenetre recente)
 * - baseline EMA (lissage)
 * - saisonnalite journaliere simple (phase horaire moyenne)
 * - intervalle de confiance base sur volatilite recente
 */
function predictSmart(points, horizonMinutes, stepMinutes = 5) {
  if (!points || points.length < 6) {
    throw new HttpError(400, 'Pas assez de points pour predire (min 6)', 'VALIDATION_ERROR');
  }

  const h = clamp(Number(horizonMinutes) || 30, 10, 120);
  const step = clamp(Number(stepMinutes) || 5, 1, 15);
  const horizonSteps = Math.ceil(h / step);

  const cleaned = points
    .map((p) => ({
      t: new Date(p.time).getTime(),
      y: Number(p.value)
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.y))
    .sort((a, b) => a.t - b.t);

  if (cleaned.length < 6) {
    throw new HttpError(400, 'Serie invalide pour prediction', 'VALIDATION_ERROR');
  }

  const n = cleaned.length;
  const last = cleaned[n - 1];

  // 1) EMA sur toute la serie (baseline stable)
  const alpha = 0.22;
  let ema = cleaned[0].y;
  for (let i = 1; i < n; i++) {
    ema = alpha * cleaned[i].y + (1 - alpha) * ema;
  }

  // 2) Tendance lineaire locale (dernieres 2-4h selon densite)
  const trendWindow = clamp(Math.floor(n * 0.35), 12, 96);
  const trendPoints = cleaned.slice(-trendWindow);
  const t0 = trendPoints[0].t;
  const xs = trendPoints.map((p) => (p.t - t0) / 60000);
  const ys = trendPoints.map((p) => p.y);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den; // ppm/min

  // 3) Volatilite recente pour l'incertitude
  const diffs = [];
  for (let i = Math.max(1, n - 60); i < n; i++) {
    diffs.push(Math.abs(cleaned[i].y - cleaned[i - 1].y));
  }
  const p50 = percentile(diffs, 0.5);
  const p90 = percentile(diffs, 0.9);
  const volatility = Math.max(8, (p50 + p90) / 2);

  // 4) Mini composante saisonniere journaliere (heure locale)
  const hourBucket = new Map();
  for (const p of cleaned.slice(-Math.min(n, 24 * 12 * 3))) {
    const hour = new Date(p.t).getHours();
    const arr = hourBucket.get(hour) || [];
    arr.push(p.y);
    hourBucket.set(hour, arr);
  }

  const forecast = [];
  for (let i = 1; i <= horizonSteps; i++) {
    const t = last.t + i * step * 60000;
    const minsAhead = i * step;
    const trendValue = last.y + slope * minsAhead;

    const hour = new Date(t).getHours();
    const seasonArr = hourBucket.get(hour) || [];
    const seasonalMean =
      seasonArr.length > 0 ? seasonArr.reduce((a, b) => a + b, 0) / seasonArr.length : ema;

    // Blend dynamique: court terme -> trend dominant ; long terme -> EMA/saisonnalite
    const horizonRatio = i / horizonSteps;
    const wTrend = 0.55 - 0.2 * horizonRatio;
    const wSeason = 0.2 + 0.15 * horizonRatio;
    const wEma = 1 - wTrend - wSeason;

    let predicted = wTrend * trendValue + wSeason * seasonalMean + wEma * ema;
    predicted = clamp(predicted, 350, 5000);

    const spread = volatility * (1 + 0.55 * Math.sqrt(i));
    const lower = clamp(predicted - spread, 300, 5000);
    const upper = clamp(predicted + spread, 300, 5000);

    forecast.push({
      t: new Date(t).toISOString(),
      ppm: Math.round(predicted),
      lower: Math.round(lower),
      upper: Math.round(upper)
    });
  }

  const predictedPpm = forecast[forecast.length - 1]?.ppm ?? Math.round(last.y);

  return {
    horizonMinutes: h,
    stepMinutes: step,
    method: 'smart_hybrid_v1',
    pointsUsed: n,
    slopePpmPerMinute: Math.round(slope * 1000) / 1000,
    volatilityPpm: Math.round(volatility),
    predictedPpm,
    forecast,
    confidence: clamp(Math.round(100 - (volatility / 2.8)), 35, 95)
  };
}

module.exports = {
  classifyPpm,
  predictLinear,
  predictSmart
};
