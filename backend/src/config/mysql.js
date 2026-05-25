/**
 * =============================================================================
 * config/mysql.js — INSTANCE SEQUELIZE + FONCTION connectMySQL()
 * =============================================================================
 * Sequelize est un ORM : il mappe des classes JS (models/) vers des tables SQL.
 * authenticate() : verifie login/host/mot de passe sans encore synchroniser les tables.
 * require('../models') : enregistre les modeles sur cette instance puis sequelize.sync()
 * cree les tables manquantes (en dev ; en prod on prefere souvent des migrations explicites).
 * MYSQL_SYNC_ALTER=true : altere les tables existantes pour coller aux modeles (risque en prod).
 * =============================================================================
 */

const { Sequelize } = require('sequelize');

// Constructeur Sequelize : base, user, mot de passe, puis objet options (dialect mysql obligatoire).
const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || 'co2_industrial_db',
  process.env.MYSQL_USER || 'root',
  process.env.MYSQL_PASSWORD || '',
  {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    dialect: 'mysql',
    logging: false
  }
);

async function connectMySQL() {
  try {
    await sequelize.authenticate();
    console.log('[mysql] Connexion OK');

    // Charge Site, Sensor et associations (side-effect sur l'instance sequelize).
    require('../models');

    // Par defaut on n'altere pas le schema en runtime.
    // `alter` sur des schemas evolutifs peut empiler des index et finir en
    // "Too many keys specified; max 64 keys allowed".
    const defaultSyncMode = 'off';
    const syncMode = String(process.env.MYSQL_SYNC_MODE || defaultSyncMode).toLowerCase();
    if (syncMode === 'off') {
      console.log('[mysql] sequelize.sync desactive (mode migration SQL recommande)');
      return;
    }

    const syncOptions = {};
    if (syncMode === 'alter' || String(process.env.MYSQL_SYNC_ALTER || '').toLowerCase() === 'true') {
      syncOptions.alter = true;
    }
    if (syncMode === 'force') {
      syncOptions.force = true;
    }

    try {
      await sequelize.sync(syncOptions);
      console.log(`[mysql] Tables synchronisees (sequelize.sync mode=${syncMode})`);
    } catch (syncErr) {
      const msg = String(syncErr?.message || '');
      if (msg.includes('Too many keys specified; max 64 keys allowed')) {
        console.warn('[mysql] sequelize.sync ignore: limite d index MySQL atteinte.');
        console.warn('[mysql] Passez a des migrations SQL et laissez MYSQL_SYNC_MODE=off.');
        return;
      }
      throw syncErr;
    }
  } catch (err) {
    console.error('[mysql] Echec connexion :', err.message);
    throw err;
  }
}

module.exports = {
  sequelize,
  connectMySQL
};
