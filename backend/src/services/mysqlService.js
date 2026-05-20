const { Op } = require('sequelize');
const {
  Site,
  Sensor,
  Company,
  ProductionLine,
  EdgeDevice
} = require('../models');
const { HttpError } = require('../utils/httpError');

const LATENCY_BUDGET_MS = 5000;

function assertMySQLConfigured() {
  if (String(process.env.MYSQL_ENABLED || 'true').toLowerCase() === 'false') {
    throw new HttpError(503, 'MySQL desactive (MYSQL_ENABLED=false)', 'MYSQL_UNAVAILABLE');
  }
}

function mapSequelizeError(err) {
  if (err.name === 'SequelizeUniqueConstraintError') {
    return new HttpError(409, 'Contrainte d unicite violee', 'CONFLICT', err.errors);
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return new HttpError(400, 'Reference invalide (cle etrangere)', 'FK_ERROR');
  }
  if (err.name === 'SequelizeValidationError') {
    return new HttpError(400, err.message, 'VALIDATION_ERROR', err.errors);
  }
  return err;
}

async function withLatencyBudget(promise, label = 'mysql') {
  const started = Date.now();
  const result = await promise;
  const elapsed = Date.now() - started;
  if (elapsed > LATENCY_BUDGET_MS) {
    console.warn(`[PERF] ${label} a depasse ${LATENCY_BUDGET_MS}ms (${elapsed}ms)`);
  }
  return result;
}

function resolveCompanyId(scope = {}) {
  const fromPayload = scope.companyId !== undefined && scope.companyId !== null ? Number(scope.companyId) : null;
  const fromUser = scope.user?.activeCompanyId ? Number(scope.user.activeCompanyId) : null;
  const val = fromPayload || fromUser || null;
  if (!Number.isFinite(val) || val <= 0) {
    throw new HttpError(400, 'companyId requis (payload ou token)', 'VALIDATION_ERROR');
  }
  return val;
}

function normalizeSiteCode(inputName, explicitCode) {
  if (explicitCode && String(explicitCode).trim()) return String(explicitCode).trim().toUpperCase();
  return String(inputName)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

async function ensureDefaultLineAndDevice(siteId) {
  const lineCode = 'DEFAULT-LINE';
  const [line] = await ProductionLine.findOrCreate({
    where: { siteId, lineCode },
    defaults: {
      siteId,
      lineCode,
      name: 'Default Production Line',
      status: 'ACTIVE'
    }
  });

  const deviceUid = `site-${siteId}-gateway`;
  const [device] = await EdgeDevice.findOrCreate({
    where: { deviceUid },
    defaults: {
      productionLineId: line.id,
      deviceUid,
      name: `Gateway ${siteId}`,
      connectivityType: 'MQTT',
      status: 'ACTIVE'
    }
  });

  if (Number(device.productionLineId) !== Number(line.id)) {
    await device.update({ productionLineId: line.id });
  }

  return device;
}

async function assertCompanyExists(companyId) {
  const company = await Company.findByPk(companyId);
  if (!company) {
    throw new HttpError(404, 'Entreprise introuvable', 'NOT_FOUND');
  }
}

async function createSite(payload = {}, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ ...payload, user });
  await assertCompanyExists(companyId);

  const name = String(payload.name || '').trim();
  if (!name) throw new HttpError(400, 'name est requis', 'VALIDATION_ERROR');

  const siteCode = normalizeSiteCode(name, payload.siteCode || payload.code);
  if (!siteCode) throw new HttpError(400, 'siteCode invalide', 'VALIDATION_ERROR');

  try {
    const site = await withLatencyBudget(
      Site.create({
        companyId,
        siteCode,
        name,
        countryCode: payload.countryCode || null,
        city: payload.city || null,
        addressLine1: payload.addressLine1 || payload.localisation || null,
        addressLine2: payload.addressLine2 || null,
        postalCode: payload.postalCode || null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        status: payload.status || 'ACTIVE'
      }),
      'createSite'
    );

    await ensureDefaultLineAndDevice(site.id);
    return getSiteById(site.id, user);
  } catch (err) {
    throw mapSequelizeError(err);
  }
}

async function getSiteById(id, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ user });
  const site = await withLatencyBudget(
    Site.findOne({
      where: { id, companyId },
      include: [
        {
          model: ProductionLine,
          as: 'productionLines',
          include: [{ model: EdgeDevice, as: 'edgeDevices', include: [{ model: Sensor, as: 'sensors' }] }]
        }
      ]
    }),
    'getSiteById'
  );
  if (!site) throw new HttpError(404, 'Site introuvable', 'NOT_FOUND');
  return site;
}

async function listSites(query = {}, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ ...query, user });
  const where = { companyId };

  if (query.status) where.status = String(query.status).toUpperCase();
  if (query.search && typeof query.search === 'string' && query.search.trim()) {
    const s = `%${query.search.trim()}%`;
    where[Op.or] = [{ name: { [Op.like]: s } }, { siteCode: { [Op.like]: s } }, { city: { [Op.like]: s } }];
  }

  return withLatencyBudget(
    Site.findAll({
      where,
      order: [['name', 'ASC']],
      include: [
        {
          model: ProductionLine,
          as: 'productionLines',
          required: false,
          include: [{ model: EdgeDevice, as: 'edgeDevices', required: false }]
        }
      ]
    }),
    'listSites'
  );
}

async function updateSite(id, payload = {}, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ ...payload, user });

  const site = await Site.findOne({ where: { id, companyId } });
  if (!site) throw new HttpError(404, 'Site introuvable', 'NOT_FOUND');

  const patch = {};
  if (payload.name !== undefined) patch.name = String(payload.name).trim();
  if (payload.siteCode !== undefined || payload.code !== undefined) {
    patch.siteCode = normalizeSiteCode(site.name, payload.siteCode || payload.code);
  }
  if (payload.countryCode !== undefined) patch.countryCode = payload.countryCode || null;
  if (payload.city !== undefined) patch.city = payload.city || null;
  if (payload.addressLine1 !== undefined || payload.localisation !== undefined) {
    patch.addressLine1 = payload.addressLine1 || payload.localisation || null;
  }
  if (payload.addressLine2 !== undefined) patch.addressLine2 = payload.addressLine2 || null;
  if (payload.postalCode !== undefined) patch.postalCode = payload.postalCode || null;
  if (payload.latitude !== undefined) patch.latitude = payload.latitude;
  if (payload.longitude !== undefined) patch.longitude = payload.longitude;
  if (payload.status !== undefined) patch.status = String(payload.status).toUpperCase();

  try {
    await site.update(patch);
    return getSiteById(site.id, user);
  } catch (err) {
    throw mapSequelizeError(err);
  }
}

async function deleteSite(id, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ user });

  const site = await Site.findOne({
    where: { id, companyId },
    include: [
      {
        model: ProductionLine,
        as: 'productionLines',
        include: [{ model: EdgeDevice, as: 'edgeDevices', include: [{ model: Sensor, as: 'sensors' }] }]
      }
    ]
  });

  if (!site) throw new HttpError(404, 'Site introuvable', 'NOT_FOUND');

  await site.destroy();
  return { deleted: true, id };
}

async function resolveEdgeDeviceOwnership(edgeDeviceId, companyId) {
  const device = await EdgeDevice.findOne({
    where: { id: edgeDeviceId },
    include: [{
      model: ProductionLine,
      as: 'productionLine',
      required: true,
      include: [{ model: Site, as: 'site', required: true, where: { companyId } }]
    }]
  });
  if (!device) throw new HttpError(404, 'Edge device introuvable pour cette entreprise', 'NOT_FOUND');
  return device;
}

async function createSensor(payload = {}, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ ...payload, user });

  const sensorUid = String(payload.sensorUid || payload.mqttSensorId || '').trim();
  if (!sensorUid) throw new HttpError(400, 'sensorUid requis', 'VALIDATION_ERROR');

  let edgeDeviceId = payload.edgeDeviceId !== undefined && payload.edgeDeviceId !== null ? Number(payload.edgeDeviceId) : null;

  if (!edgeDeviceId && payload.siteId) {
    const site = await Site.findOne({ where: { id: Number(payload.siteId), companyId } });
    if (!site) throw new HttpError(404, 'siteId invalide pour cette entreprise', 'NOT_FOUND');
    const dev = await ensureDefaultLineAndDevice(site.id);
    edgeDeviceId = Number(dev.id);
  }

  if (!edgeDeviceId) {
    throw new HttpError(400, 'edgeDeviceId (ou siteId) requis', 'VALIDATION_ERROR');
  }

  await resolveEdgeDeviceOwnership(edgeDeviceId, companyId);

  try {
    return await withLatencyBudget(
      Sensor.create({
        edgeDeviceId,
        sensorUid,
        name: String(payload.name || sensorUid).trim(),
        sensorType: String(payload.sensorType || payload.type || 'CO2').toUpperCase(),
        unitDefault: payload.unitDefault || 'ppm',
        samplingIntervalMs: Number(payload.samplingIntervalMs || 5000),
        calibrationOffset: Number(payload.calibrationOffset || 0),
        calibrationScale: Number(payload.calibrationScale || 1),
        installedAt: payload.installedAt || null,
        status: String(payload.status || payload.statut || 'ACTIVE').toUpperCase()
      }),
      'createSensor'
    );
  } catch (err) {
    throw mapSequelizeError(err);
  }
}

async function getSensorById(id, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ user });
  const sensor = await withLatencyBudget(
    Sensor.findOne({
      where: { id },
      include: [{
        model: EdgeDevice,
        as: 'edgeDevice',
        required: true,
        include: [{
          model: ProductionLine,
          as: 'productionLine',
          required: true,
          include: [{ model: Site, as: 'site', required: true, where: { companyId } }]
        }]
      }]
    }),
    'getSensorById'
  );
  if (!sensor) throw new HttpError(404, 'Capteur introuvable', 'NOT_FOUND');
  return sensor;
}

async function getSensorByMqttId(sensorUid, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ user });
  if (!sensorUid || typeof sensorUid !== 'string') return null;
  return withLatencyBudget(
    Sensor.findOne({
      where: { sensorUid: sensorUid.trim() },
      include: [{
        model: EdgeDevice,
        as: 'edgeDevice',
        required: true,
        include: [{
          model: ProductionLine,
          as: 'productionLine',
          required: true,
          include: [{ model: Site, as: 'site', required: true, where: { companyId } }]
        }]
      }]
    }),
    'getSensorByMqttId'
  );
}

async function listSensors(query = {}, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ ...query, user });

  const where = {};
  if (query.status || query.statut) where.status = String(query.status || query.statut).toUpperCase();
  if (query.sensorUid || query.mqttSensorId) where.sensorUid = String(query.sensorUid || query.mqttSensorId).trim();

  const siteFilter = query.siteId ? { id: Number(query.siteId), companyId } : { companyId };

  return withLatencyBudget(
    Sensor.findAll({
      where,
      order: [['sensorUid', 'ASC']],
      include: [{
        model: EdgeDevice,
        as: 'edgeDevice',
        required: true,
        include: [{
          model: ProductionLine,
          as: 'productionLine',
          required: true,
          include: [{ model: Site, as: 'site', required: true, where: siteFilter }]
        }]
      }]
    }),
    'listSensors'
  );
}

async function updateSensor(id, payload = {}, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ ...payload, user });
  const sensor = await getSensorById(id, user);

  const patch = {};
  if (payload.sensorUid !== undefined || payload.mqttSensorId !== undefined) {
    patch.sensorUid = String(payload.sensorUid || payload.mqttSensorId).trim();
  }
  if (payload.name !== undefined) patch.name = String(payload.name || '').trim();
  if (payload.sensorType !== undefined || payload.type !== undefined) {
    patch.sensorType = String(payload.sensorType || payload.type).toUpperCase();
  }
  if (payload.unitDefault !== undefined) patch.unitDefault = payload.unitDefault || null;
  if (payload.samplingIntervalMs !== undefined) patch.samplingIntervalMs = Number(payload.samplingIntervalMs);
  if (payload.calibrationOffset !== undefined) patch.calibrationOffset = Number(payload.calibrationOffset);
  if (payload.calibrationScale !== undefined) patch.calibrationScale = Number(payload.calibrationScale);
  if (payload.installedAt !== undefined) patch.installedAt = payload.installedAt;
  if (payload.status !== undefined || payload.statut !== undefined) {
    patch.status = String(payload.status || payload.statut).toUpperCase();
  }

  if (payload.edgeDeviceId !== undefined && payload.edgeDeviceId !== null) {
    const edgeDeviceId = Number(payload.edgeDeviceId);
    await resolveEdgeDeviceOwnership(edgeDeviceId, companyId);
    patch.edgeDeviceId = edgeDeviceId;
  }

  try {
    await sensor.update(patch);
    return getSensorById(sensor.id, user);
  } catch (err) {
    throw mapSequelizeError(err);
  }
}

async function deleteSensor(id, user) {
  assertMySQLConfigured();
  const sensor = await getSensorById(id, user);
  await sensor.destroy();
  return { deleted: true, id };
}

async function linkSensorToSite(mqttSensorId, siteId, user) {
  assertMySQLConfigured();
  const companyId = resolveCompanyId({ user });
  const sensorUid = String(mqttSensorId || '').trim();
  if (!sensorUid) throw new HttpError(400, 'mqttSensorId est requis', 'VALIDATION_ERROR');

  const site = await Site.findOne({ where: { id: Number(siteId), companyId } });
  if (!site) throw new HttpError(404, 'Site introuvable', 'NOT_FOUND');

  const device = await ensureDefaultLineAndDevice(site.id);
  let sensor = await Sensor.findOne({ where: { sensorUid } });

  if (!sensor) {
    sensor = await Sensor.create({
      edgeDeviceId: device.id,
      sensorUid,
      name: sensorUid,
      sensorType: 'CO2',
      unitDefault: 'ppm',
      status: 'ACTIVE'
    });
  } else {
    await sensor.update({ edgeDeviceId: device.id, status: 'ACTIVE' });
  }

  return getSensorById(sensor.id, user);
}

function toPlainSensorWithSite(sensorInstance) {
  if (!sensorInstance) return null;
  return sensorInstance.toJSON ? sensorInstance.toJSON() : sensorInstance;
}

async function getSensorMetadataForHistory(sensorUid) {
  if (String(process.env.MYSQL_ENABLED || 'true').toLowerCase() === 'false') return null;
  if (!sensorUid || typeof sensorUid !== 'string') return null;

  try {
    const row = await withLatencyBudget(
      Sensor.findOne({
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
      }),
      'getSensorMetadataForHistory'
    );
    return toPlainSensorWithSite(row);
  } catch (err) {
    console.warn('[mysql] Metadonnees capteur indisponibles:', err.message);
    return null;
  }
}

module.exports = {
  createSite,
  getSiteById,
  listSites,
  updateSite,
  deleteSite,
  createSensor,
  getSensorById,
  getSensorByMqttId,
  listSensors,
  updateSensor,
  deleteSensor,
  linkSensorToSite,
  toPlainSensorWithSite,
  getSensorMetadataForHistory,
  LATENCY_BUDGET_MS
};
