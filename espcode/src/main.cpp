// =============================================================================
// main.cpp — Boucle principale du moniteur CO2 industriel
// Orchestre tous les modules : capteur, temps, réseau, MQTT, stockage SD
// =============================================================================
#include <Arduino.h>
#include "config.h"
#include "net_manager.h"
#include "time_manager.h"
#include "sensor.h"
#include "mqtt_publisher.h"
#include "sd_buffer.h"


// ─────────────────────────────────────────────────────────────────────────────
// Variables de timing pour les différents cycles
// ─────────────────────────────────────────────────────────────────────────────
// Chronomètre pour les mesures du capteur (toutes les 30 sec)
static unsigned long lastCollectMs  = 0;  // Dernier cycle de collecte capteur
// Chronomètre pour essayer d'envoyer les données SD quand réseau revient
static unsigned long lastFlushMs    = 0;  // Dernière tentative flush SD

void setup() {
    Serial.begin(115200);
    delay(300); // Stabilisation port série
    Serial.println();
    Serial.println("CO2 Monitor Industriel — Démarrage ");


    sensorInit(); // initialise le SCD30 (CO2)
    timeManagerInit(); // prépare le GPS pour avoir l’heure si internet KO
    netManagerInit(); // démarre Ethernet + WiFi (priorité Ethernet si câble détecté)

    if (netManagerIsConnected()) {
        if (!timeManagerSyncNTP()) {
            Serial.println("[SYSTEM] NTP indisponible — GPS activé comme source de temps.");
        }
    } else {
        Serial.println("[SYSTEM] Pas de réseau au démarrage — heure via GPS uniquement.");
    }

    // prépare la communication avec le serveur MQTT (mais ne bloque pas si pas de réseau)
    mqttInit();
    if (netManagerIsConnected()) {
        mqttEnsureConnected();
    }
    sdBufferInit(); // prépare le stockage local sur SD (file d’attente pour mesures si hors-ligne)

    // permet de lancer immédiatement une première mesure sans attendre le délai de collecte
    lastCollectMs = millis() - PUBLISH_INTERVAL_MS;
    Serial.println("[SYSTEM] Initialisation complète — boucle principale démarrée.");
}

void loop() {
    unsigned long now = millis();
    netManagerUpdate(); // gère les reconnexions réseau de manière non bloquante

    // Synchronisation NTP au retour de connexion
    if (netManagerStatusChanged() && netManagerIsConnected()) {
        Serial.println("[SYSTEM] Connexion rétablie — resynchronisation NTP...");
        timeManagerSyncNTP();// synchroniser l’horloge de l’ESP32 avec un serveur NTP sur Internet.
    }
    timeManagerUpdate();// lit le GPS et met à jour l’heure si NTP non dispo (non bloquant)

    // Traite les messages MQTT entrants et maintient la connexion active (keepalive)
    if (netManagerIsConnected()) {
        mqttEnsureConnected();
        mqttUpdate();
    }

    // Cycle de collecte toutes les PUBLISH_INTERVAL_MS
    if (now - lastCollectMs >= PUBLISH_INTERVAL_MS) {
        lastCollectMs = now;

        SensorData data = sensorRead();

        if (!data.valid) {
            Serial.println("[SYSTEM] Mesure non disponible — cycle reporté.");
            // On reset le timer pour réessayer dans 2 s (évite de perdre le cycle)
            lastCollectMs = now - PUBLISH_INTERVAL_MS + 2000;
            return;
        }

        time_t ts = timeManagerGetUTC();
        if (ts == 0) {
            Serial.println("[SYSTEM] AVERTISSEMENT : timestamp non fiable (0).");
            // On publie quand même avec ts=0 pour ne pas perdre la mesure
        }

        //Décision Online / Offline
        if (netManagerIsConnected() && mqttIsConnected()) {
            // Mode en ligne : publication directe MQTT
            bool ok = mqttPublish(data.co2_ppm, ts);
            if (!ok) {
                // Publication échouée → sauvegarde SD comme filet de sécurité
                Serial.println("[SYSTEM] Publication MQTT échouée — sauvegarde SD.");
                sdBufferSave(data.co2_ppm, ts);// enregistre la mesure sur la carte SD lorsque la connexion sera rétablie.
            }
        } else {
            // Mode hors-ligne : stockage SD
            Serial.println("[SYSTEM] Hors-ligne — mesure stockée sur SD.");
            sdBufferSave(data.co2_ppm, ts);
        }
    }

    // ── F. Flush SD vers MQTT (si en ligne et SD contient des données) ────────
    if (netManagerIsConnected() && mqttIsConnected() &&
        now - lastFlushMs >= FLUSH_INTERVAL_MS) {

        lastFlushMs = now;

        if (sdBufferIsReady() && sdBufferCount() > 0) {
            Serial.println("[SYSTEM] Démarrage flush SD → MQTT...");
            // On passe mqttPublish comme fonction de rappel (lambda)
            sdBufferFlush([](int co2, time_t ts) -> bool {
                return mqttPublish(co2, ts);
            });
        }
    }
    // Pause minimale (évite saturation CPU, maintien watchdog)
    delay(10);
}
