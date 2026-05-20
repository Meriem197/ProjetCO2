// =============================================================================
//  mqtt_publisher.h — Publication des données avec MQTT
//  Ce fichier gère l'envoi des mesures CO2 au serveur central
// =============================================================================
#pragma once

#include <Arduino.h>
#include <time.h>

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions publiques pour communiquer avec le serveur MQTT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mqttInit()
 * Initialise le client MQTT au démarrage
 * C'est ici qu'on configure le serveur et le port
 * À appeler une fois dans setup()
 */
void mqttInit();

/**
 * mqttUpdate()
 * À appeler dans la boucle principale (loop)
 * Traite les messages reçus du serveur
 * Maintient la connexion active
 * Non bloquant
 */
void mqttUpdate();

/**
 * mqttEnsureConnected()
 * Essaie de se connecter au serveur MQTT
 * Si déjà connecté → ne fait rien
 * Si déconnecté → essaie 3 fois
 * Retourne vrai si connecté, faux sinon
 */
bool mqttEnsureConnected();

/**
 * mqttPublish()
 * Envoie une mesure CO2 au serveur
 * Paramètres:
 *   - co2_ppm : la valeur CO2 mesurée (ex: 850)
 *   - ts_utc : l'heure exacte de la mesure (timestamp Unix)
 * Retourne vrai si envoi réussi, faux en cas d'erreur
 */
bool mqttPublish(int co2_ppm, time_t ts_utc);

/**
 * mqttIsConnected()
 * Retourne vrai si on est connecté au serveur MQTT
 */
bool mqttIsConnected();
