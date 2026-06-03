/**
 * =============================================================================
 * mqttHandler.js — CLIENT MQTT + PONT VERS INFLUXDB ET SOCKET.IO
 * =============================================================================
 * LECTURE RAPIDE :
 *   - C'est le point d'entree des donnees ESP32.
 *   - Un message MQTT entre => le backend le transforme => l'enregistre => le diffuse.
 *   - Ce fichier est critique pour le "temps reel".
 *
 * Role :
 *   - Se connecter au broker MQTT (ex. Mosquitto) avec URL et options de src/config/mqtt.js
 *   - S'abonner aux topics CO2 (et temperature) publies par l'embarque (ex. esp32/{id}/co2)
 *   - A chaque message : parser JSON, valider, ecrire dans InfluxDB, notifier le front en temps reel
 *   - Si CO2 >= seuil (ppm) : emettre un evenement d'alerte distinct
 *
 * Evenements Socket.io emis :
 *   - `co2:update` : chaque mesure valide (graphique temps reel)
 *   - `co2:alert`  : depassement de seuil (notification UI)
 *
 * Variables d'etat du module (closure) :
 *   reconnectAttempts / mqttConnectionFailed : limiter les reconnexions infinies si broker down
 *   mqttClient : reference au client mqtt.js pour shutdown propre
 * =============================================================================
 */

const mqtt = require('mqtt');
const { writePoint } = require('../services/influxService');
const InfluxDBBatcher = require('../services/influxBatcher');
const { persistSensorReading } = require('../services/sensorReadingService');
const { validateSensorData } = require('../utils/validators');
const {
  TOPICS,
  MAX_RECONNECT_ATTEMPTS,
  getCo2AlertThresholdPpm,
  getBrokerUrl,
  getConnectOptions
} = require('../config/mqtt');
const { normalizeMqttPayload } = require('./normalizeMessage');
const alertService = require('../services/alertService');

// Compteur incremente a chaque tentative de reconnexion automatique du client MQTT.
let reconnectAttempts = 0;
// Passe a true si on a renonce a se reconnecter (trop d'echecs) — evite de spammer le broker.
let mqttConnectionFailed = false;
// Reference globale au client : utilisee dans getMqttStatus et SIGINT.
let mqttClient = null;
// PERFORMANCE FIX 4.1: Batcher pour InfluxDB (batch 50 points toutes les 5 secondes)
let influxBatcher = null;

function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeMeasurementAliases(measurement, rawMessage) {
  if (!measurement || typeof measurement !== 'object') return measurement;

  let parsed;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return measurement;
  }

  const normalized = { ...measurement };
  const co2Value = toFiniteNumber(parsed?.co2 ?? parsed?.value);
  const temperatureValue = toFiniteNumber(parsed?.temp ?? parsed?.temperature);
  const humidityValue = toFiniteNumber(parsed?.hum ?? parsed?.humidity);

  if (!Number.isFinite(normalized.value) && co2Value !== undefined) {
    normalized.value = co2Value;
  }
  if (
    (normalized.temperature === undefined || normalized.temperature === null || !Number.isFinite(normalized.temperature)) &&
    temperatureValue !== undefined
  ) {
    normalized.temperature = temperatureValue;
  }
  if (
    (normalized.humidity === undefined || normalized.humidity === null || !Number.isFinite(normalized.humidity)) &&
    humidityValue !== undefined
  ) {
    normalized.humidity = humidityValue;
  }

  return normalized;
}

/**
 * Initialise le client MQTT et enregistre tous les ecouteurs d'evenements.
 * @param {import('socket.io').Server} io — instance Socket.io creee dans server.js
 * @param {Object} writeApi — InfluxDB writeApi pour batching (optional)
 */
function startMqttClient(io, writeApi) {
  // PERFORMANCE FIX 4.1: Initialiser le batcher InfluxDB si writeApi fourni
  if (writeApi) {
    influxBatcher = new InfluxDBBatcher(writeApi, {
      batchSize: 50,        // Flush apres 50 points
      flushInterval: 5000   // Ou apres 5 secondes
    });
  }

  // URL et options centralisees (variables d'environnement, valeurs par defaut).
  const brokerUrl = getBrokerUrl();
  const options = getConnectOptions();
  // connect() est asynchrone : les handlers .on s'enregistrent tout de suite ; la connexion arrive apres.
  mqttClient = mqtt.connect(brokerUrl, options);

  // ---------------------------------------------------------------------------
  // Evenement `connect` : connexion TCP + session MQTT etablies avec succes
  // ---------------------------------------------------------------------------
  mqttClient.on('connect', () => {
    console.log(`[mqtt] Connecte ${brokerUrl}`);
    reconnectAttempts = 0;
    mqttConnectionFailed = false;

    // QoS 1 : le broker retient le message jusqu'a acquittement (au moins une livraison).
    mqttClient.subscribe(TOPICS.CO2, { qos: 1 }, (err) => {
      if (err) console.error('[mqtt] Abonnement CO2 :', err);
      else console.log(`[mqtt] Souscrit ${Array.isArray(TOPICS.CO2) ? TOPICS.CO2.join(', ') : TOPICS.CO2}`);
    });
    mqttClient.subscribe(TOPICS.TEMP, { qos: 1 }, (err) => {
      if (!err) console.log(`[mqtt] Souscrit ${TOPICS.TEMP}`);
    });
  });

  // ---------------------------------------------------------------------------
  // Evenement `message` : une publication est arrivee sur un topic souscrit
  // ---------------------------------------------------------------------------
  mqttClient.on('message', async (topic, payload) => {
    // payload est un Buffer Node ; toString() suppose UTF-8 (JSON texte depuis l'ESP32).
    const rawMessage = payload.toString();
    console.log(`[mqtt] ${topic} ${rawMessage}`);

    try {
      const parsedMeasurement = normalizeMqttPayload(topic, rawMessage);
      const measurement = normalizeMeasurementAliases(parsedMeasurement, rawMessage);
      const sensorId = measurement.sensorId;

      const validation = validateSensorData(measurement);
      if (!validation.isValid) {
        console.warn('[mqtt] Mesure ignoree :', validation.errors);
        return;
      }

      // Influx : measurement = nom de la serie ; tags = dimensions indexees ; fields = valeurs numeriques.
      const point = {
        measurement: 'co2_readings',
        tags: { sensorId: measurement.sensorId, unit: measurement.unit },
        fields: {
          value: measurement.value,
          temperature: measurement.temperature,
          humidity: measurement.humidity,
          latitude: measurement.latitude,
          longitude: measurement.longitude,
          altitude: measurement.altitude,
          wifiRssi: measurement.wifiRssi,
          mqttStatus: measurement.mqttStatus,
          battery: measurement.battery
        },
        timestamp: measurement.timestamp
      };

      if (influxBatcher) {
        await influxBatcher.addPoint(point);
        console.log(`[mqtt] Influx queue OK sensor=${measurement.sensorId} size=${influxBatcher.queue.length}`);
      } else {
        await writePoint(point);
        console.log(`[mqtt] Influx write OK sensor=${measurement.sensorId}`);
      }

      try {
        const mysqlResult = await persistSensorReading({
          sensorUid: measurement.sensorId,
          valuePpm: measurement.value,
          temperature: measurement.temperature,
          humidity: measurement.humidity,
          timestamp: measurement.timestamp,
          topic,
          rawPayload: JSON.parse(rawMessage)
        });
        if (mysqlResult.persisted) {
          console.log(`[mysql] Insert sensor_readings OK sensor=${measurement.sensorId}`);
        } else {
          console.warn(`[mysql] Insert ignoré sensor=${measurement.sensorId} reason=${mysqlResult.reason}`);
        }
      } catch (mysqlErr) {
        console.error(`[mysql] Insert sensor_readings KO sensor=${measurement.sensorId}: ${mysqlErr.message}`);
      }

      // Broadcast : tous les navigateurs connectes sur Socket.io recoivent la meme charge utile.
      io.emit('co2:update', {
        sensorId: measurement.sensorId,
        value: measurement.value,
        temperature: measurement.temperature,
        humidity: measurement.humidity,
        battery: measurement.battery,
        wifi: measurement.wifiRssi,
        unit: measurement.unit,
        timestamp: measurement.timestamp
      });

      // Seuil lu a la volee depuis l'env (permet de changer sans redeployer si process manager recharge l'env).
      const defaultThreshold = getCo2AlertThresholdPpm();
      const alertThreshold = await alertService.resolveThresholdForSensor(measurement.sensorId, defaultThreshold);
      if (measurement.value >= alertThreshold) {
        console.warn(
          `[ALERTE CO2] ${measurement.value} ppm (seuil ${alertThreshold}) capteur ${sensorId}`
        );
        io.emit('co2:alert', {
          sensorId: measurement.sensorId,
          value: measurement.value,
          threshold: alertThreshold,
          message: `CO2 au-dela du seuil (${alertThreshold} ppm) : ${measurement.value} ppm`,
          timestamp: measurement.timestamp
        });
        const msg = `CO2 au-dela du seuil (${alertThreshold} ppm) : ${measurement.value} ppm`;
        try {
          const saved = await alertService.persistMqttAlert({
            mqttSensorId: measurement.sensorId,
            valuePpm: measurement.value,
            thresholdPpm: alertThreshold,
            message: msg
          });

          // Push en temps réel (après persistance) pour alimenter la page Alertes sans polling lourd.
          if (saved) {
            const a = saved.toJSON ? saved.toJSON() : saved;
            io.emit('alerts:new', {
              id: a.id,
              sensorId: measurement.sensorId,
              triggeredAt: a.triggeredAt,
              status: a.status,
              severity: a.severity,
              triggerValue: a.triggerValue,
              thresholdValue: a.thresholdValue,
              message: a.message
            });
          }
        } catch {
          // la persistance alerte ne doit pas casser le flux MQTT
        }
      }
    } catch (err) {
      // Ne pas faire planter le process : journaliser et ignorer ce message.
      if (err?.code === 'MQTT_INVALID_JSON') {
        console.error(`[mqtt] JSON invalide sur ${topic}:`, rawMessage);
      } else {
        console.error('[mqtt] Traitement message :', err.message);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Evenement `error` : probleme reseau, auth broker, etc.
  // ---------------------------------------------------------------------------
  mqttClient.on('error', (err) => {
    console.error(
      `[mqtt] Erreur (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`,
      err.message
    );
    // reconnectAttempts est incremente dans l'evenement `reconnect` ; quand il atteint le max, on arrete.
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS && !mqttConnectionFailed) {
      mqttConnectionFailed = true;
      console.error(`[mqtt] Abandon apres ${MAX_RECONNECT_ATTEMPTS} echecs — broker: ${brokerUrl}`);
      // end(true) : force la fermeture sans attendre les messages en vol.
      mqttClient.end(true, () => console.log('[mqtt] Client arrete'));
    }
  });

  mqttClient.on('reconnect', () => {
    reconnectAttempts++;
    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
      console.log(`[mqtt] Reconnexion ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
    }
  });

  mqttClient.on('close', () => {
    console.log(mqttConnectionFailed ? '[mqtt] Ferme (definitif)' : '[mqtt] Ferme');
  });

  mqttClient.on('offline', () => {
    console.warn('[mqtt] Offline - attente reconnexion automatique');
  });
}

// SIGINT : signal envoye par Ctrl+C dans un terminal — fermeture propre du client MQTT.
process.on('SIGINT', async () => {
  if (influxBatcher) {
    console.log('[mqtt] Flushing remaining points...');
    await influxBatcher.forceFlush();
  }
  
  if (mqttClient) {
    console.log('[mqtt] Deconnexion...');
    // end(false) : envoie un paquet DISCONNECT MQTT propre au broker.
    mqttClient.end(false, () => {
      console.log('[mqtt] OK');
      process.exit(0);
    });
  }
});

module.exports = {
  startMqttClient,
  isMqttConnectionFailed: () => mqttConnectionFailed,
  getMqttStatus: () => ({
    connected: mqttClient?.connected || false,
    connectionFailed: mqttConnectionFailed,
    reconnectAttempts,
    co2AlertThresholdPpm: getCo2AlertThresholdPpm(),
    // PERFORMANCE FIX 4.1: Include batcher stats
    batcherStats: influxBatcher ? influxBatcher.getStats() : null
  })
};
