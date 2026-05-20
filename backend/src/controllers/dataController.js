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

const { queryHistoricalDataResilient, queryActiveSensorIds } = require('../services/influxService');
const mysqlService = require('../services/mysqlService');
const classificationService = require('../services/classificationService');
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

/** Identifiant capteur alphanumerique + _ - (evite injection dans les requetes Flux). */
function isValidSensorId(value) {
  return typeof value === 'string' && /^[\w-]+$/.test(value);
}

async function resolveSensorIdOrFallback(requestedSensorId) {
  const clean = typeof requestedSensorId === 'string' ? requestedSensorId.trim() : '';
  if (clean) return clean;
  const active = (await queryActiveSensorIds('-30d')).filter((id) => id && id !== 'unknown');
  return active[0] || '';
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
    const sensorId = await resolveSensorIdOrFallback(requestedSensorId);
    if (!sensorId) return next(new HttpError(404, 'Aucun capteur actif detecte dans InfluxDB', 'NO_ACTIVE_SENSOR'));
    if (!isValidSensorId(sensorId)) {
      return next(
        new HttpError(400, 'sensorId invalide (lettres, chiffres, tirets et underscores)', 'VALIDATION_ERROR')
      );
    }
    const t0 = Date.now();
    const [data, sensor] = await Promise.all([
      queryHistoricalDataResilient(sensorId, start),
      mysqlService.getSensorMetadataForHistory(sensorId)
    ]);
    const latencyMs = Date.now() - t0;
    if (latencyMs > LATENCY_TARGET_MS) {
      console.warn(`[PERF] getCo2History ${latencyMs}ms (seuil ${LATENCY_TARGET_MS}ms)`);
    }
    // `data` : tableau de points { time, value, sensorId } ; `sensor` : metadonnees MySQL ou null.
    return res.json(
      successResponse(data, {
        sensorId,
        start,
        count: data.length,
        sensor,
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
    const ids = (await queryActiveSensorIds('-30d')).filter((id) => id && id !== 'unknown');
    return res.json(successResponse(ids, { count: ids.length }));
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
