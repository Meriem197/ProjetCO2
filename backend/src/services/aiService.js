/**
 * Couche IA / qualite de l'air (cahier des charges : classification, prevision).
 * - Classification : regles a seuils (en attendant modele ML entraine).
 * - Prediction : regression lineaire simple sur les derniers points Influx (prototype).
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

module.exports = {
  classifyPpm,
  predictLinear
};
