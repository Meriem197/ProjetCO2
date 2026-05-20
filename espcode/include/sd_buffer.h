// =============================================================================
//  sd_buffer.h — Stockage hors-ligne sur carte SD
//  Si le réseau est coupé, les mesures sont sauvegardées sur la SD
//  Quand le réseau revient, les données sont envoyées au serveur
// =============================================================================
#pragma once

#include <Arduino.h>

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions publiques pour gérer le stockage SD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sdBufferInit()
 * Initialise la carte SD au démarrage
 * Crée le fichier offline.json s'il n'existe pas
 * À appeler une fois dans setup()
 * Retourne vrai si SD OK, faux si absente ou erreur
 */
bool sdBufferInit();

/**
 * sdBufferSave()
 * Sauvegarde une mesure CO2 sur la SD quand le réseau est coupé
 * Paramètres:
 *   - co2_ppm : valeur CO2 mesurée
 *   - ts_utc : heure exacte de la mesure (timestamp Unix)
 * Retourne vrai si écriture réussie, faux sinon
 */
bool sdBufferSave(int co2_ppm, time_t ts_utc);

/**
 * sdBufferFlush()
 * Envoie tous les records sauvegardés sur SD vers le serveur MQTT
 * À appeler quand le réseau revient
 * Supprime chaque record du fichier une fois envoyé
 * Paramètre: fonction callback pour publier chaque record
 * Retourne vrai si tout envoyé avec succès, faux sinon
 */
bool sdBufferFlush(std::function<bool(int, time_t)> mqttPublishFn);

/**
 * sdBufferCount()
 * Retourne le nombre de records en attente d'envoi dans la SD
 * Retourne -1 si erreur (SD absente, etc.)
 */
int sdBufferCount();

/**
 * sdBufferIsReady()
 * Retourne vrai si la carte SD est disponible et prête à l'emploi
 */
bool sdBufferIsReady();
