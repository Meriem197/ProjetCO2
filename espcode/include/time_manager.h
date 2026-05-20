// =============================================================================
//  time_manager.h — Gestion du temps : NTP primaire / GPS secondaire
// =============================================================================
#pragma once

#include <Arduino.h>
#include <time.h>

// ─────────────────────────────────────────────────────────────────────────────
//  États possibles de la source de temps
// ─────────────────────────────────────────────────────────────────────────────
enum class TimeSource {
    NONE,   // Aucune source synchronisée
    NTP,    // Heure fournie par NTP (Internet)
    GPS     // Heure fournie par module GPS (secours)
};

// ─────────────────────────────────────────────────────────────────────────────
//  API publique
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @brief Initialise l'UART GPS. À appeler dans setup().
 */
void timeManagerInit();

/**
 * @brief Tente la synchronisation NTP (nécessite Internet).
 *        Non bloquante : retourne false si pas de temps disponible après
 *        un court délai. À appeler dès qu'Internet est disponible.
 * @return true si l'horloge ESP32 est maintenant synchronisée via NTP.
 */
bool timeManagerSyncNTP();

/**
 * @brief À appeler dans loop() : lit le flux GPS et met à jour l'horloge
 *        si NTP n'est pas disponible et qu'un fix GPS valide est obtenu.
 *        Totalement non bloquante.
 */
void timeManagerUpdate();

/**
 * @brief Retourne le timestamp Unix UTC courant.
 * @return time_t UTC (0 si aucune source synchronisée).
 */
time_t timeManagerGetUTC();

/**
 * @brief Indique si l'heure est fiable (NTP ou GPS synchronisé).
 */
bool timeManagerIsSynced();

/**
 * @brief Retourne la source de temps active.
 */
TimeSource timeManagerGetSource();
