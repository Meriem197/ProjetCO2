/**
 * Authentification REST (inscription, login, profil).
 */
const authService = require('../services/authService');
const tokenRevocationService = require('../services/tokenRevocationService');
const { successResponse } = require('../utils/apiResponse');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body || {});
    return res.status(201).json(successResponse(result));
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body || {});
    return res.json(successResponse(result));
  } catch (err) {
    return next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const result = await authService.updateProfile(req.user.id, req.body || {});
    return res.json(successResponse(result));
  } catch (err) {
    return next(err);
  }
}

function me(req, res) {
  return res.json(successResponse({ user: req.user }));
}

// SECURITY FIX 2.2: Logout endpoint with token revocation
async function logout(req, res, next) {
  try {
    const header = req.headers.authorization;
    const parts = typeof header === 'string' ? header.split(/\s+/) : [];
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;

    if (token) {
      // Calculate remaining TTL (typically 7 days)
      const ttl = 7 * 24 * 60 * 60;  // 604800 seconds
      await tokenRevocationService.revokeToken(token, ttl, 'user_logout');
    }

    return res.json(successResponse({ message: 'Deconnecte avec succes' }));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  updateProfile,
  me,
  logout
};
