/**
 * =============================================================================
 * httpError.js — ERREUR METIER AVEC CODE HTTP + CODE METIER CLIENT
 * =============================================================================
 * throw new HttpError(404, '...', 'NOT_FOUND') puis next(err) dans Express :
 * errorHandler lit err.status et err.code pour la reponse JSON.
 * =============================================================================
 */

class HttpError extends Error {
  constructor(status, message, code = 'HTTP_ERROR', details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = {
  HttpError
};
