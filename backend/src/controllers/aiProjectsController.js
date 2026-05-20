/**
 * aiProjectsController — Catalogue des projets (Placement IA)
 */
const aiProjectsService = require('../services/aiProjectsService');
const { successResponse } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const rows = await aiProjectsService.listAiProjects(req.query, req.user);
    return res.json(successResponse(rows));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list
};

