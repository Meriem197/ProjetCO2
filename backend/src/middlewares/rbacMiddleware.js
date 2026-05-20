/**
 * =============================================================================
 * rbacMiddleware.js — VALIDATION D'OWNERSHIP & PERMISSIONS GRANULAIRES
 * =============================================================================
 * Middleware pour verifier que l'utilisateur accede uniquement a ses ressources.
 * =============================================================================
 */

const { HttpError } = require('../utils/httpError');

/**
 * Middleware: valide que la ressource appartient a la compagnie active de l'user.
 * @param {Function} getResourceFn - Fonction async (id, user) => resource
 * @param {String} resourceName - Nom de la ressource pour les erreurs
 * @param {String} paramName - Nom du parametre URL (default: 'id')
 */
function requireOwnership(getResourceFn, resourceName = 'resource', paramName = 'id') {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      if (!resourceId) {
        return next(new HttpError(400, `Parametre ${paramName} manquant`, 'MISSING_PARAM'));
      }

      // Charger la ressource
      const resource = await getResourceFn(resourceId);
      if (!resource) {
        return next(new HttpError(404, `${resourceName} non trouvé`, 'NOT_FOUND'));
      }

      // Verifier que la ressource appartient a la compagnie de l'user
      if (resource.companyId !== req.user.activeCompanyId) {
        return next(new HttpError(403, `Acces refusé: ${resourceName} hors de votre compagnie`, 'FORBIDDEN'));
      }

      // Passer l'objet au controller pour eviter re-query
      req.resource = resource;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/**
 * Middleware: valide les permissions granulaires par role.
 * @param {Object} permissionMap - { 'ADMIN': ['read', 'write', 'delete'], 'TECHNICIAN': ['read', 'write'], ... }
 */
function requirePermission(permissionMap = {}) {
  return (req, res, next) => {
    const userRole = (req.user.roles || [])[0]?.toUpperCase();
    if (!userRole) {
      return next(new HttpError(401, 'Role non trouvé dans le token', 'NO_ROLE'));
    }

    const allowedActions = permissionMap[userRole] || [];
    
    // Mapper HTTP method to action
    const actionMap = {
      'GET': 'read',
      'POST': 'write',
      'PUT': 'write',
      'PATCH': 'write',
      'DELETE': 'delete'
    };
    
    const requiredAction = actionMap[req.method] || 'read';
    
    if (!allowedActions.includes(requiredAction)) {
      return next(new HttpError(403, `Permission refusee: ${userRole} ne peut pas ${requiredAction}`, 'FORBIDDEN'));
    }

    return next();
  };
}

module.exports = {
  requireOwnership,
  requirePermission
};
