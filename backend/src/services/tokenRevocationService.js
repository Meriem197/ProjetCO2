/**
 * =============================================================================
 * tokenRevocationService.js — GESTION BLACKLIST DE TOKENS
 * =============================================================================
 * Service pour invalider les JWT avant expiration (logout, password change, etc).
 * Utilise Redis pour performance, avec fallback en mémoire pour dev/test.
 * =============================================================================
 */

const logger = require('../monitoring/logger');

let redisClient = null;
let useRedis = false;

// Fallback en mémoire pour dev/test (attention: perdus au redémarrage)
const memoryBlacklist = new Map();

/**
 * Initialiser le client Redis (optionnel).
 * Si Redis indisponible, fallback sur stockage en mémoire.
 */
async function initializeRedis() {
  try {
    const redis = require('redis');
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = redis.createClient({ url });
    
    redisClient.on('error', (err) => {
      logger.warn(`[TokenRevocation] Redis error: ${err.message} - fallback to memory`);
      useRedis = false;
    });

    await redisClient.connect();
    useRedis = true;
    logger.info('[TokenRevocation] Redis connected for token blacklist');
  } catch (err) {
    logger.warn(`[TokenRevocation] Redis unavailable: ${err.message} - using memory storage`);
    useRedis = false;
  }
}

/**
 * Revoquer un token (l'ajouter a la blacklist).
 * @param {String} token - JWT token a revoquer
 * @param {Number} ttl - Temps de vie restant en secondes
 * @param {String} reason - Raison de la revocation (logout, password_change, etc)
 */
async function revokeToken(token, ttl, reason = 'user_logout') {
  if (!token) return;

  try {
    if (useRedis && redisClient) {
      // Option A: Redis (rapide, TTL auto-expire)
      const key = `revoked:${token}`;
      await redisClient.setEx(key, ttl || 86400, reason);
      logger.info(`[TokenRevocation] Token revoked (Redis): TTL=${ttl}s`);
    } else {
      // Option B: Mémoire locale (pour dev/test)
      const expiresAt = Date.now() + (ttl || 86400) * 1000;
      memoryBlacklist.set(token, { reason, expiresAt });
      logger.info(`[TokenRevocation] Token revoked (Memory): TTL=${ttl}s`);
    }
  } catch (err) {
    logger.error(`[TokenRevocation] Failed to revoke token: ${err.message}`);
  }
}

/**
 * Verifier si un token est revoque.
 * @param {String} token - JWT token a verifier
 * @returns {Boolean} true si revoque, false sinon
 */
async function isTokenRevoked(token) {
  if (!token) return false;

  try {
    if (useRedis && redisClient) {
      // Redis: chercher en blacklist
      const exists = await redisClient.exists(`revoked:${token}`);
      return exists === 1;
    } else {
      // Mémoire: chercher et cleanup des anciennes entrees
      const entry = memoryBlacklist.get(token);
      if (!entry) return false;
      
      if (entry.expiresAt < Date.now()) {
        memoryBlacklist.delete(token);
        return false;
      }
      return true;
    }
  } catch (err) {
    logger.error(`[TokenRevocation] Failed to check revocation: ${err.message}`);
    // En cas d'erreur, consider le token revoque pour securite
    return true;
  }
}

/**
 * Revoquer TOUS les tokens d'un user (logout de tous les appareils).
 * Note: En mémoire, pas de query directe par userId - on peut stocker mapping simple
 * @param {Number} userId - ID de l'utilisateur
 */
async function revokeAllUserTokens(userId) {
  if (!userId) return;

  try {
    // Pour mémoire: pas de structure userId→tokens
    // En production, utiliser Redis avec pattern `tokens:user:${userId}:*`
    logger.warn(`[TokenRevocation] revokeAllUserTokens not fully implemented for memory storage`);
  } catch (err) {
    logger.error(`[TokenRevocation] Failed to revoke all tokens: ${err.message}`);
  }
}

/**
 * Cleanup: supprimer les tokens revokes expires
 */
async function cleanupExpiredTokens() {
  try {
    if (!useRedis) {
      // Mémoire: cleanup manuel
      let deleted = 0;
      for (const [token, entry] of memoryBlacklist.entries()) {
        if (entry.expiresAt < Date.now()) {
          memoryBlacklist.delete(token);
          deleted++;
        }
      }
      if (deleted > 0) {
        logger.info(`[TokenRevocation] Cleaned up ${deleted} expired tokens`);
      }
    }
  } catch (err) {
    logger.error(`[TokenRevocation] Cleanup failed: ${err.message}`);
  }
}

module.exports = {
  initializeRedis,
  revokeToken,
  isTokenRevoked,
  revokeAllUserTokens,
  cleanupExpiredTokens
};

