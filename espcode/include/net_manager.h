// =============================================================================
//  net_manager.h — Gestion de la connexion réseau Ethernet + WiFi
//  Ce fichier définit l'interface pour se connecter à Internet
//  Priorité : Ethernet (câble) >> WiFi (secours)
// =============================================================================
#pragma once

#include <Arduino.h>

// ─────────────────────────────────────────────────────────────────────────────
// Énumération : Les 4 états possibles de la connexion réseau
// ─────────────────────────────────────────────────────────────────────────────
enum class NetStatus {
    DISCONNECTED,   // Pas d'internet (ni Ethernet ni WiFi)
    WIFI_ONLY,      // Connecté uniquement via WiFi
    ETH_ONLY,       // Connecté uniquement via Ethernet
    ETH_PRIMARY     // Ethernet disponible (meilleure qualité que WiFi)
};

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions publiques pour gérer le réseau
// ─────────────────────────────────────────────────────────────────────────────

/**
 * netManagerInit()
 * Initialise la connexion réseau au démarrage du système
 * - Cherche d'abord un câble Ethernet (LAN8720)
 * - Si pas de câble → utilise WiFi
 * À appeler une fois dans setup()
 */
void netManagerInit();

/**
 * netManagerUpdate()
 * À appeler dans la boucle principale (loop)
 * Vérifie si on a encore la connexion réseau
 * Si perdue → essaie de se reconnecter automatiquement
 * Non bloquant : prend quelques millisecondes seulement
 */
void netManagerUpdate();

/**
 * netManagerIsConnected()
 * Retourne vrai (true) si on a une connexion Internet active
 * Retourne faux (false) sinon
 */
bool netManagerIsConnected();

/**
 * netManagerGetStatus()
 * Retourne l'état actuel : DISCONNECTED, WIFI_ONLY, ETH_PRIMARY, etc.
 */
NetStatus netManagerGetStatus();

/**
 * netManagerStatusChanged()
 * Retourne vrai si l'état du réseau a changé depuis le dernier appel
 * Utile pour déclencher NTP quand la connexion revient
 */
bool netManagerStatusChanged();
