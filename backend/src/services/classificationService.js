/**
 * =============================================================================
 * classificationService.js — Aggregation Service for Classification Page
 * =============================================================================
 * Provides real-time aggregation (max, min, mean) for CO2 classification data
 * from InfluxDB based on time period filters (24h, Semaine, Mois, Année)
 * =============================================================================
 */

const { queryHistoricalDataResilient } = require('./influxService');
const { HttpError } = require('../utils/httpError');

// Time period mapping to InfluxDB Flux syntax
const TIME_PERIOD_MAP = {
  '24h': '-24h',
  'Semaine': '-7d',
  'Mois': '-30d',
  'Année': '-365d',
};

/**
 * Validates time period parameter
 * @param {string} period - Time period key ('24h', 'Semaine', 'Mois', 'Année')
 * @returns {boolean}
 */
const isValidTimePeriod = (period) => {
  return period in TIME_PERIOD_MAP;
};

/**
 * Get aggregation statistics (max, min, mean) for a given time period
 * Queries InfluxDB for classification data with time-based filtering
 * 
 * @param {object} params
 * @param {string} params.timePeriod - Time period ('24h', 'Semaine', 'Mois', 'Année')
 * @param {string} params.bucket - InfluxDB bucket name (default: 'co2_data')
 * @param {number} params.threshold - CO2 threshold in ppm (default: 1000)
 * @returns {Promise<object>} - Aggregation results { max, min, mean, count, period }
 * @throws {HttpError}
 */
async function getClassificationAggregations(params = {}) {
  const { timePeriod = '24h', bucket = 'co2_data', threshold = 1000 } = params;

  // Validate time period
  if (!isValidTimePeriod(timePeriod)) {
    throw new HttpError(400, `Invalid time period: ${timePeriod}`);
  }

  const fluxPeriod = TIME_PERIOD_MAP[timePeriod];

  // Build Flux query with aggregation functions
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: ${fluxPeriod})
      |> filter(fn: (r) => r._measurement == "co2_readings" and r._field == "value")
      |> stats.max()
  `;

  try {
    // Execute query with timeout
    const result = await queryHistoricalDataResilient(
      fluxQuery,
      { timeout: 5000 }
    );

    // Parse results
    if (!result || result.length === 0) {
      return {
        max: 0,
        min: 0,
        mean: 0,
        count: 0,
        period: timePeriod,
        data: []
      };
    }

    // Extract aggregated values
    const values = result.map(r => Number(r.ppm)).filter(v => Number.isFinite(v));
    
    if (values.length === 0) {
      return {
        max: 0,
        min: 0,
        mean: 0,
        count: 0,
        period: timePeriod,
        data: []
      };
    }

    const max = Math.max(...values);
    const min = Math.min(...values);
    const mean = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const count = values.length;

    // Classify each aggregation
    const classifyValue = (ppm) => {
      if (ppm < 600) return 'good';
      if (ppm < threshold) return 'warning';
      return 'critical';
    };

    return {
      max,
      min,
      mean,
      count,
      period: timePeriod,
      classifications: {
        max: classifyValue(max),
        min: classifyValue(min),
        mean: classifyValue(mean),
      },
      data: result.map((p) => ({
        t: p.time || new Date().toISOString(),
        ppm: p.ppm,
        class: classifyValue(p.ppm),
      })),
    };
  } catch (error) {
    console.error('[classificationService] Aggregation query failed:', error);
    throw new HttpError(500, 'Failed to retrieve classification data');
  }
}

/**
 * Get time-series data with classification for visualization
 * 
 * @param {object} params
 * @param {string} params.timePeriod - Time period ('24h', 'Semaine', 'Mois', 'Année')
 * @param {string} params.bucket - InfluxDB bucket name
 * @param {number} params.threshold - CO2 threshold
 * @param {number} params.limit - Maximum number of data points (default: 1000)
 * @returns {Promise<array>} - Array of time-series data points
 * @throws {HttpError}
 */
async function getClassificationTimeSeries(params = {}) {
  const { timePeriod = '24h', bucket = 'co2_data', threshold = 1000, limit = 1000 } = params;

  if (!isValidTimePeriod(timePeriod)) {
    throw new HttpError(400, `Invalid time period: ${timePeriod}`);
  }

  const fluxPeriod = TIME_PERIOD_MAP[timePeriod];

  // Build Flux query for time-series data
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: ${fluxPeriod})
      |> filter(fn: (r) => r._measurement == "co2_readings" and r._field == "value")
      |> limit(n: ${limit})
  `;

  try {
    const result = await queryHistoricalDataResilient(fluxQuery, { timeout: 5000 });

    if (!result || result.length === 0) {
      return [];
    }

    // Transform data with classification
    const classifyValue = (ppm) => {
      if (ppm < 600) return 'good';
      if (ppm < threshold) return 'warning';
      return 'critical';
    };

    return result.map((point) => ({
      t: point.time || new Date().toISOString(),
      ppm: Number(point.ppm),
      class: classifyValue(Number(point.ppm)),
      timestamp: new Date(point.time || new Date()).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
  } catch (error) {
    console.error('[classificationService] Time-series query failed:', error);
    throw new HttpError(500, 'Failed to retrieve time-series data');
  }
}

/**
 * Get distribution statistics (percentage of time in each classification)
 * 
 * @param {object} params
 * @param {string} params.timePeriod
 * @param {string} params.bucket
 * @param {number} params.threshold
 * @returns {Promise<object>} - Distribution object { good, warning, critical }
 */
async function getClassificationDistribution(params = {}) {
  const { timePeriod = '24h', bucket = 'co2_data', threshold = 1000 } = params;

  try {
    const timeSeries = await getClassificationTimeSeries(params);

    if (timeSeries.length === 0) {
      return { good: 0, warning: 0, critical: 0 };
    }

    const counts = { good: 0, warning: 0, critical: 0 };
    timeSeries.forEach((p) => counts[p.class]++);

    const total = timeSeries.length;

    return {
      good: Math.round((counts.good / total) * 100),
      warning: Math.round((counts.warning / total) * 100),
      critical: Math.round((counts.critical / total) * 100),
      total,
      period: timePeriod,
    };
  } catch (error) {
    console.error('[classificationService] Distribution query failed:', error);
    throw new HttpError(500, 'Failed to retrieve classification distribution');
  }
}

module.exports = {
  getClassificationAggregations,
  getClassificationTimeSeries,
  getClassificationDistribution,
  isValidTimePeriod,
  TIME_PERIOD_MAP,
};
