const { Op } = require('sequelize');
const { AiProject } = require('../models');
const { HttpError } = require('../utils/httpError');

function assertMysql() {
  if (String(process.env.MYSQL_ENABLED || 'true').toLowerCase() === 'false') {
    throw new HttpError(503, 'MySQL desactive', 'MYSQL_UNAVAILABLE');
  }
}

function resolveCompanyIdFromUserOrQuery(user, query = {}) {
  const q = query.companyId !== undefined ? Number(query.companyId) : null;
  const u = user?.activeCompanyId ? Number(user.activeCompanyId) : null;
  const companyId = q || u;
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new HttpError(400, 'companyId requis (token ou query)', 'VALIDATION_ERROR');
  }
  return companyId;
}

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

async function listAiProjects(query = {}, user) {
  assertMysql();
  const companyId = resolveCompanyIdFromUserOrQuery(user, query);

  const where = { companyId };
  if (query.status) where.status = String(query.status).toUpperCase();
  if (query.category) where.category = String(query.category);
  if (query.algorithmType) where.algorithmType = String(query.algorithmType);

  if (query.search && String(query.search).trim()) {
    const s = `%${String(query.search).trim()}%`;
    where[Op.or] = [
      { title: { [Op.like]: s } },
      { supervisorName: { [Op.like]: s } },
      { category: { [Op.like]: s } },
      { algorithmType: { [Op.like]: s } }
    ];
  }

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
  const rows = await AiProject.findAll({ where, order: [['updated_at', 'DESC']], limit });

  // normaliser pour le front (progress 0..100)
  return rows.map((r) => {
    const p = r.toJSON ? r.toJSON() : r;
    return {
      ...p,
      backendProgress: clampPct(p.backendProgress),
      frontendProgress: clampPct(p.frontendProgress),
      aiReadinessScore: p.aiReadinessScore != null ? Number(p.aiReadinessScore) : null
    };
  });
}

module.exports = {
  listAiProjects
};

