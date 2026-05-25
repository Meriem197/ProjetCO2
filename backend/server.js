/**
 * =============================================================================
 * server.js — POINT D'ENTREE DE L'APPLICATION NODE.JS
 * =============================================================================
 * LECTURE RAPIDE (si vous debutez) :
 *   - C'est le "chef d'orchestre" du backend.
 *   - Ici on connecte les briques (API HTTP, MQTT, InfluxDB, MySQL).
 *   - Si ce fichier demarre bien, toute l'application est disponible.
 *
 * Ordre d'execution au lancement : `node server.js` ou `npm start`
 *
 * Demarche generale :
 *   1) Charger les variables d'environnement (.env) pour configurer ports, URLs BDD, etc.
 *   2) Creer l'application Express (HTTP API REST).
 *   3) Creer un serveur HTTP *natif* (module `http`) car Socket.io doit s'y accrocher.
 *   4) Monter les middlewares (securite, CORS, JSON, logs).
 *   5) Brancher les routes API et la documentation OpenAPI.
 *   6) Enregistrer les gestionnaires d'erreurs (404 puis erreurs serveur).
 *   7) Dans `start()` : connecter InfluxDB et optionnellement MySQL, demarrer MQTT,
 *      puis ecouter les connexions HTTP sur le PORT.
 *
 * Flux donnees resume : capteur → MQTT → mqttHandler → InfluxDB + Socket.io
 *                        client web → GET /api/... → controllers → Influx/MySQL
 * =============================================================================
 */

// dotenv lit le fichier .env a la racine et remplit process.env (AVANT les autres require
// qui pourraient lire process.env au chargement).
require('dotenv').config();

// --- Frameworks et modules Node ---
// express : routeur HTTP, middlewares, reponses JSON.
const express = require('express');
// http : serveur bas niveau ; necessaire pour attacher socket.io au meme port que l'API.
const http = require('http');
// socket.io : WebSocket / long-polling pour pousser les mesures CO2 au navigateur en temps reel.
const { Server } = require('socket.io');
// helmet : en-tetes HTTP de securite (XSS, clickjacking, etc.) par defaut raisonnables.
const helmet = require('helmet');

// --- Modules internes du projet (chemins relatifs a la racine du repo) ---
const apiRoutes = require('./src/routes/api');
const docsRoutes = require('./src/routes/docs');
const { connectInflux, getWriteApi } = require('./src/config/influx');
const { connectMySQL } = require('./src/config/mysql');
const { ensureSensorReadingsSchema } = require('./src/services/sensorReadingService');
const { validateEnv } = require('./src/config/env');
const { startMqttClient, getMqttStatus } = require('./src/mqtt/mqttHandler');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');
const { requestContext } = require('./src/middlewares/requestContext');
const {
  compressionMiddleware,
  buildCorsMiddleware,
  globalRateLimiter
} = require('./src/middlewares/securityMiddleware');
const { metricsMiddleware, getMetricsSnapshot } = require('./src/monitoring/metrics');
const { successResponse } = require('./src/utils/apiResponse');

// Instance Express : toutes les routes HTTP s'ajoutent sur `app`.
const app = express();

// createServer(app) : Node delegue les requetes HTTP a Express via le callback interne d'Express.
const httpServer = http.createServer(app);

// Socket.io ecoute les memes connexions TCP que le serveur HTTP ; le handshake peut etre WS.
// `cors.origin` : liste ou string des origines autorisees pour le navigateur qui ouvre la socket.
const io = new Server(httpServer, {
  cors: {
    origin:
      String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production'
        ? true
        : (
            process.env.FRONTEND_URL ||
            'http://localhost:3000,http://localhost:8080,http://localhost:5173,http://127.0.0.1:8080,http://127.0.0.1:5173'
          )
            .split(',')
            .map((s) => s.trim()),
    methods: ['GET', 'POST']
  }
});

// --- Middlewares : s'executent dans l'ordre pour CHAQUE requete qui matche ---
app.disable('x-powered-by');
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(buildCorsMiddleware());
app.use(globalRateLimiter);
app.use(compressionMiddleware);
app.use(requestContext);
app.use(metricsMiddleware);
// express.json() : si Content-Type: application/json, parse le corps en objet JS sur req.body.
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));

// --- Montage des routeurs Express (prefixe d'URL) ---
// docs : /openapi.json et /docs (sans prefixe api).
app.use('/', docsRoutes);
// Versionnee : recommandee pour le frontend (contrat stable /api/v1/...).
app.use('/api/v1', apiRoutes);
// Sans version : anciennes URL ou clients existants (/api/...).
app.use('/api', apiRoutes);

// Healthcheck : endpoint leger pour Docker, load balancer ou script de surveillance.
app.get('/health', (req, res) => {
  res.json(
    successResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      // Etat MQTT (connexion, tentatives, seuil alerte CO2) pour diagnostic rapide.
      mqtt: getMqttStatus()
    })
  );
});

app.get('/metrics', (req, res) => {
  res.json(
    successResponse({
      service: 'backendpfe',
      ...getMetricsSnapshot(),
      mqtt: getMqttStatus()
    })
  );
});

// Ordre crucial : d'abord 404 si aucune route n'a repondu, puis erreur globale (4 args).
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Demarrage sequentiel des dependances puis du serveur HTTP.
 * async/await : attendre connectInflux/connectMySQL avant d'accepter du trafic utile.
 */
async function start() {
  try {
    const envReport = validateEnv();
    envReport.warnings.forEach((w) => console.warn(`[env] ${w}`));
    if (envReport.errors.length) {
      throw new Error(`Configuration invalide: ${envReport.errors.join(' | ')}`);
    }

    // InfluxDB : obligatoire pour ce prototype (series temporelles CO2).
    await connectInflux();
    console.log('[influx] Connecte');

    // MySQL : metadonnees (sites, capteurs). Peut etre desactive ou optionnel selon l'env.
    const mysqlEnabled = String(process.env.MYSQL_ENABLED || 'true').toLowerCase() !== 'false';
    // En production, si MYSQL_REQUIRED n'est pas defini, on considere MySQL obligatoire par defaut.
    const mysqlRequired = String(
      process.env.MYSQL_REQUIRED !== undefined
        ? process.env.MYSQL_REQUIRED
        : process.env.NODE_ENV === 'production'
    ).toLowerCase() === 'true';

    if (mysqlEnabled) {
      try {
        await connectMySQL(); // Connexion a MySQL (Sequelize)
        await ensureSensorReadingsSchema();
      } catch (err) {
        if (mysqlRequired) throw err;
        console.warn('⚠️ MySQL indisponible: demarrage continue sans MySQL.');
        console.warn('   Pour le rendre obligatoire: MYSQL_REQUIRED=true');
      }
    } else {
      console.warn('[mysql] Desactive (MYSQL_ENABLED=false).');
    }

    // MQTT : connexion au broker ; `io` sert a emettre co2:update / co2:alert vers le front.
    // PERFORMANCE FIX 4.1: Passer le writeApi au MQTT handler pour le batching
    const writeApi = getWriteApi();
    startMqttClient(io, writeApi);
    console.log('[mqtt] Client demarre');

    const PORT = Number(process.env.PORT || 4000);
    httpServer.on('error', (err) => {
      if (err?.code === 'EADDRINUSE') {
        console.error(`[http] Port ${PORT} deja utilise. Arretez l'ancien backend ou changez PORT dans .env.`);
        process.exit(1);
      }
      console.error('[http] Erreur serveur :', err);
      process.exit(1);
    });
    // listen : commence a accepter les connexions TCP sur toutes les interfaces (0.0.0.0) par defaut.
    httpServer.listen(PORT, () => {
      console.log(`[http] http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[start] Echec :', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = {
  app,
  httpServer,
  start
};
