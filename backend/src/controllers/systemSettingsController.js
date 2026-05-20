const systemSettingsService = require('../services/systemSettingsService');
const { successResponse } = require('../utils/apiResponse');
const { HttpError } = require('../utils/httpError');

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

function pickRole(req) {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  return normalizeRole(roles[0] || '');
}

function toPlain(row) {
  if (!row) return null;
  if (typeof row.toJSON === 'function') return row.toJSON();
  return row;
}

function filterSettingsForRole(settings, role) {
  const r = normalizeRole(role);
  if (r === 'CLIENT') {
    // Client: lecture seule sur notifications + infos neutres
    return {
      notifyEmail: settings.notifyEmail,
      notifyPush: settings.notifyPush,
      notifyWebhookSlack: settings.notifyWebhookSlack,
      slackWebhookUrl: settings.slackWebhookUrl,
      notifyWebhookDiscord: settings.notifyWebhookDiscord,
      discordWebhookUrl: settings.discordWebhookUrl
    };
  }
  // Admin & Technicien: visualisation complète
  return settings;
}

/**
 * GET /settings
 * RBAC:
 * - ADMIN/TECHNICIAN: full view
 * - CLIENT: notifications-only view
 */
async function getSettings(req, res, next) {
  try {
    const row = await systemSettingsService.getSettings(req.query, req.user);
    const settings = toPlain(row);
    const role = pickRole(req);
    return res.json(successResponse(filterSettingsForRole(settings, role)));
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /settings
 * RBAC:
 * - ADMIN: full write
 * - TECHNICIAN: write IoT + notifications (no thresholds/AI)
 */
async function updateSettings(req, res, next) {
  try {
    const role = pickRole(req);
    const payload = req.body || {};

    if (normalizeRole(role) === 'TECHNICIAN') {
      const forbidden = ['limitGood', 'limitWarning', 'limitCritical', 'aiModel', 'horizonMinutes'];
      const touched = forbidden.filter((k) => payload[k] !== undefined);
      if (touched.length) {
        throw new HttpError(403, `Technicien: modification interdite (${touched.join(', ')})`, 'FORBIDDEN');
      }
    }

    const row = await systemSettingsService.updateSettings(payload, req.user);
    const settings = toPlain(row);
    return res.json(successResponse(filterSettingsForRole(settings, role)));
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /settings/sensor-test?sensorId=...
 * Utilisé par “Ping Capteur”.
 */
async function sensorTest(req, res, next) {
  try {
    const report = await systemSettingsService.testSensor(req.query, req.user);
    return res.json(successResponse(report));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
  sensorTest
};

