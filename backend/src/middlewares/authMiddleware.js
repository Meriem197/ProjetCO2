const authService = require('../services/authService');
const tokenRevocationService = require('../services/tokenRevocationService');
const { HttpError } = require('../utils/httpError');

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

// Wrapper pour gérer les erreurs async
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const requireAuth = asyncHandler(async function (req, res, next) {
  const header = req.headers.authorization;
  const parts = typeof header === 'string' ? header.split(/\s+/) : [];
  const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;
  if (!token) {
    return next(new HttpError(401, 'Authorization Bearer manquant', 'UNAUTHORIZED'));
  }
  const payload = authService.verifyToken(token);
  if (!payload) {
    return next(new HttpError(401, 'Token invalide ou expire', 'UNAUTHORIZED'));
  }

  // SECURITY FIX 2.2: Verifier si le token est revoque (logout, password change)
  try {
    const isRevoked = await tokenRevocationService.isTokenRevoked(token);
    if (isRevoked) {
      return next(new HttpError(401, 'Token revoque', 'TOKEN_REVOKED'));
    }
  } catch (err) {
    // Si service revocation indisponible, continuer (fail open pour UX)
    console.warn('[Auth] Token revocation check failed:', err.message);
  }

  const headerCompanyId = req.headers['x-company-id'];
  let resolvedCompanyId = Number(payload.activeCompanyId || 0);

  // FIX SECURITY: Si x-company-id header present, valider qu'il est dans les memberships
  if (headerCompanyId !== undefined && headerCompanyId !== null) {
    const requestedId = Number(headerCompanyId);
    
    // Valider que c'est un entier positif
    if (!Number.isFinite(requestedId) || requestedId <= 0) {
      return next(new HttpError(400, 'x-company-id invalide (doit être entier > 0)', 'INVALID_COMPANY_ID'));
    }

    // CRITIQUE: Verifier que l'user est MEMBRE de cette compagnie
    const isMember = payload.memberships?.some(m => m.companyId === requestedId);
    if (!isMember) {
      return next(new HttpError(403, 'Accès refusé: vous n\'êtes pas membre de cette compagnie', 'NOT_MEMBER'));
    }

    resolvedCompanyId = requestedId;
  }

  if (!Number.isFinite(resolvedCompanyId) || resolvedCompanyId <= 0) {
    return next(new HttpError(403, 'Aucune entreprise active dans le token', 'NO_ACTIVE_COMPANY'));
  }

  req.user = {
    id: payload.sub,
    email: payload.email,
    activeCompanyId: resolvedCompanyId,
    roles: Array.isArray(payload.roles) ? payload.roles.map(normalizeRole) : [],
    memberships: Array.isArray(payload.memberships) ? payload.memberships : []
  };
  return next();
});

function requireRole(...roles) {
  const expected = roles.map(normalizeRole);
  return (req, res, next) => {
    if (!req.user) {
      return next(new HttpError(401, 'Non authentifie', 'UNAUTHORIZED'));
    }
    const userRoles = (req.user.roles || []).map(normalizeRole);
    const allowed = expected.some((r) => userRoles.includes(r));
    if (!allowed) {
      return next(new HttpError(403, 'Permission refusee', 'FORBIDDEN'));
    }
    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  asyncHandler
};
