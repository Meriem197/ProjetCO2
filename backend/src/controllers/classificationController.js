/**
 * classificationController.js — HTTP controller for Classification unified analytics
 */

const { successResponse } = require('../utils/apiResponse');
const { HttpError } = require('../utils/httpError');
const { getClassificationStats, isValidWindow, isValidAggregation } = require('../services/classificationStatsService');
const { queryActiveSensorIds } = require('../services/influxService');

function parsePeriod(period) {
  return typeof period === 'string' ? period : '24h';
}

function parseAggregation(aggregation) {
  return typeof aggregation === 'string' ? aggregation : 'mean';
}

function parsePeriodAliasToWindow(periodRaw) {
  const p = String(periodRaw || '').trim().toLowerCase();
  if (!p) return '24h';
  if (p === '24h' || p === '24h.' || p === 'jour') return '24h';
  if (p === 'semaine' || p === 'week' || p === '7d') return '7d';
  if (p === 'mois' || p === 'month' || p === '30d') return '30d';
  if (p === 'an' || p === 'annee' || p === 'année' || p === 'year' || p === '1y') return '1y';
  return periodRaw;
}

function parseFilterAliasToAggregation(filterRaw) {
  const f = String(filterRaw || '').trim().toLowerCase();
  if (!f) return 'mean';
  if (f === 'brutes' || f === 'brut' || f === 'raw') return 'raw';
  if (f === 'moyenne' || f === 'mean') return 'mean';
  if (f === 'agrégé' || f === 'agregé' || f === 'agrege' || f === 'aggregé' || f === 'aggregate' || f === 'monthly') return 'monthly';
  return filterRaw;
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function resolveSensorIdOrFallback(requestedSensorId) {
  const clean = typeof requestedSensorId === 'string' ? requestedSensorId.trim() : '';
  if (clean) return clean;
  const active = (await queryActiveSensorIds('-30d')).filter((id) => id && id !== 'unknown');
  return active[0] || '';
}

async function getClassificationStatsEndpoint(req, res, next) {
  try {
    const period = parsePeriod(req.query.period);
    const threshold = parseNumber(req.query.threshold) ?? 1000;
    const limit = parseNumber(req.query.limit) ?? 2000;
    const aggregation = parseAggregation(req.query.aggregation);
    const requestedSensorId = typeof req.query.sensorId === 'string' ? req.query.sensorId.trim() : '';

    if (!isValidWindow(period)) {
      return next(new HttpError(400, `Invalid period: ${period}`, 'VALIDATION_ERROR'));
    }
    if (!isValidAggregation(aggregation)) {
      return next(new HttpError(400, `Invalid aggregation: ${aggregation}`, 'VALIDATION_ERROR'));
    }

    const sensorId = await resolveSensorIdOrFallback(requestedSensorId);
    if (!sensorId) {
      return next(new HttpError(404, 'Aucun capteur actif detecte dans InfluxDB', 'NO_ACTIVE_SENSOR'));
    }

    const payload = await getClassificationStats({ period, threshold, sensorId, limit, aggregation });
    return res.json(successResponse(payload, { period }));
  } catch (err) {
    return next(err);
  }
}

/**
 * Alias endpoint required by UI brief:
 * GET /api/classification?period=(24h|semaine|mois|an)&filter=(brutes|moyenne|agrégé)
 */
async function getClassificationUnifiedEndpoint(req, res, next) {
  try {
    const period = parsePeriodAliasToWindow(req.query.period);
    const aggregation = parseFilterAliasToAggregation(req.query.filter);
    const threshold = parseNumber(req.query.threshold) ?? 1000;
    const limit = parseNumber(req.query.limit) ?? 2000;
    const requestedSensorId = typeof req.query.sensorId === 'string' ? req.query.sensorId.trim() : '';

    if (!isValidWindow(period)) {
      return next(new HttpError(400, `Invalid period: ${period}`, 'VALIDATION_ERROR'));
    }
    if (!isValidAggregation(aggregation)) {
      return next(new HttpError(400, `Invalid filter: ${aggregation}`, 'VALIDATION_ERROR'));
    }

    const sensorId = await resolveSensorIdOrFallback(requestedSensorId);
    if (!sensorId) {
      return next(new HttpError(404, 'Aucun capteur actif detecte dans InfluxDB', 'NO_ACTIVE_SENSOR'));
    }

    const payload = await getClassificationStats({ period, threshold, sensorId, limit, aggregation });
    return res.json(successResponse(payload, { period }));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getClassificationStatsEndpoint,
  getClassificationUnifiedEndpoint,
};

