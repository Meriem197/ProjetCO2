/**
 * classificationService.js - Frontend API Service
 * Handles API calls to the backend classification endpoints
 */
import api, { unwrapApiData } from "@/services/api";

/**
 * Fetch aggregation statistics for classification
 * @param {string} period - Time period: '24h', 'Semaine', 'Mois', 'Année'
 * @param {number} threshold - CO2 threshold in ppm
 * @returns {Promise<object>}
 */
export async function fetchClassificationAggregations(period = '24h', threshold = 1000) {
  const response = await api.get("/classification/aggregations", { params: { period, threshold } });
  return unwrapApiData(response.data);
}

/**
 * Fetch time-series data for visualization
 * @param {string} period - Time period
 * @param {number} threshold - CO2 threshold
 * @param {number} limit - Maximum data points
 * @returns {Promise<array>}
 */
export async function fetchClassificationTimeSeries(period = '24h', threshold = 1000, limit = 1000) {
  const response = await api.get("/classification/timeseries", { params: { period, threshold, limit } });
  return unwrapApiData(response.data) || [];
}

/**
 * Fetch classification distribution
 * @param {string} period - Time period
 * @param {number} threshold - CO2 threshold
 * @returns {Promise<object>}
 */
export async function fetchClassificationDistribution(period = '24h', threshold = 1000) {
  const response = await api.get("/classification/distribution", { params: { period, threshold } });
  return unwrapApiData(response.data);
}

export default {
  fetchClassificationAggregations,
  fetchClassificationTimeSeries,
  fetchClassificationDistribution,
};
