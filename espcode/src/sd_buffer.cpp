// =============================================================================
//  sd_buffer.cpp — Stockage hors-ligne sur carte SD + envoi des données
//
//  Format du fichier offline.json : une ligne par ligne (JSONL)
//  Chaque ligne = {"co2":850,"ts":1718000000}
// =============================================================================
#include "sd_buffer.h"
#include "config.h"

#include <SD.h>
#include <ArduinoJson.h>
#include <functional>

// ─────────────────────────────────────────────────────────────────────────────
// Variables internes (privées)
// ─────────────────────────────────────────────────────────────────────────────
static bool sdReady = false;

bool sdBufferInit() {
    if (!SD.begin(SD_CS_PIN)) {
        Serial.println("[SD] ATTENTION : carte SD non trouvée.");
        Serial.println("[SD] Mode hors-ligne désactivé — les données seront perdues sans internet.");
        sdReady = false;
        return false;
    }

    uint64_t cardSize = SD.cardSize() / (1024 * 1024);
    Serial.printf("[SD] Carte SD OK — capacité: %llu Mo\n", cardSize);

    if (!SD.exists(SD_OFFLINE_FILE)) {
        File f = SD.open(SD_OFFLINE_FILE, FILE_WRITE);
        if (f) {
            f.close();
            Serial.println("[SD] Fichier offline.json créé.");
        }
    }

    int count = sdBufferCount();
    if (count > 0) {
        Serial.printf("[SD] %d record(s) en attente d'envoi.\n", count);
    }

    sdReady = true;
    return true;
}

bool sdBufferSave(int co2_ppm, time_t ts_utc) {
    if (!sdReady) {
        Serial.println("[SD] ERREUR : SD non disponible — mesure perdue.");
        return false;
    }

    if (SD.exists(SD_OFFLINE_FILE)) {
        File check = SD.open(SD_OFFLINE_FILE, FILE_READ);
        if (check) {
            size_t sz = check.size();
            check.close();
            if (sz >= SD_MAX_FILE_BYTES) {
                Serial.println("[SD] ATTENTION : fichier offline.json plein — mesure ignorée.");
                return false;
            }
        }
    }

    StaticJsonDocument<64> doc;
    doc["co2"] = co2_ppm;
    doc["ts"]  = (unsigned long)ts_utc;

    char line[64];
    size_t len = serializeJson(doc, line);
    line[len]  = '\n';
    len++;

    File f = SD.open(SD_OFFLINE_FILE, FILE_APPEND);
    if (!f) {
        Serial.println("[SD] ERREUR : impossible d'ouvrir offline.json.");
        return false;
    }

    size_t written = f.write((uint8_t*)line, len);
    f.close();

    if (written == len) {
        Serial.printf("[SD] Mesure sauvegardée : CO2=%d ppm, ts=%lu\n",
                      co2_ppm, (unsigned long)ts_utc);
        return true;
    }

    Serial.println("[SD] ERREUR : écriture incomplète.");
    return false;
}

bool sdBufferFlush(std::function<bool(int, time_t)> mqttPublishFn) {
    if (!sdReady) return false;
    if (!SD.exists(SD_OFFLINE_FILE)) return true;

    File f = SD.open(SD_OFFLINE_FILE, FILE_READ);
    if (!f || f.size() == 0) {
        if (f) f.close();
        return true;
    }

    Serial.println("[SD] Démarrage envoi — lecture des records en attente...");

    const char* tmpFile = "/offline_tmp.json";
    File fTmp = SD.open(tmpFile, FILE_WRITE);
    if (!fTmp) {
        f.close();
        Serial.println("[SD] ERREUR : impossible de créer fichier temporaire.");
        return false;
    }

    int sent    = 0;
    int failed  = 0;
    int total   = 0;

    String line;
    while (f.available()) {
        line = f.readStringUntil('\n');
        line.trim();
        if (line.length() == 0) continue;

        total++;

        StaticJsonDocument<64> doc;
        DeserializationError err = deserializeJson(doc, line);
        if (err) {
            Serial.printf("[SD] Ligne %d corrompue — ignorée.\n", total);
            continue;
        }

        int    co2 = doc["co2"] | 0;
        time_t ts  = doc["ts"]  | 0;

        if (mqttPublishFn(co2, ts)) {
            sent++;
            delay(50);
        } else {
            failed++;
            char failLine[64];
            size_t l = serializeJson(doc, failLine);
            failLine[l] = '\n';
            fTmp.write((uint8_t*)failLine, l + 1);
            Serial.println("[SD] Réseau perdu — records restants conservés.");

            while (f.available()) {
                String remaining = f.readStringUntil('\n');
                remaining.trim();
                if (remaining.length() > 0) {
                    fTmp.println(remaining);
                }
            }
            break;
        }
    }

    f.close();
    fTmp.close();

    SD.remove(SD_OFFLINE_FILE);
    if (failed > 0) {
        SD.rename(tmpFile, SD_OFFLINE_FILE);
        Serial.printf("[SD] Envoi partiel : %d OK, %d en attente.\n", sent, failed);
        return false;
    } else {
        SD.remove(tmpFile);
        Serial.printf("[SD] Envoi complet : %d record(s) envoyés — fichier nettoyé.\n", sent);
        return true;
    }
}

int sdBufferCount() {
    if (!sdReady && !SD.begin(SD_CS_PIN)) return -1;
    if (!SD.exists(SD_OFFLINE_FILE)) return 0;

    File f = SD.open(SD_OFFLINE_FILE, FILE_READ);
    if (!f) return -1;

    int count = 0;
    while (f.available()) {
        String line = f.readStringUntil('\n');
        line.trim();
        if (line.length() > 0) count++;
    }
    f.close();
    return count;
}

bool sdBufferIsReady() {
    return sdReady;
}
