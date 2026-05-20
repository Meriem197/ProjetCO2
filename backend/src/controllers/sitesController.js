/**
 * =============================================================================
 * sitesController.js — ENDPOINTS HTTP CRUD SUR LES SITES (MySQL / Sequelize)
 * =============================================================================
 * Chaque handler : try/catch → en cas d'erreur metier (HttpError depuis mysqlService),
 * Express appelle errorHandler. Pas de logique SQL ici : tout est delegue a mysqlService.
 * =============================================================================
 */

const mysqlService = require('../services/mysqlService');
const { successResponse } = require('../utils/apiResponse');

/** GET /sites — liste avec filtres optionnels (query string). */
async function listSites(req, res, next) {
  try {
    const sites = await mysqlService.listSites(req.query, req.user);
    return res.json(successResponse(sites));
  } catch (err) {
    return next(err);
  }
}

/** GET /sites/:id — detail + capteurs rattaches (include Sequelize). */
async function getSite(req, res, next) {
  try {
    const site = await mysqlService.getSiteById(Number(req.params.id), req.user);
    return res.json(successResponse(site));
  } catch (err) {
    return next(err);
  }
}

/** POST /sites — corps JSON = champs du site (name obligatoire cote service). */
async function createSite(req, res, next) {
  try {
    const site = await mysqlService.createSite(req.body || {}, req.user);
    return res.status(201).json(successResponse(site));
  } catch (err) {
    return next(err);
  }
}

/** PUT /sites/:id — mise a jour partielle (champs envoyes seulement). */
async function updateSite(req, res, next) {
  try {
    const site = await mysqlService.updateSite(Number(req.params.id), req.body || {}, req.user);
    return res.json(successResponse(site));
  } catch (err) {
    return next(err);
  }
}

/** DELETE /sites/:id — refuse si des capteurs sont encore lies (integrite metier). */
async function deleteSite(req, res, next) {
  try {
    const result = await mysqlService.deleteSite(Number(req.params.id), req.user);
    return res.json(successResponse(result));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listSites,
  getSite,
  createSite,
  updateSite,
  deleteSite
};
