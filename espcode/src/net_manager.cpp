// =============================================================================
//  net_manager.cpp — Gestion du réseau : Ethernet + WiFi
//  Ce fichier gère la connexion à Internet
//  - Priorité Ethernet si câble detected
//  - Secours WiFi si pas de câble
// =============================================================================
#include "net_manager.h"
#include "config.h"

#include <WiFi.h>
#include <ETH.h>

// ─────────────────────────────────────────────────────────────────────────────
// Variables internes : état du réseau
// ─────────────────────────────────────────────────────────────────────────────
// État actuel du réseau (DISCONNECTED, WIFI_ONLY, ETH_PRIMARY, etc.)
static NetStatus    currentStatus      = NetStatus::DISCONNECTED;
// État précédent (pour détecter les changements)
static NetStatus    previousStatus     = NetStatus::DISCONNECTED;
// Flag : vrai si l'état a changé récemment
static bool         statusChangedFlag  = false;

// L'Ethernet a-t-il été initialisé avec succès ?
static bool         ethInitDone        = false;
// Le WiFi a-t-il démarré ?
static bool         wifiStarted        = false;

// Dernier moment où on a vérifié l'état du réseau
static unsigned long lastCheckMs       = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Fonction appelée quand quelque chose change avec Ethernet
// (câble branché, débranchéetc.)
// ─────────────────────────────────────────────────────────────────────────────
static void onEthEvent(WiFiEvent_t event) {
    switch (event) {
        case ARDUINO_EVENT_ETH_START:
            Serial.println("[NET] Ethernet démarre.");
            ETH.setHostname("co2-monitor");
            break;
        case ARDUINO_EVENT_ETH_CONNECTED:
            Serial.println("[NET] Câble Ethernet branché.");
            break;
        case ARDUINO_EVENT_ETH_GOT_IP:
            Serial.print("[NET] Adresse IP Ethernet reçue : ");
            Serial.println(ETH.localIP());
            break;
        case ARDUINO_EVENT_ETH_DISCONNECTED:
            Serial.println("[NET] Câble Ethernet débranché — bascule sur WiFi.");
            break;
        case ARDUINO_EVENT_ETH_STOP:
            Serial.println("[NET] Ethernet arrêté.");
            break;
        default:
            break;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions d'aide privées (non publiques)
// ─────────────────────────────────────────────────────────────────────────────

// Vérifie si Ethernet est connecté ET a une adresse IP valide
static bool isEthConnected() {
    return ethInitDone && ETH.linkUp() && (ETH.localIP() != IPAddress(0, 0, 0, 0));
}

// Vérifie si WiFi est connecté
static bool isWifiConnected() {
    return (WiFi.status() == WL_CONNECTED);
}

// Démarre le WiFi s'il n'a pas déjà démarré
static void startWiFi() {
    if (wifiStarted) return;  // Déjà en cours
    Serial.println("[NET] Démarrage du WiFi...");
    WiFi.mode(WIFI_STA);  // Mode client (pas point d'accès)
    WiFi.setAutoReconnect(true);  // Reconnexion auto si perte
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);  // Connecter au SSID
    wifiStarted = true;
}

// Mise à jour de l'état du réseau
static void updateStatus() {
    NetStatus newStatus;

    // Décider quel état on est vraiment
    if (isEthConnected()) {
        newStatus = NetStatus::ETH_PRIMARY;  // Ethernet est le meilleur
    } else if (isWifiConnected()) {
        newStatus = NetStatus::WIFI_ONLY;  // WiFi seulement
    } else {
        newStatus = NetStatus::DISCONNECTED;  // Rien du tout
    }

    // Si l'état a changé
    if (newStatus != currentStatus) {
        previousStatus    = currentStatus;
        currentStatus     = newStatus;
        statusChangedFlag = true;

        // Afficher le changement d'état
        const char* labels[] = {"DISCONNECTED", "WIFI_ONLY", "ETH_ONLY", "ETH_PRIMARY"};
        Serial.printf("[NET] Changement : %s → %s\n",
            labels[(int)previousStatus], labels[(int)currentStatus]);

        // Afficher l'adresse IP si connecté
        if (currentStatus != NetStatus::DISCONNECTED) {
            Serial.print("[NET] IP : ");
            Serial.println(isEthConnected() ? ETH.localIP() : WiFi.localIP());
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation : à appeler une fois dans setup()
// ─────────────────────────────────────────────────────────────────────────────
void netManagerInit() {
    // Enregistrer la fonction de callback AVANT de démarrer Ethernet
    WiFi.onEvent(onEthEvent);

    // Essayer d'initialiser Ethernet (LAN8720)
    Serial.println("[NET] Initialisation Ethernet LAN8720...");
    if (ETH.begin(ETH_PHY_ADDR, ETH_PHY_POWER,
                  ETH_MDC_PIN, ETH_MDIO_PIN,
                  ETH_PHY_TYPE, ETH_CLK_MODE)) {
        ethInitDone = true;
        Serial.println("[NET] Driver Ethernet chargé.");

        // Attendre un peu pour voir si un câble est branché
        unsigned long t = millis();
        while (!ETH.linkUp() && millis() - t < 3000) {
            delay(100);
        }

        if (ETH.linkUp()) {
            Serial.println("[NET] Câble détecté — utiliser Ethernet.");
            // Attendre l'adresse IP (max 5 secondes)
            t = millis();
            while (ETH.localIP() == IPAddress(0, 0, 0, 0) && millis() - t < 5000) {
                delay(200);
            }
        } else {
            Serial.println("[NET] Pas de câble — utiliser WiFi.");
            startWiFi();
        }
    } else {
        Serial.println("[NET] ATTENTION : LAN8720 non trouvé — WiFi seulement.");
        startWiFi();
    }

    // Si WiFi a démarré et Ethernet pas connecté, attendre connection WiFi
    if (wifiStarted && !isEthConnected()) {
        Serial.print("[NET] Connexion WiFi");
        unsigned long t = millis();
        while (!isWifiConnected() && millis() - t < WIFI_CONNECT_TIMEOUT_MS) {
            delay(300);
            Serial.print(".");
        }
        Serial.println();
        if (isWifiConnected()) {
            Serial.print("[NET] WiFi OK — IP : ");
            Serial.println(WiFi.localIP());
        } else {
            Serial.println("[NET] WiFi : échec connexion.");
        }
    }

    // Mettre à jour l'état
    updateStatus();
}

// ─────────────────────────────────────────────────────────────────────────────
// À appeler régulièrement dans la boucle principale (loop)
// Vérifie si le réseau est toujours disponible
// ─────────────────────────────────────────────────────────────────────────────
void netManagerUpdate() {
    unsigned long now = millis();
    // Vérifier seulement toutes les 15 secondes (pas à chaque boucle)
    if (now - lastCheckMs < NET_CHECK_INTERVAL_MS) return;
    lastCheckMs = now;

    // Si Ethernet marche bien, c'est fini (c'est le meilleur)
    if (isEthConnected()) {
        updateStatus();
        return;
    }

    // Ethernet pas disponible, on reconnecte le WiFi si besoin
    if (!wifiStarted) startWiFi();

    // Si WiFi perdu, afficher message (reconnexion auto en arrière-plan)
    if (!isWifiConnected()) {
        Serial.println("[NET] WiFi perdu — reconnexion auto...");
    }

    // Mettre à jour l'état
    updateStatus();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions d'accessibilité publique
// ─────────────────────────────────────────────────────────────────────────────

// Retourne vrai si on a une connexion Internet (Ethernet ou WiFi)
bool netManagerIsConnected() {
    return (currentStatus != NetStatus::DISCONNECTED);
}

// Retourne l'état courant du réseau
NetStatus netManagerGetStatus() {
    return currentStatus;
}

// Retourne vrai si l'état a changé depuis le dernier appel
// Utile pour déclencher la resynchronisation NTP quand internet revient
bool netManagerStatusChanged() {
    if (statusChangedFlag) {
        statusChangedFlag = false;  // Consommer le flag
        return true;
    }
    return false;
}
