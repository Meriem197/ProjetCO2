/**
 * classificationUnifiedService.js — Service API (harmonisé)
 * IMPORTANT:
 * - Pas d’URL hardcodée (localhost:3000).
 * - Utilise l’instance Axios centrale (services/api.js) qui injecte le JWT (airsense_token)
 *   et respecte VITE_API_URL ou le proxy Vite (/api → backend).
 */

import api, { unwrapApiData } from "@/services/api";

/**
 * Fetch unified classification stats + time-series (max/mean/min already aggregated in Influx).
 * Endpoint: /api/classification (alias backend)
 */
export async function fetchUnifiedClassificationStats({
  period = '24h', // 24h | semaine | mois | an
  threshold = 1000,
  filter = 'moyenne', // brutes | moyenne | agrégé
  sensorId,
} = {}) {
  const response = await api.get("/classification", {
    params: {
      period,
      threshold,
      filter,
      ...(sensorId ? { sensorId } : {}),
    },
  });
  return unwrapApiData(response.data);
}

