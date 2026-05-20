// =============================================================================
// mqtt_publisher.cpp - Envoi des donnees CO2 via MQTT
// =============================================================================
#include "mqtt_publisher.h"
#include "config.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

static WiFiClient netClient;
static PubSubClient mqtt(netClient);
static bool mqttPermanentlyFailed = false;
static uint8_t mqttAttempts = 0;
static unsigned long nextRetryAtMs = 0;

static void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    String msg;
    for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
    Serial.printf("[MQTT] Message recu du serveur [%s] : %s\n", topic, msg.c_str());
}

void mqttInit() {
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setCallback(onMqttMessage);
    mqtt.setKeepAlive(MQTT_KEEPALIVE_S);
    mqtt.setBufferSize(256);
    Serial.printf("[MQTT] Client configure -> serveur %s:%d\n", MQTT_BROKER, MQTT_PORT);
}

void mqttUpdate() {
    if (mqtt.connected()) {
        mqtt.loop();
    }
}

bool mqttEnsureConnected() {
    if (mqtt.connected()) {
        mqttPermanentlyFailed = false;
        mqttAttempts = 0;
        return true;
    }

    if (mqttPermanentlyFailed) {
        return false;
    }

    const unsigned long now = millis();
    if (now < nextRetryAtMs) {
        return false;
    }

    Serial.printf("[MQTT] Connexion au serveur %s:%d (tentative %u/%u)...\n",
                  MQTT_BROKER, MQTT_PORT, mqttAttempts + 1, MQTT_RETRY_MAX);

    bool connected = false;
    if (strlen(MQTT_USER) > 0) {
        connected = mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS);
    } else {
        connected = mqtt.connect(DEVICE_ID);
    }

    if (connected) {
        Serial.println("[MQTT] Connecte au serveur MQTT.");
        mqtt.subscribe(MQTT_TOPIC_CMD);
        mqttPermanentlyFailed = false;
        mqttAttempts = 0;
        nextRetryAtMs = 0;
        return true;
    }

    mqttAttempts++;
    const int rc = mqtt.state();
    Serial.printf("[MQTT] Tentative %u/%u echouee - erreur: %d\n",
                  mqttAttempts, MQTT_RETRY_MAX, rc);

    if (mqttAttempts >= MQTT_RETRY_MAX) {
        Serial.println("[MQTT] Impossible de se connecter au serveur.");
        Serial.println("[MQTT] Tentatives stoppees (max 3). Redemarrez pour reessayer.");
        mqttPermanentlyFailed = true;
        return false;
    }

    nextRetryAtMs = now + MQTT_RETRY_DELAY_MS;
    return false;
}

bool mqttPublish(int co2_ppm, time_t ts_utc) {
    if (!mqtt.connected()) return false;

    StaticJsonDocument<96> doc;
    doc["dev_id"] = DEVICE_ID;
    doc["co2"] = co2_ppm;
    doc["ts"] = (unsigned long)ts_utc;

    char payload[96];
    size_t len = serializeJson(doc, payload);

    bool ok = mqtt.publish(MQTT_TOPIC_DATA, payload, len);
    if (ok) {
        Serial.printf("[MQTT] Publie -> %s : %s\n", MQTT_TOPIC_DATA, payload);
    } else {
        Serial.println("[MQTT] Publication echouee.");
    }
    return ok;
}

bool mqttIsConnected() {
    return mqtt.connected();
}
