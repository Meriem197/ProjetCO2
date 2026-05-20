/**
 * =============================================================================
 * config/mqtt.js — PARAMETRES MQTT CENTRALISES (LECTURE SEULE DE process.env)
 * =============================================================================
 * Interet : une seule source de verite pour le handler MQTT et les tests futurs.
 * Variables utiles dans .env :
 *   MQTT_BROKER_URL, MQTT_USERNAME, MQTT_PASSWORD
 *   MQTT_TOPIC_CO2, MQTT_TOPIC_TEMP, MQTT_TOPIC_ALL
 *   MQTT_MAX_RECONNECT_ATTEMPTS, MQTT_RECONNECT_PERIOD_MS, MQTT_CONNECT_TIMEOUT_MS
 *   CO2_ALERT_THRESHOLD (ppm, defaut 800)
 * =============================================================================
 */

function parseTopicList(rawValue, defaults) {
  if (!rawValue || typeof rawValue !== 'string') return defaults;
  const values = rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : defaults;
}

// Compatibilite montante + descendante :
// - ancien firmware: esp32/{sensorId}/co2
// - firmware PFEhard: sensors/co2 avec dev_id dans le payload
const TOPICS = {
  CO2: parseTopicList(process.env.MQTT_TOPIC_CO2, ['sensors/co2', 'esp32/+/co2']),
  TEMP: parseTopicList(process.env.MQTT_TOPIC_TEMP, ['esp32/+/temp']),
  ALL: process.env.MQTT_TOPIC_ALL || 'esp32/#'
};

// Math.max(1, ...) : evite une valeur 0 ou negative qui bloquerait toute reconnexion.
const MAX_RECONNECT_ATTEMPTS = Math.max(
  1,
  parseInt(process.env.MQTT_MAX_RECONNECT_ATTEMPTS || '3', 10) || 3
);

// Seuil par defaut du projet (ppm) ; surcharge par CO2_ALERT_THRESHOLD dans .env.
const DEFAULT_CO2_ALERT_PPM = 800;

/**
 * Retourne le seuil d'alerte CO2 en ppm (entier positif).
 * Si la variable d'environnement est absente ou invalide, on retombe sur DEFAULT_CO2_ALERT_PPM.
 */
function getCo2AlertThresholdPpm() {
  const raw = process.env.CO2_ALERT_THRESHOLD;
  if (raw === undefined || raw === '') return DEFAULT_CO2_ALERT_PPM;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CO2_ALERT_PPM;
}

/** URL du broker : mqtt:// en clair, mqtts:// si TLS configure cote broker. */
function getBrokerUrl() {
  return process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
}

/**
 * Options passees a mqtt.connect : identifiant client unique, auth optionnelle,
 * session clean (pas de messages en attente d'une ancienne session avec le meme clientId).
 */
function getConnectOptions() {
  return {
    clientId: `iot-backend-${Math.random().toString(16).slice(2, 8)}`,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clean: true,
    reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD_MS || '5000', 10) || 5000,
    connectTimeout: parseInt(process.env.MQTT_CONNECT_TIMEOUT_MS || '30000', 10) || 30000
  };
}

module.exports = {
  TOPICS,
  MAX_RECONNECT_ATTEMPTS,
  DEFAULT_CO2_ALERT_PPM,
  getCo2AlertThresholdPpm,
  getBrokerUrl,
  getConnectOptions
};
