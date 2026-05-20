/**
 * Compat legacy: certains imports historiques utilisent `aiServe`.
 * On redirige vers `aiService` pour eviter les fichiers vides ambiguës.
 */
module.exports = require('./aiService');
