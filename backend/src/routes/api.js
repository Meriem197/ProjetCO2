/**
 * =============================================================================
 * api.js — ROUTEUR EXPRESS : /api ET /api/v1
 * =============================================================================
 * LECTURE RAPIDE :
 *   - Ce fichier dit "quelle URL appelle quelle fonction".
 *   - L'ordre des middlewares est important:
 *       1) rate-limit (anti abus)
 *       2) validation des donnees entrantes
 *       3) auth JWT / role
 *       4) controller metier
 *
 * Cahier des charges : API REST (donnees, IA, alertes, utilisateurs), securisation
 * des ecritures par JWT Bearer.
 * =============================================================================
 */

const express = require('express');
const { getCo2History, getApiStatus, getActiveSensors, getClassificationAggregations, getClassificationTimeSeries, getClassificationDistribution } = require('../controllers/dataController');
const { getClassificationStatsEndpoint, getClassificationUnifiedEndpoint } = require('../controllers/classificationController');

const sitesController = require('../controllers/sitesController');
const sensorsController = require('../controllers/sensorsController');
const authController = require('../controllers/authController');
const alertsController = require('../controllers/alertsController');
const alertsContextController = require('../controllers/alertsContextController');
const analyticsController = require('../controllers/analyticsController');
const aiProjectsController = require('../controllers/aiProjectsController');
const systemSettingsController = require('../controllers/systemSettingsController');
const positioningController = require('../controllers/positioningController');
const usersAdminController = require('../controllers/usersAdminController');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const { authRateLimiter } = require('../middlewares/securityMiddleware');
const {
  validateRegisterPayload,
  validateLoginPayload,
  validateProfileUpdatePayload,
  validateSitePayload,
  validateSensorPayload,
  validateLinkSensorPayload,
  validateAlertPatchPayload
} = require('../middlewares/validationMiddleware');

const router = express.Router();

// --- Sante ---
router.get('/', getApiStatus);
router.get('/status', getApiStatus);

// --- Authentification (public) ---
router.post('/auth/register', authRateLimiter, validateRegisterPayload, authController.register);
router.post('/auth/login', authRateLimiter, validateLoginPayload, authController.login);
router.post('/auth/logout', requireAuth, authController.logout);
router.get('/auth/me', requireAuth, authController.me);
router.patch('/auth/profile', requireAuth, validateProfileUpdatePayload, authController.updateProfile);

// --- Donnees CO2 & analytics (SECURISEES: authentification + roles requis) ---
router.get('/co2/history', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), getCo2History);
router.get('/co2/active-sensors', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), getActiveSensors);
router.get('/co2/stats', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), analyticsController.getCo2Stats);
router.get('/co2/classify', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), analyticsController.classify);
router.get('/co2/predict', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), analyticsController.predict);
router.get('/ai/placement', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), analyticsController.getPlacementOptimization);

// --- Placement IA : Catalogue des projets (MySQL) ---
router.get('/ai/projects', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), aiProjectsController.list);

// --- Classification Page (Unified Real-time Monitoring) ---
// Optimized unified stats endpoint (single call for chart + tooltip sync)
router.get('/co2/classification/stats', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), getClassificationStatsEndpoint);

// Alias endpoint (UI spec): /api/classification?period=...&filter=...
router.get('/classification', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), getClassificationUnifiedEndpoint);
router.get('/classification/current', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), getClassificationUnifiedEndpoint);

// Legacy endpoints (kept for compatibility)
router.get('/classification/aggregations', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), getClassificationAggregations);
router.get('/classification/timeseries', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), getClassificationTimeSeries);
router.get('/classification/distribution', requireAuth, requireRole('CLIENT', 'TECHNICIAN', 'ADMIN'), getClassificationDistribution);


// --- Alertes (liste / mise a jour statut : authentifie) ---
router.get('/alerts', requireAuth, alertsController.list);
// RBAC: Admin + Technicien peuvent agir. Client = lecture seule.
router.patch('/alerts/:id', requireAuth, requireRole('ADMIN', 'TECHNICIAN'), validateAlertPatchPayload, alertsController.updateStatut);
router.post('/alerts/acknowledge', requireAuth, requireRole('ADMIN', 'TECHNICIAN'), alertsController.updateStatut);
router.get('/alerts/:id/context', requireAuth, requireRole('ADMIN', 'CLIENT', 'TECHNICIAN'), alertsContextController.getContext);

// --- Paramètres système (CompanySetting) ---
router.get('/settings', requireAuth, requireRole('ADMIN', 'CLIENT', 'TECHNICIAN'), systemSettingsController.getSettings);
router.patch('/settings', requireAuth, requireRole('ADMIN', 'TECHNICIAN'), systemSettingsController.updateSettings);
// Alias demandé (cahier des charges): PUT /settings
router.put('/settings', requireAuth, requireRole('ADMIN', 'TECHNICIAN'), systemSettingsController.updateSettings);
router.get('/settings/sensor-test', requireAuth, requireRole('ADMIN', 'TECHNICIAN'), systemSettingsController.sensorTest);

// --- Optimisation Positionnement Capteur ---
router.get('/positioning/positions', requireAuth, requireRole('ADMIN', 'CLIENT', 'TECHNICIAN'), positioningController.list);
router.post('/positioning/positions', requireAuth, requireRole('ADMIN', 'TECHNICIAN'), positioningController.create);
router.delete('/positioning/positions/:id', requireAuth, requireRole('ADMIN', 'TECHNICIAN'), positioningController.remove);
router.get('/positioning/compare', requireAuth, requireRole('ADMIN', 'TECHNICIAN'), positioningController.compare);
router.post('/positioning/finalize', requireAuth, requireRole('ADMIN', 'TECHNICIAN'), positioningController.finalize);

// --- Gestion utilisateurs (Admin) ---
router.get('/users', requireAuth, requireRole('ADMIN'), usersAdminController.list);
router.post('/users/invite', requireAuth, requireRole('ADMIN'), usersAdminController.invite);
router.patch('/users/:id/role', requireAuth, requireRole('ADMIN'), usersAdminController.updateRole);

// --- Sites (lecture publique ; ecriture authentifiee) ---
router.get('/sites', requireAuth, sitesController.listSites);
router.get('/sites/:id', requireAuth, sitesController.getSite);
router.post('/sites', requireAuth, requireRole('ADMIN', 'CLIENT'), validateSitePayload, sitesController.createSite);
router.put('/sites/:id', requireAuth, requireRole('ADMIN', 'CLIENT'), validateSitePayload, sitesController.updateSite);
router.delete('/sites/:id', requireAuth, requireRole('ADMIN'), sitesController.deleteSite);

// --- Capteurs ---
router.get('/sensors', requireAuth, sensorsController.listSensors);
router.post('/sensors/link', requireAuth, requireRole('ADMIN', 'CLIENT', 'TECHNICIAN'), validateLinkSensorPayload, sensorsController.linkSensorToSite);
router.post('/sensors', requireAuth, requireRole('ADMIN', 'CLIENT', 'TECHNICIAN'), validateSensorPayload, sensorsController.createSensor);
router.get('/sensors/:id', requireAuth, sensorsController.getSensor);
router.put('/sensors/:id', requireAuth, requireRole('ADMIN', 'CLIENT', 'TECHNICIAN'), validateSensorPayload, sensorsController.updateSensor);
router.delete('/sensors/:id', requireAuth, requireRole('ADMIN'), sensorsController.deleteSensor);

module.exports = router;
