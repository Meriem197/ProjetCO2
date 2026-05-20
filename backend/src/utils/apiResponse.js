/**
 * =============================================================================
 * apiResponse.js — FORMAT JSON UNIQUE POUR TOUTES LES REPONSES API
 * =============================================================================
 * Succes : { success: true, data, meta? }
 * Erreur  : { success: false, error: { code, message, details? } }
 * Le frontend peut ainsi parser une seule structure.
 * =============================================================================
 */

function successResponse(data, meta = undefined) {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {})
  };
}

function errorResponse(message, code = 'INTERNAL_ERROR', details = undefined) {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  };
}

module.exports = {
  successResponse,
  errorResponse
};
