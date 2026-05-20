/**
 * =============================================================================
 * sensorsController.js — ENDPOINTS HTTP CRUD CAPTEURS + LIAISON MQTT → SITE
 * =============================================================================
 * Un capteur est identifie en base par `mqttSensorId` (aligne sur le segment du topic MQTT).
 * POST /sensors/link : operation metier pour rattacher un flux MQTT existant a un site MySQL.
 * =============================================================================
 */

const mysqlService = require('../services/mysqlService');
const { successResponse } = require('../utils/apiResponse');

/** GET /sensors — filtres : siteId, statut, mqttSensorId (query). */
async function listSensors(req, res, next) {
  try {
    const sensors = await mysqlService.listSensors(req.query, req.user);
    return res.json(successResponse(sensors));
  } catch (err) {
    return next(err);
  }
}

/** GET /sensors/:id — :id est la cle primaire SQL (pas le mqttSensorId). */
async function getSensor(req, res, next) {
  try {
    const sensor = await mysqlService.getSensorById(Number(req.params.id), req.user);
    return res.json(successResponse(sensor));
  } catch (err) {
    return next(err);
  }
}

/** POST /sensors — creation ; mqttSensorId obligatoire dans le corps JSON. */
async function createSensor(req, res, next) {
  try {
    const sensor = await mysqlService.createSensor(req.body || {}, req.user);
    return res.status(201).json(successResponse(sensor));
  } catch (err) {
    return next(err);
  }
}

/** PUT /sensors/:id — mise a jour partielle du capteur. */
async function updateSensor(req, res, next) {
  try {
    const sensor = await mysqlService.updateSensor(Number(req.params.id), req.body || {}, req.user);
    return res.json(successResponse(sensor));
  } catch (err) {
    return next(err);
  }
}

/** DELETE /sensors/:id — suppression ligne capteur. */
async function deleteSensor(req, res, next) {
  try {
    const result = await mysqlService.deleteSensor(Number(req.params.id), req.user);
    return res.json(successResponse(result));
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /sensors/link — corps : { mqttSensorId, siteId }
 * Cree le capteur s'il n'existe pas, sinon met a jour siteId (voir mysqlService.linkSensorToSite).
 */
async function linkSensorToSite(req, res, next) {
  try {
    const { mqttSensorId, siteId } = req.body || {};
    const sensor = await mysqlService.linkSensorToSite(mqttSensorId, siteId, req.user);
    return res.json(successResponse(sensor));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listSensors,
  getSensor,
  createSensor,
  updateSensor,
  deleteSensor,
  linkSensorToSite
};
