const positioningService = require('../services/positioningService');
const { successResponse } = require('../utils/apiResponse');
const { HttpError } = require('../utils/httpError');

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

function pickRole(req) {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  return normalizeRole(roles[0] || '');
}

async function list(req, res, next) {
  try {
    // Si l'utilisateur n'a pas de companyId (compte non rattaché), retourner liste vide
    if (!req.user?.activeCompanyId) {
      return res.json(successResponse([]));
    }
    const rows = await positioningService.listPositions(req.user);
    return res.json(successResponse(rows.map((r) => r.toJSON())));
  } catch (err) {
    // Ne pas crasher en 500 si MySQL ou companyId pose problème — retourner liste vide
    if (err.message && (err.message.includes('companyId') || err.message.includes('indisponible'))) {
      return res.json(successResponse([]));
    }
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const role = pickRole(req);
    if (!['ADMIN', 'TECHNICIAN'].includes(role)) {
      throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    }
    const row = await positioningService.createPosition(req.body, req.user);
    return res.json(successResponse(row.toJSON()));
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const role = pickRole(req);
    if (!['ADMIN', 'TECHNICIAN'].includes(role)) {
      throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    }
    await positioningService.deletePosition(req.params.id, req.user);
    return res.json(successResponse({ deleted: true }));
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /positioning/compare?ids=1,2,3
 * RBAC: ADMIN / TECHNICIAN
 */
async function compare(req, res, next) {
  try {
    const role = pickRole(req);
    if (!['ADMIN', 'TECHNICIAN'].includes(role)) {
      throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    }
    const ids = String(req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const out = await positioningService.comparePositions(ids, req.user);
    return res.json(successResponse(out));
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /positioning/finalize { positionId }
 * RBAC: ADMIN / TECHNICIAN
 */
async function finalize(req, res, next) {
  try {
    const role = pickRole(req);
    if (!['ADMIN', 'TECHNICIAN'].includes(role)) {
      throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    }
    const positionId = req.body?.positionId;
    const row = await positioningService.finalizePosition(positionId, req.user);
    return res.json(successResponse(row.toJSON()));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  create,
  remove,
  compare,
  finalize
};