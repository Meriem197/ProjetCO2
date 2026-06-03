/**
 * =============================================================================
 * errorHandler.js — GESTION CENTRALISEE DES ERREURS EXPRESS
 * =============================================================================
 * notFoundHandler : aucune route ne correspond → 404 JSON (pas du HTML par defaut).
 * errorHandler : middleware a 4 arguments (err, req, res, next) ; Express l'appelle
 *                 quand un handler fait next(err) ou throw async non attrape.
 * En developpement, on peut joindre err.stack dans details pour deboguer au client.
 * =============================================================================
 */

const { errorResponse } = require('../utils/apiResponse');

function notFoundHandler(req, res) {
  return res.status(404).json(errorResponse('Route introuvable', 'NOT_FOUND', { requestId: req.requestId }));
}

function errorHandler(err, req, res, next) {
  console.error(`[ERROR][${req.requestId || '-'}] ${err.message}`, err.stack);

  const status = err.status || 500;
  if (status >= 500) {
    return res.status(status).json({ error: 'Service temporairement indisponible' });
  }
  const message = err.message || 'Erreur interne du serveur';
  const code = err.code || 'INTERNAL_ERROR';
  const details = process.env.NODE_ENV === 'development'
    ? { ...(err.details ? { cause: err.details } : {}), ...(err.stack ? { stack: err.stack } : {}), requestId: req.requestId }
    : { requestId: req.requestId };

  return res.status(status).json(errorResponse(message, code, details));
}

module.exports = {
  notFoundHandler,
  errorHandler
};
