/**
 * =============================================================================
 * validators.js — REGLES METIER SUR LES MESSAGES MQTT AVANT INFLUXDB
 * =============================================================================
 * Le firmware envoie du JSON ; on verifie types, plages et coherence avant writePoint.
 * Retour : { isValid, errors[] } pour journaliser sans exception dans mqttHandler.
 * =============================================================================
 */

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateSensorData(measurement) {
  const errors = [];

  if (!measurement || typeof measurement !== 'object') {
    return {
      isValid: false,
      errors: ['Payload de mesure invalide']
    };
  }

  if (typeof measurement.sensorId !== 'string' || measurement.sensorId.trim().length === 0) {
    errors.push('sensorId est requis');
  }

  if (!isFiniteNumber(measurement.value)) {
    errors.push('value (CO2) doit etre un nombre');
  } else if (measurement.value < 0 || measurement.value > 10000) {
    errors.push('value (CO2) hors plage acceptable (0-10000 ppm)');
  }

  if (measurement.temperature !== undefined && measurement.temperature !== null) {
    if (!isFiniteNumber(measurement.temperature) || measurement.temperature < -50 || measurement.temperature > 85) {
      errors.push('temperature hors plage acceptable (-50 a 85 C)');
    }
  }

  if (measurement.humidity !== undefined && measurement.humidity !== null) {
    if (!isFiniteNumber(measurement.humidity) || measurement.humidity < 0 || measurement.humidity > 100) {
      errors.push('humidity hors plage acceptable (0-100 %)');
    }
  }

  if (measurement.timestamp !== undefined && measurement.timestamp !== null) {
    const date = new Date(measurement.timestamp);
    if (Number.isNaN(date.getTime())) {
      errors.push('timestamp invalide');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateSensorData
};
