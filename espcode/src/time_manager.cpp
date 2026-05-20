// =============================================================================
//  time_manager.cpp — Gestion du temps : NTP (POSIX TZ) + GPS secours
// =============================================================================

// Inclusion des en-têtes nécessaires
#include "time_manager.h"  // En-tête pour les fonctions de gestion du temps
#include "config.h"        // En-tête pour les configurations (serveurs NTP, pins GPS, etc.)
#include <TinyGPSPlus.h>   // Bibliothèque pour parser les données GPS

// Variable externe C standard pour le décalage horaire
extern long _timezone; // variable C standard

//  Objets internes
static TinyGPSPlus gps;// Objet TinyGPSPlus pour traiter les données GPS
static HardwareSerial gpsSerial(GPS_SERIAL_NUM);// our la communication UART avec le GPS

// Source actuelle du temps (NONE, NTP, GPS)
static TimeSource   currentSource   = TimeSource::NONE;
// Indicateur si NTP est synchronisé
static bool         ntpSynced       = false;

//  timeManagerInit
// Fonction d'initialisation du gestionnaire de temps
void timeManagerInit() {
    // Initialiser la communication série UART pour le GPS avec les paramètres spécifiés
    gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    // Afficher un message de confirmation sur le port série
    Serial.println("[TIME] UART GPS initialisé (UART" 
                   + String(GPS_SERIAL_NUM) + ", RX=" 
                   + String(GPS_RX_PIN) + ")");
}

//  timeManagerSyncNTP
// Fonction pour synchroniser l'heure via NTP
bool timeManagerSyncNTP() {
    // Configurer la timezone POSIX et les serveurs NTP
    // configTzTime() applique la timezone POSIX ET configure les serveurs NTP.
    // Avantage vs configTime() : la chaîne POSIX gère automatiquement les
    // transitions heure d'été/hiver sans aucune constante manuelle.
    configTzTime(POSIX_TZ_TUNISIA, NTP_SERVER_1, NTP_SERVER_2);

    // Afficher un message d'attente
    Serial.print("[TIME] Attente synchronisation NTP");

    // Structure pour stocker l'heure
    struct tm ti;
    // Compteur de tentatives
    uint8_t retries = 0;
    // Tentatives courtes non bloquantes (max ~5 s)
    // Boucle pour essayer de récupérer l'heure locale avec timeout
    while (!getLocalTime(&ti, 500) && retries < 10) {
        Serial.print(".");
        retries++;
    }
    Serial.println();

    // Si la synchronisation réussit
    if (getLocalTime(&ti, 200)) {
        // Buffer pour formater la chaîne de temps
        char buf[32];
        // Formater l'heure locale
        strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S %Z", &ti);
        // Afficher l'heure locale
        Serial.print("[TIME] NTP OK — heure locale : ");
        Serial.println(buf);
        // Mettre à jour la source et l'état de synchronisation
        currentSource = TimeSource::NTP;
        ntpSynced     = true;
        return true;
    }

    // Si échec, afficher un message et retourner false
    Serial.println("[TIME] NTP échoué — GPS activé comme source de secours.");
    return false;
}

//  timeManagerUpdate  (appelée dans loop — NON BLOQUANTE)
// Fonction de mise à jour appelée dans la boucle principale, non bloquante
void timeManagerUpdate() {
    // Consommer tous les octets disponibles sur l'UART GPS
    while (gpsSerial.available()) {
        gps.encode(gpsSerial.read());// Encoder les données GPS reçues
    }

    // Si NTP est déjà synchronisé, pas besoin d'utiliser le GPS
    if (ntpSynced) return;

    // Vérifier si le GPS a un fix valide avec date et heure
    if (gps.date.isValid() && gps.time.isValid() && gps.date.year() > 2020) {
        // Construire une structure tm à partir des données GPS (toujours en UTC)
        struct tm gpsTime = {};
        // Année (tm_year = année - 1900)
        gpsTime.tm_year = gps.date.year() - 1900;
        // Mois (tm_mon = mois - 1)
        gpsTime.tm_mon  = gps.date.month() - 1;
        // Jour du mois
        gpsTime.tm_mday = gps.date.day();
        // Heure
        gpsTime.tm_hour = gps.time.hour();
        // Minute
        gpsTime.tm_min  = gps.time.minute();
        // Seconde
        gpsTime.tm_sec  = gps.time.second();
        // Pas d'heure d'été
        gpsTime.tm_isdst = 0;

        // Convertir en timestamp Unix UTC et appliquer à l'horloge système
        time_t gpsUtc = mktime(&gpsTime);
        // mktime() interprète la struct tm en heure locale — on corrige
        // en soustrayant le décalage TZ (GPS fournit UTC pur)
        // Sur ESP32 avec POSIX_TZ, timezone contient le décalage en secondes
        gpsUtc -= _timezone;

        // Structure pour settimeofday
        struct timeval tv = { .tv_sec = gpsUtc, .tv_usec = 0 };
        // Appliquer l'heure système
        settimeofday(&tv, nullptr);

        // Mettre à jour la source
        currentSource = TimeSource::GPS;

        // Afficher l'heure UTC du GPS
        Serial.printf("[TIME] GPS fix OK — UTC : %04d-%02d-%02d %02d:%02d:%02d\n",
            gps.date.year(), gps.date.month(), gps.date.day(),
            gps.time.hour(), gps.time.minute(), gps.time.second());
    }
}

//  timeManagerGetUTC
// Fonction pour obtenir l'heure UTC actuelle
time_t timeManagerGetUTC() {
    // Si aucune source n'est disponible, retourner 0
    if (currentSource == TimeSource::NONE) return 0;
    // Variable pour stocker l'heure actuelle
    time_t now;
    time(&now);
    // Sanity check : l'ESP32 démarre à l'époque (0) si non synchronisé
    if (now < 1000000000UL) {
        Serial.println("[TIME] ERREUR : horloge non fiable (epoch < 2001).");
        return 0;
    }
    return now;
}

//  Fonctions d'état
bool timeManagerIsSynced() {
    return (currentSource != TimeSource::NONE);
}

TimeSource timeManagerGetSource() {
    return currentSource;
}
