// =============================================================================
//  config.h — Paramètres globaux du système CO2 Monitor Industriel
//  À modifier selon votre installation (SSID, broker, broches GPS/ETH…)
// =============================================================================
#pragma once

#include <Arduino.h>

// ─────────────────────────────────────────────────────────────────────────────
//  IDENTITÉ DU DEVICE
// ─────────────────────────────────────────────────────────────────────────────
#define DEVICE_ID           "ESP32_CO2_01"   // Identifiant unique du nœud

// ─────────────────────────────────────────────────────────────────────────────
//  WIFI
// ─────────────────────────────────────────────────────────────────────────────
#define WIFI_SSID           "VotreSSID"
#define WIFI_PASSWORD       "VotreMotDePasse"
#define WIFI_CONNECT_TIMEOUT_MS   10000UL   // Timeout connexion initiale
#define WIFI_RETRY_DELAY_MS        5000UL   // Délai entre tentatives

// ─────────────────────────────────────────────────────────────────────────────
//  ETHERNET LAN8720 — Broches (adapter selon votre PCB)
// ─────────────────────────────────────────────────────────────────────────────
#define ETH_PHY_ADDR        0               // Adresse PHY I2C (0 ou 1)
#define ETH_PHY_TYPE        ETH_PHY_LAN8720
#define ETH_CLK_MODE        ETH_CLOCK_GPIO0_IN  // GPIO0 = source horloge REF_CLK
#define ETH_PHY_POWER       -1              // -1 = pas de pin POWER dédié
#define ETH_MDC_PIN         23
#define ETH_MDIO_PIN        18

// ─────────────────────────────────────────────────────────────────────────────
//  MQTT
// ─────────────────────────────────────────────────────────────────────────────
#define MQTT_BROKER         "192.168.1.100"
#define MQTT_PORT           1883
#define MQTT_TOPIC_DATA     "sensors/co2"
#define MQTT_TOPIC_CMD      "commands/co2_monitor"
#define MQTT_USER           ""              // Laisser vide = sans auth
#define MQTT_PASS           ""
#define MQTT_KEEPALIVE_S    60
#define MQTT_RETRY_MAX      3
#define MQTT_RETRY_DELAY_MS 3000UL

// ─────────────────────────────────────────────────────────────────────────────
//  TEMPS — NTP + POSIX Timezone
// ─────────────────────────────────────────────────────────────────────────────
#define NTP_SERVER_1        "pool.ntp.org"
#define NTP_SERVER_2        "time.nist.gov"

// Chaîne POSIX pour la Tunisie : UTC+1, pas d'heure d'été
// Format : StdOffset[Dst[Offset][,start[/time],end[/time]]]
#define POSIX_TZ_TUNISIA    "CET-1"

// ─────────────────────────────────────────────────────────────────────────────
//  GPS — Source temps de secours (UART)
// ─────────────────────────────────────────────────────────────────────────────
#define GPS_SERIAL_NUM      2               // UART2 de l'ESP32
#define GPS_BAUD            9600
#define GPS_RX_PIN          16              // GPIO16 = RX2
#define GPS_TX_PIN          17              // GPIO17 = TX2 (non utilisé en réception)
#define GPS_SYNC_TIMEOUT_MS 60000UL         // Max attente fix GPS

// ─────────────────────────────────────────────────────────────────────────────
//  CARTE SD — SPI
// ─────────────────────────────────────────────────────────────────────────────
#define SD_CS_PIN           5               // Chip Select SPI SD
#define SD_OFFLINE_FILE     "/offline.json" // Fichier de stockage hors-ligne
#define SD_MAX_FILE_BYTES   200000UL        // Limite taille fichier (~200 Ko)

// ─────────────────────────────────────────────────────────────────────────────
//  CAPTEUR SCD30
// ─────────────────────────────────────────────────────────────────────────────
#define SCD30_MEASURE_INTERVAL_S  30        // Intervalle mesure interne capteur
#define CO2_MIN_VALID_PPM         400       // Seuil bas plausible
#define CO2_MAX_VALID_PPM         10000     // Seuil haut plausible
#define CO2_ALERT_THRESHOLD_PPM   1500      // Seuil alerte qualité air
#define TEMP_MIN_VALID_C          -10.0f
#define TEMP_MAX_VALID_C           60.0f

// ─────────────────────────────────────────────────────────────────────────────
//  TIMING SYSTÈME
// ─────────────────────────────────────────────────────────────────────────────
#define PUBLISH_INTERVAL_MS       30000UL   // Période de collecte/envoi
#define NET_CHECK_INTERVAL_MS     15000UL   // Période vérification réseau
#define FLUSH_INTERVAL_MS         60000UL   // Période tentative vidage SD
