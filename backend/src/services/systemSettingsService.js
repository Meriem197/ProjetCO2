const { CompanySetting } = require('../models');
const { HttpError } = require('../utils/httpError');
const { queryLastCo2Value } = require('./influxService');
const { getMqttStatus } = require('../mqtt/mqttHandler');

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

function clampInt(value, { min, max, fallback }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

async function getOrCreateSettings(companyId) {
  try {
    const [row] = await CompanySetting.findOrCreate({
      where: { companyId },
      defaults: { companyId },
      // Limiter aux colonnes connues du modèle (évite "Unknown column" si la table a des champs legacy)
      attributes: [
        'id', 'companyId', 'limitGood', 'limitWarning', 'limitCritical',
        'aiModel', 'horizonMinutes', 'samplingIntervalSeconds',
        'wifiSsid', 'mqttBrokerUrl', 'mqttTopic',
        'notifyEmail', 'notifyPush',
        'notifyWebhookSlack', 'slackWebhookUrl',
        'notifyWebhookDiscord', 'discordWebhookUrl',
        'createdAt', 'updatedAt'
      ]
    });
    return row;
  } catch (err) {
    // Fallback : si la table a des colonnes legacy inconnues du modèle (ex: company_name),
    // on tente un findOne simple avec SELECT explicite
    if (err.message && err.message.includes('Unknown column')) {
      const { sequelize } = require('../models');
      const [results] = await sequelize.query(
        `SELECT id, company_id, limit_good, limit_warning, limit_critical,
                ai_model, horizon_minutes, sampling_interval_seconds,
                wifi_ssid, mqtt_broker_url, mqtt_topic,
                notify_email, notify_push,
                notify_webhook_slack, slack_webhook_url,
                notify_webhook_discord, discord_webhook_url,
                created_at, updated_at
           FROM company_settings WHERE company_id = :companyId LIMIT 1`,
        { replacements: { companyId }, type: 'SELECT' }
      );
      if (results && results.length > 0) {
        // Retourner un objet avec les valeurs brutes mappées
        const r = results[0];
        return {
          id: r.id,
          companyId: r.company_id,
          limitGood: r.limit_good,
          limitWarning: r.limit_warning,
          limitCritical: r.limit_critical,
          aiModel: r.ai_model,
          horizonMinutes: r.horizon_minutes,
          samplingIntervalSeconds: r.sampling_interval_seconds,
          wifiSsid: r.wifi_ssid,
          mqttBrokerUrl: r.mqtt_broker_url,
          mqttTopic: r.mqtt_topic,
          notifyEmail: !!r.notify_email,
          notifyPush: !!r.notify_push,
          notifyWebhookSlack: !!r.notify_webhook_slack,
          slackWebhookUrl: r.slack_webhook_url,
          notifyWebhookDiscord: !!r.notify_webhook_discord,
          discordWebhookUrl: r.discord_webhook_url,
          update: async (patch) => {
            const setClauses = [];
            const vals = {};
            const fieldMap = {
              limitGood: 'limit_good', limitWarning: 'limit_warning', limitCritical: 'limit_critical',
              aiModel: 'ai_model', horizonMinutes: 'horizon_minutes',
              samplingIntervalSeconds: 'sampling_interval_seconds',
              wifiSsid: 'wifi_ssid', mqttBrokerUrl: 'mqtt_broker_url', mqttTopic: 'mqtt_topic',
              notifyEmail: 'notify_email', notifyPush: 'notify_push',
              notifyWebhookSlack: 'notify_webhook_slack', slackWebhookUrl: 'slack_webhook_url',
              notifyWebhookDiscord: 'notify_webhook_discord', discordWebhookUrl: 'discord_webhook_url'
            };
            for (const [k, v] of Object.entries(patch)) {
              if (fieldMap[k]) { setClauses.push(`${fieldMap[k]} = :${k}`); vals[k] = v; }
            }
            if (setClauses.length) {
              await sequelize.query(
                `UPDATE company_settings SET ${setClauses.join(', ')} WHERE company_id = :companyId`,
                { replacements: { ...vals, companyId }, type: 'UPDATE' }
              );
            }
          }
        };
      }
      // Créer une ligne par défaut
      await sequelize.query(
        `INSERT INTO company_settings (company_id) VALUES (:companyId)`,
        { replacements: { companyId } }
      );
      return getOrCreateSettings(companyId);
    }
    throw err;
  }
}

async function getSettings(query = {}, user) {
  assertMysql();
  const companyId = resolveCompanyIdFromUserOrQuery(user, query);
  const row = await getOrCreateSettings(companyId);
  return row;
}

async function updateSettings(payload = {}, user) {
  assertMysql();
  const companyId = resolveCompanyIdFromUserOrQuery(user, payload);
  const row = await getOrCreateSettings(companyId);

  const patch = {};

  if (payload.limitGood !== undefined) patch.limitGood = clampInt(payload.limitGood, { min: 350, max: 1200, fallback: row.limitGood });
  if (payload.limitWarning !== undefined) patch.limitWarning = clampInt(payload.limitWarning, { min: 600, max: 2000, fallback: row.limitWarning });
  if (payload.limitCritical !== undefined) patch.limitCritical = clampInt(payload.limitCritical, { min: 800, max: 5000, fallback: row.limitCritical });

  if (patch.limitGood >= patch.limitWarning) {
    throw new HttpError(400, 'limitGood doit etre < limitWarning', 'VALIDATION_ERROR');
  }
  if (patch.limitWarning >= patch.limitCritical) {
    throw new HttpError(400, 'limitWarning doit etre < limitCritical', 'VALIDATION_ERROR');
  }

  if (payload.aiModel !== undefined) patch.aiModel = String(payload.aiModel || '').trim() || row.aiModel;
  if (payload.horizonMinutes !== undefined) patch.horizonMinutes = clampInt(payload.horizonMinutes, { min: 10, max: 60, fallback: row.horizonMinutes });

  if (payload.samplingIntervalSeconds !== undefined) {
    patch.samplingIntervalSeconds = clampInt(payload.samplingIntervalSeconds, { min: 10, max: 3600, fallback: row.samplingIntervalSeconds });
  }
  if (payload.wifiSsid !== undefined) patch.wifiSsid = payload.wifiSsid ? String(payload.wifiSsid).trim() : null;
  if (payload.mqttBrokerUrl !== undefined) patch.mqttBrokerUrl = payload.mqttBrokerUrl ? String(payload.mqttBrokerUrl).trim() : null;
  if (payload.mqttTopic !== undefined) patch.mqttTopic = payload.mqttTopic ? String(payload.mqttTopic).trim() : null;

  if (payload.notifyEmail !== undefined) patch.notifyEmail = Boolean(payload.notifyEmail);
  if (payload.notifyPush !== undefined) patch.notifyPush = Boolean(payload.notifyPush);
  if (payload.notifyWebhookSlack !== undefined) patch.notifyWebhookSlack = Boolean(payload.notifyWebhookSlack);
  if (payload.slackWebhookUrl !== undefined) {
    patch.slackWebhookUrl = payload.slackWebhookUrl ? String(payload.slackWebhookUrl).trim() : null;
  }
  if (payload.notifyWebhookDiscord !== undefined) patch.notifyWebhookDiscord = Boolean(payload.notifyWebhookDiscord);
  if (payload.discordWebhookUrl !== undefined) {
    patch.discordWebhookUrl = payload.discordWebhookUrl ? String(payload.discordWebhookUrl).trim() : null;
  }

  await row.update(patch);
  return row;
}

async function testSensor(query = {}, user) {
  const companyId = resolveCompanyIdFromUserOrQuery(user, query);
  void companyId; // reserved for future per-company sensors

  const sensorId = typeof query.sensorId === 'string' ? query.sensorId.trim() : '';
  const mqtt = getMqttStatus();

  let last = null;
  if (sensorId) {
    try {
      last = await queryLastCo2Value(sensorId);
    } catch (_e) {}
  }

  return {
    mqtt,
    lastReading: last
      ? { time: last.time, value: Number(last.value), sensorId: last.sensorId }
      : null
  };
}

module.exports = {
  getSettings,
  updateSettings,
  testSensor
};