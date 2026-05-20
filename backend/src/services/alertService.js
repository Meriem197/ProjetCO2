const { Alert, Sensor, EdgeDevice, ProductionLine, Site } = require('../models');
const { HttpError } = require('../utils/httpError');

function assertMysql() {
  if (String(process.env.MYSQL_ENABLED || 'true').toLowerCase() === 'false') {
    throw new HttpError(503, 'MySQL desactive', 'MYSQL_UNAVAILABLE');
  }
}

function resolveCompanyIdFromUserOrQuery(user, query = {}) {
  const q = query.companyId !== undefined ? Number(query.companyId) : null;
  const u = user?.activeCompanyId ? Number(user.activeCompanyId) : null;
  const companyId = q || u;
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new HttpError(400, 'companyId requis (token ou query)', 'VALIDATION_ERROR');
  }
  return companyId;
}

function computeSeverity(valuePpm, thresholdPpm) {
  const value = Number(valuePpm);
  const threshold = Number(thresholdPpm);
  if (!Number.isFinite(value) || !Number.isFinite(threshold) || threshold <= 0) return 'MEDIUM';
  const ratio = value / threshold;
  if (ratio >= 1.8) return 'CRITICAL';
  if (ratio >= 1.5) return 'HIGH';
  if (ratio >= 1.2) return 'MEDIUM';
  return 'LOW';
}

async function findSensorHierarchy(sensorUid) {
  if (!sensorUid || typeof sensorUid !== 'string') return null;
  return Sensor.findOne({
    where: { sensorUid: sensorUid.trim() },
    include: [{
      model: EdgeDevice,
      as: 'edgeDevice',
      required: false,
      include: [{
        model: ProductionLine,
        as: 'productionLine',
        required: false,
        include: [{ model: Site, as: 'site', required: false }]
      }]
    }]
  });
}

async function persistMqttAlert({ mqttSensorId, valuePpm, thresholdPpm, message }) {
  if (String(process.env.MYSQL_ENABLED || 'true').toLowerCase() === 'false') return null;

  try {
    const sensor = await findSensorHierarchy(mqttSensorId);
    if (!sensor) {
      console.warn(`[alerts] capteur inconnu pour alerte: ${mqttSensorId}`);
      return null;
    }

    const site = sensor.edgeDevice?.productionLine?.site;
    if (!site?.companyId) {
      console.warn(`[alerts] hierarchie incomplete pour capteur: ${mqttSensorId}`);
      return null;
    }

    return await Alert.create({
      companyId: site.companyId,
      siteId: site.id,
      sensorId: sensor.id,
      alertType: 'THRESHOLD_BREACH',
      severity: computeSeverity(valuePpm, thresholdPpm),
      status: 'OPEN',
      triggeredAt: new Date(),
      triggerValue: Number(valuePpm),
      thresholdValue: Number(thresholdPpm),
      message: message || null,
      metadata: { sensorUid: mqttSensorId }
    });
  } catch (err) {
    console.warn('[alerts] Persistance impossible:', err.message);
    return null;
  }
}

async function listAlerts(query = {}, user) {
  assertMysql();
  const where = { companyId: resolveCompanyIdFromUserOrQuery(user, query) };

  if (query.sensorId !== undefined && query.sensorId !== '') {
  const sensor = await findSensorHierarchy(query.sensorId);

  if (sensor) {
    where.sensorId = sensor.id;
  }
}
  if (query.status) where.status = String(query.status).toUpperCase();
  if (query.severity) where.severity = String(query.severity).toUpperCase();

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
  return Alert.findAll({
    where,
    order: [['triggered_at', 'DESC']],
    limit
  });
}

function normalizeStatus(status) {
  const s = String(status || '').trim().toUpperCase();
  if (s === 'TRAITEE') return 'RESOLVED';
  if (s === 'NON_TRAITEE') return 'OPEN';
  return s;
}

async function updateAlertStatus(id, status, user) {
  assertMysql();
  const nextStatus = normalizeStatus(status);
  if (!['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED'].includes(nextStatus)) {
    throw new HttpError(400, 'status invalide (OPEN|ACKNOWLEDGED|RESOLVED|CLOSED)', 'VALIDATION_ERROR');
  }

  const companyId = resolveCompanyIdFromUserOrQuery(user, {});
  const alert = await Alert.findOne({ where: { id, companyId } });
  if (!alert) throw new HttpError(404, 'Alerte introuvable', 'NOT_FOUND');

  const patch = { status: nextStatus };
  if (nextStatus === 'ACKNOWLEDGED') patch.acknowledgedAt = new Date();
  if (nextStatus === 'RESOLVED' || nextStatus === 'CLOSED') patch.resolvedAt = new Date();

  await alert.update(patch);
  return alert;
}

module.exports = {
  persistMqttAlert,
  listAlerts,
  updateAlertStatus
};
