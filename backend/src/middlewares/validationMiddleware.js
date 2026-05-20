const { HttpError } = require('../utils/httpError');

const SENSOR_ID_REGEX = /^[\w-]+$/;

function ensureObject(payload) {
  return payload && typeof payload === 'object' ? payload : {};
}

function validateRegisterPayload(req, res, next) {
  const body = ensureObject(req.body);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role = body.role !== undefined ? String(body.role).trim().toUpperCase() : 'CLIENT';

  if (!email || !email.includes('@')) {
    return next(new HttpError(400, 'email invalide', 'VALIDATION_ERROR'));
  }
  if (password.length < 8) {
    return next(new HttpError(400, 'mot de passe requis (min 8 caracteres)', 'VALIDATION_ERROR'));
  }
  if (!['ADMIN', 'CLIENT', 'TECHNICIAN', 'TECHNICIEN', 'TECH', 'USER', 'UTILISATEUR'].includes(role)) {
    return next(new HttpError(400, 'role invalide', 'VALIDATION_ERROR'));
  }
  req.body.email = email;
  return next();
}

function validateLoginPayload(req, res, next) {
  const body = ensureObject(req.body);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !email.includes('@')) {
    return next(new HttpError(400, 'email invalide', 'VALIDATION_ERROR'));
  }
  if (!password || !String(password).trim()) {
    return next(new HttpError(400, 'mot de passe requis', 'VALIDATION_ERROR'));
  }
  req.body.email = email;
  return next();
}

function validateProfileUpdatePayload(req, res, next) {
  const body = ensureObject(req.body);
  const name = body.name;
  const email = body.email;
  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return next(new HttpError(400, 'name invalide', 'VALIDATION_ERROR'));
  }
  if (email !== undefined) {
    const normalizedEmail = typeof email === 'string' ? email.trim() : '';
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return next(new HttpError(400, 'email invalide', 'VALIDATION_ERROR'));
    }
    req.body.email = normalizedEmail;
  }
  if (newPassword !== undefined) {
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return next(new HttpError(400, 'nouveau mot de passe invalide (min 8 caracteres)', 'VALIDATION_ERROR'));
    }
    if (!currentPassword || typeof currentPassword !== 'string') {
      return next(new HttpError(400, 'currentPassword requis pour changer le mot de passe', 'VALIDATION_ERROR'));
    }
  }
  return next();
}

function validateSitePayload(req, res, next) {
  const body = ensureObject(req.body);
  if (req.method === 'POST') {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return next(new HttpError(400, 'name est requis', 'VALIDATION_ERROR'));
    }
  }
  if (body.siteCode !== undefined && body.siteCode !== null && typeof body.siteCode !== 'string') {
    return next(new HttpError(400, 'siteCode doit etre une chaine', 'VALIDATION_ERROR'));
  }
  return next();
}

function validateSensorPayload(req, res, next) {
  const body = ensureObject(req.body);
  const sensorUid = body.sensorUid || body.mqttSensorId;

  if (req.method === 'POST') {
    if (!sensorUid || typeof sensorUid !== 'string' || !sensorUid.trim()) {
      return next(new HttpError(400, 'sensorUid est requis', 'VALIDATION_ERROR'));
    }
    if (body.edgeDeviceId === undefined && body.siteId === undefined) {
      return next(new HttpError(400, 'edgeDeviceId ou siteId est requis', 'VALIDATION_ERROR'));
    }
  }

  if (sensorUid !== undefined) {
    const id = String(sensorUid).trim();
    if (!SENSOR_ID_REGEX.test(id)) {
      return next(new HttpError(400, 'sensorUid invalide (alphanumerique, _ et -)', 'VALIDATION_ERROR'));
    }
    req.body.sensorUid = id;
  }

  if (body.edgeDeviceId !== undefined && body.edgeDeviceId !== null && !Number.isFinite(Number(body.edgeDeviceId))) {
    return next(new HttpError(400, 'edgeDeviceId invalide', 'VALIDATION_ERROR'));
  }
  if (body.siteId !== undefined && body.siteId !== null && !Number.isFinite(Number(body.siteId))) {
    return next(new HttpError(400, 'siteId invalide', 'VALIDATION_ERROR'));
  }
  return next();
}

function validateLinkSensorPayload(req, res, next) {
  const body = ensureObject(req.body);
  const id = body.mqttSensorId || body.sensorUid;
  if (!id || typeof id !== 'string' || !SENSOR_ID_REGEX.test(id.trim())) {
    return next(new HttpError(400, 'sensorUid/mqttSensorId invalide', 'VALIDATION_ERROR'));
  }
  if (!Number.isFinite(Number(body.siteId))) {
    return next(new HttpError(400, 'siteId invalide', 'VALIDATION_ERROR'));
  }
  req.body.mqttSensorId = id.trim();
  return next();
}

function validateAlertPatchPayload(req, res, next) {
  const body = ensureObject(req.body);
  const status = String(body.status || body.statut || '').toUpperCase();
  const allowed = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED', 'TRAITEE', 'NON_TRAITEE'];
  if (!allowed.includes(status)) {
    return next(new HttpError(400, 'status invalide', 'VALIDATION_ERROR'));
  }
  return next();
}

module.exports = {
  validateRegisterPayload,
  validateLoginPayload,
  validateProfileUpdatePayload,
  validateSitePayload,
  validateSensorPayload,
  validateLinkSensorPayload,
  validateAlertPatchPayload
};
