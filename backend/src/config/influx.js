/**
 * =============================================================================
 * config/influx.js — FACADE DE CONNEXION INFLUXDB
 * =============================================================================
 * Couche mince : le vrai client (writeApi, queryApi) vit dans services/influxService.js.
 * Ce fichier permet d'importer connectInflux depuis `config/` comme pour MySQL,
 * pour garder une symetrie dans server.js (connectInflux / connectMySQL).
 * =============================================================================
 */

const { connectInflux: connectInfluxService, getWriteApi } = require('../services/influxService');

async function connectInflux() {
  await connectInfluxService();
}

module.exports = {
  connectInflux,
  getWriteApi
};
