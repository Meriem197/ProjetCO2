// =============================================================================
// sensor.cpp - Capteur CO2 (SCD30)
// =============================================================================
#include "sensor.h"
#include "config.h"
#include <Wire.h>
#include <cmath>
#include <SparkFun_SCD30_Arduino_Library.h>

static SCD30 scd30;
static bool sensorReady = false;

static float saturationVaporPressureHpa(float tempC) {
    return 6.112f * expf((17.62f * tempC) / (243.12f + tempC));
}

static int compensateCo2ToDryAirPpm(float co2WetPpm, float tempC, float relHumidityPct) {
    const float pressureHpa = 1013.25f;
    const float rh = constrain(relHumidityPct, 0.0f, 100.0f);
    const float pH2O = (rh / 100.0f) * saturationVaporPressureHpa(tempC);
    float xH2O = pH2O / pressureHpa;
    xH2O = constrain(xH2O, 0.0f, 0.08f);
    const float denominator = 1.0f - xH2O;
    if (denominator <= 0.001f) {
        return (int)lroundf(co2WetPpm);
    }
    return (int)lroundf(co2WetPpm / denominator);
}

void sensorInit() {
    Wire.begin();

    if (!scd30.begin()) {
        Serial.println("[SENSOR] ERREUR : SCD30 non detecte sur I2C.");
        Serial.println("[SENSOR] Le systeme continue sans capteur (pas de boucle infinie).");
        sensorReady = false;
        return;
    }

    scd30.setMeasurementInterval(SCD30_MEASURE_INTERVAL_S);
    sensorReady = true;

    Serial.printf("[SENSOR] SCD30 initialise - intervalle mesure : %d s\n", SCD30_MEASURE_INTERVAL_S);
}

SensorData sensorRead() {
    SensorData result = { 0, 0.0f, 0.0f, false };

    if (!sensorReady) {
        return result;
    }

    if (!scd30.dataAvailable()) {
        return result;
    }

    float co2 = scd30.getCO2();
    float temp = scd30.getTemperature();
    float hum = scd30.getHumidity();

    if (co2 < CO2_MIN_VALID_PPM || co2 > CO2_MAX_VALID_PPM) {
        Serial.printf("[SENSOR] CO2 hors plage : %.0f ppm - rejete.\n", co2);
        return result;
    }

    if (temp < TEMP_MIN_VALID_C || temp > TEMP_MAX_VALID_C) {
        Serial.printf("[SENSOR] Temperature hors plage : %.1f C - rejetee.\n", temp);
        return result;
    }

    if (hum < 0.0f || hum > 100.0f) {
        Serial.printf("[SENSOR] Humidite hors plage : %.1f %% - rejetee.\n", hum);
        return result;
    }

    int correctedCo2 = compensateCo2ToDryAirPpm(co2, temp, hum);

    if (correctedCo2 > CO2_ALERT_THRESHOLD_PPM) {
        Serial.printf("[SENSOR] ALERTE CO2 : %d ppm\n", correctedCo2);
    }

    result.co2_ppm = correctedCo2;
    result.temp_c = temp;
    result.humidity = hum;
    result.valid = true;

    Serial.printf("[SENSOR] CO2(corrige)=%d ppm | Temp=%.1fC | Hum=%.1f%%\n", result.co2_ppm, result.temp_c, result.humidity);

    return result;
}
