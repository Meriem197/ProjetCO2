// =============================================================================
//  sensor.h — Capteur CO2 (SCD30)
//  Ce fichier gère la lecture du capteur via I2C
// =============================================================================
#pragma once

#include <Arduino.h>

// ─────────────────────────────────────────────────────────────────────────────
// Structure pour stocker les données du capteur
// ─────────────────────────────────────────────────────────────────────────────
struct SensorData {
    int   co2_ppm;    // Concentration CO2 en parties par million
    float temp_c;     // Température en degrés Celsius
    float humidity;   // Humidité relative en pourcentage (0-100%)
    bool  valid;      // true = données correctes, false = erreur ou pas prête
};

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions publiques pour lire le capteur
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sensorInit()
 * Initialise le capteur SCD30 au démarrage
 * Vérifications:
 *   - Bus I2C disponible
 *   - Capteur détecté et fonctionnel
 * Si capteur absent → arrêt du système (erreur critique)
 * À appeler une fois dans setup()
 */
void sensorInit();

/**
 * sensorRead()
 * Lit les données du capteur s'il y a une nouvelle mesure
 * Retourne une structure SensorData avec:
 *   - co2_ppm : la valeur CO2
 *   - temp_c : la température
 *   - humidity : l'humidité
 *   - valid : true si tout est bon, false sinon
 * Non bloquant : si capteur pas prêt → retourne valid=false
 */
SensorData sensorRead();
