/**
 * Liste et traitement des alertes CO2 (page Alertes du cahier des charges).
 */
const alertService = require('../services/alertService');
const { successResponse } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const rows = await alertService.listAlerts(req.query, req.user);
    return res.json(successResponse(rows));
  } catch (err) {
    return next(err);
  }
}

async function updateStatut(req, res, next) {
  try {
    const { status, statut } = req.body || {};
    const row = await alertService.updateAlertStatus(Number(req.params.id), status || statut, req.user);
    return res.json(successResponse(row));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  updateStatut
};
