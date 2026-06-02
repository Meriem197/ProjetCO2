/**
 * =============================================================================
 * dataController.js — COUCHE HTTP POUR LES DONNEES CO2 + STATUT API
 * =============================================================================
 * LECTURE RAPIDE :
 *   - Recoit les requetes HTTP du frontend (req)
 *   - Appelle les services (Influx/MySQL)
 *   - Retourne une reponse JSON uniforme
 *
 * Principe MVC : le routeur (api.js) delegue a ces fonctions ; elles lisent req,
 * appellent les services (Influx, MySQL), ecrivent res ou passent l'erreur a `next(err)`.
 *
 * Convention des reponses : successResponse / erreurs via HttpError + errorHandler global.
 * =============================================================================
 */

const {
  queryHistoricalDataResilient,
  queryLatestSensorTelemetry,
  queryActiveSensorIds
} = require('../services/influxService');
const { listRecentSensorUidsFromMySQL } = require('../services/sensorResolver');
const mysqlService = require('../services/mysqlService');
const classificationService = require('../services/classificationService');
const { resolveSensorId, isValidSensorId } = require('../services/sensorResolver');
const { successResponse } = require('../utils/apiResponse');
const { HttpError } = require('../utils/httpError');

// Budget temps aligne sur mysqlService (cahier des charges : latence capteur→affichage raisonnable).
const LATENCY_TARGET_MS = mysqlService.LATENCY_BUDGET_MS || 5000;

/**
 * Valide le parametre Flux `start` passe a Influx (evite injection dans la requete Flux).
 * Exemples valides : -24h, -7d, -30m, -1w
 * @param {string} value
 * @returns {boolean}
 */
function isValidStartRange(value) {
  return /^-\d+(ms|s|m|h|d|w)$/.test(value);
}


/**
 * GET /co2/history?sensorId=...&start=-24h
 * - sensorId : doit correspondre au tag Influx (meme identifiant que dans le topic MQTT).
 * - start : plage relative Flux ; defaut -24h.
 * Promise.all : interroge Influx et MySQL en parallele pour reduire la latence totale.
 */
async function getCo2History(req, res, next) {
  // req.query contient les parametres d'URL ; on normalise en string trim.
  const requestedSensorId = typeof req.query.sensorId === 'string' ? req.query.sensorId.trim() : '';
  const start = typeof req.query.start === 'string' ? req.query.start.trim() : '-24h';

  if (!isValidStartRange(start)) {
    return next(new HttpError(400, 'Parametre start invalide (exemple: -24h, -7d)', 'VALIDATION_ERROR'));
  }

  try {
    const primarySensorId = await resolveSensorId(requestedSensorId);
    const influxCandidates = (await queryActiveSensorIds('-30d')).filter((id) => id && id !== 'unknown');
    const mysqlCandidates = await listRecentSensorUidsFromMySQL(10);

    const candidates = [
      requestedSensorId,
      primarySensorId,
      ...mysqlCandidates,
      ...influxCandidates
    ]
      .map((id) => String(id || '').trim())
      .filter((id, idx, arr) => id && isValidSensorId(id) && arr.indexOf(id) === idx)
      .slice(0, 8);

    if (candidates.length === 0) {
      return res.json(
        successResponse([], {
          sensorId: null,
          start,
          count: 0,
          sensor: null,
          telemetry: null,
          hint: 'NO_SENSOR'
        })
      );
    }

    const t0 = Date.now();
    let selectedSensorId = candidates[0];
    let data = [];
    let usedStart = start;
    for (const candidate of candidates) {
      const rows = await queryHistoricalDataResilient(candidate, start);
      if (Array.isArray(rows) && rows.length > 0) {
        selectedSensorId = candidate;
        data = rows;
        break;
      }
    }

    // Fallback: si la fenêtre demandée est vide (souvent -24h),
    // élargir pour récupérer un historique exploitable côté UI.
    if (data.length === 0 && start === '-24h') {
      for (const candidate of candidates) {
        const rows = await queryHistoricalDataResilient(candidate, '-30d');
        if (Array.isArray(rows) && rows.length > 0) {
          selectedSensorId = candidate;
          // Garde une fenêtre raisonnable pour le front (288 points ~24h à 5 min)
          data = rows.slice(-288);
          usedStart = '-30d';
          break;
        }
      }
    }

    const [sensor, telemetry] = await Promise.all([
      mysqlService.getSensorMetadataForHistory(selectedSensorId),
      queryLatestSensorTelemetry(selectedSensorId).catch(() => null)
    ]);
    const latencyMs = Date.now() - t0;
    if (latencyMs > LATENCY_TARGET_MS) {
      console.warn(`[PERF] getCo2History ${latencyMs}ms (seuil ${LATENCY_TARGET_MS}ms)`);
    }
    return res.json(
      successResponse(data, {
        sensorId: selectedSensorId,
        start: usedStart,
        count: data.length,
        sensor,
        telemetry,
        candidatesTried: candidates.length,
        latencyMs
      })
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * GET / ou GET /status — simple signal que l'API repond (sans tester les BDD ici).
 */
function getApiStatus(req, res) {
  return res.json(
    successResponse({
      status: 'ok',
      service: 'backendPFE',
      timestamp: new Date().toISOString()
    })
  );
}

async function getActiveSensors(req, res, next) {
  try {
    const influxIds = (await queryActiveSensorIds('-30d')).filter((id) => id && id !== 'unknown');
    const mysqlIds = await listRecentSensorUidsFromMySQL(10);
    const merged = [...new Set([...mysqlIds, ...influxIds])];
    return res.json(successResponse(merged, { count: merged.length }));
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /classification/aggregations?period=24h&threshold=1000
 * Returns aggregation statistics (max, min, mean) for classification
 * Period options: '24h', 'Semaine', 'Mois', 'Année'
 */
async function getClassificationAggregations(req, res, next) {
  try {
    const timePeriod = req.query.period || '24h';
    const threshold = parseInt(req.query.threshold, 10) || 1000;

    // Validate period
    if (!classificationService.isValidTimePeriod(timePeriod)) {
      return next(new HttpError(400, `Invalid period: ${timePeriod}. Valid options: 24h, Semaine, Mois, Année`, 'VALIDATION_ERROR'));
    }

    const aggregations = await classificationService.getClassificationAggregations({
      timePeriod,
      threshold,
      bucket: 'co2_data',
    });

    return res.json(successResponse(aggregations, { period: timePeriod }));
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /classification/timeseries?period=24h&threshold=1000&limit=1000
 * Returns time-series data with classification for visualization
 */
async function getClassificationTimeSeries(req, res, next) {
  try {
    const timePeriod = req.query.period || '24h';
    const threshold = parseInt(req.query.threshold, 10) || 1000;
    const limit = parseInt(req.query.limit, 10) || 1000;

    if (!classificationService.isValidTimePeriod(timePeriod)) {
      return next(new HttpError(400, `Invalid period: ${timePeriod}`, 'VALIDATION_ERROR'));
    }

    if (limit < 1 || limit > 10000) {
      return next(new HttpError(400, 'Limit must be between 1 and 10000', 'VALIDATION_ERROR'));
    }

    const timeSeries = await classificationService.getClassificationTimeSeries({
      timePeriod,
      threshold,
      limit,
      bucket: 'co2_data',
    });

    return res.json(successResponse(timeSeries, {
      period: timePeriod,
      count: timeSeries.length,
      threshold,
    }));
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /classification/distribution?period=24h&threshold=1000
 * Returns percentage distribution of CO2 classifications
 */
async function getClassificationDistribution(req, res, next) {
  try {
    const timePeriod = req.query.period || '24h';
    const threshold = parseInt(req.query.threshold, 10) || 1000;

    if (!classificationService.isValidTimePeriod(timePeriod)) {
      return next(new HttpError(400, `Invalid period: ${timePeriod}`, 'VALIDATION_ERROR'));
    }

    const distribution = await classificationService.getClassificationDistribution({
      timePeriod,
      threshold,
      bucket: 'co2_data',
    });

    return res.json(successResponse(distribution, { period: timePeriod }));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getCo2History,
  getApiStatus,
  getActiveSensors,
  getClassificationAggregations,
  getClassificationTimeSeries,
  getClassificationDistribution,
};
