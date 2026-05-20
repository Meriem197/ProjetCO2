const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '').toLowerCase();
}

function parseAllowedOrigins() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:8080,http://localhost:5173,http://127.0.0.1:8080,http://127.0.0.1:5173';
  return raw
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

function isLocalDevOrigin(origin) {
  try {
    const u = new URL(origin);
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    return ['http:', 'https:'].includes(u.protocol) && localHosts.has(u.hostname);
  } catch {
    return false;
  }
}

function buildCorsMiddleware() {
  const allowedOrigins = parseAllowedOrigins();
  const isDev = String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
  return cors({
    origin(origin, callback) {
      if (isDev) {
        return callback(null, true);
      }
      // Non-browser clients (curl/Postman) may not send Origin.
      if (!origin) return callback(null, true);
      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
      return callback(new Error('Origine non autorisee par CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    credentials: false
  });
}

const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Trop de requetes, reessayez plus tard.' } }
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Trop de tentatives de connexion.' } }
});

module.exports = {
  compressionMiddleware: compression(),
  buildCorsMiddleware,
  globalRateLimiter,
  authRateLimiter
};
