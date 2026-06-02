const optimizationService = require('../services/optimizationService');
const { successResponse } = require('../utils/apiResponse');
const { HttpError } = require('../utils/httpError');

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

function pickRole(req) {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  return normalizeRole(roles[0] || '');
}

async function status(req, res, next) {
  try {
    const payload = await optimizationService.getOptimizationStatus(req.user);
    return res.json(successResponse(payload));
  } catch (err) {
    return next(err);
  }
}

async function getPositioningHistory(req, res, next) {
  try {
    const role = pickRole(req);
    if (!['ADMIN', 'TECHNICIAN'].includes(role)) {
      throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    }
    const history = await optimizationService.getPositioningHistory(req.user);
    return res.json(successResponse(history));
  } catch (err) {
    return next(err);
  }
}

async function getPositionDetail(req, res, next) {
  try {
    const role = pickRole(req);
    if (!['ADMIN', 'TECHNICIAN'].includes(role)) {
      throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    }
    const positionId = String(req.params.positionId || '').trim();
    if (!positionId || !/^\d+$/.test(positionId)) {
      throw new HttpError(400, 'positionId invalide', 'VALIDATION_ERROR');
    }
    const detail = await optimizationService.getPositionDetail(positionId, req.user);
    return res.json(successResponse(detail));
  } catch (err) {
    return next(err);
  }
}

async function createPositioningSession(req, res, next) {
  try {
    const role = pickRole(req);
    if (!['ADMIN', 'TECHNICIAN'].includes(role)) {
      throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    }
    const session = await optimizationService.createPositioningSession(req.body, req.user);
    return res.json(successResponse(session));
  } catch (err) {
    return next(err);
  }
}

async function deletePositioningSession(req, res, next) {
  try {
    const role = pickRole(req);
    if (!['ADMIN', 'TECHNICIAN'].includes(role)) {
      throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    }
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId || !/^\d+$/.test(sessionId)) {
      throw new HttpError(400, 'sessionId invalide', 'VALIDATION_ERROR');
    }
    await optimizationService.deletePositioningSession(sessionId, req.user);
    return res.json(successResponse({ deleted: true }));
  } catch (err) {
    return next(err);
  }
}

async function getBeaconStatus(req, res, next) {
  try {
    const beacon = await optimizationService.getBeaconStatus(req.user);
    return res.json(successResponse(beacon));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  status,
  getPositioningHistory,
  getPositionDetail,
  createPositioningSession,
  deletePositioningSession,
  getBeaconStatus
};
