const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Company, CompanyUser, Role, CompanyUserRole } = require('../models');
const { HttpError } = require('../utils/httpError');

function assertMysqlForAuth() {
  if (String(process.env.MYSQL_ENABLED || 'true').toLowerCase() === 'false') {
    throw new HttpError(503, 'Authentification indisponible (MySQL desactive)', 'MYSQL_UNAVAILABLE');
  }
}

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-use-long-random-string';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

async function ensureSystemRoles() {
  const requiredRoles = [
    { code: 'ADMIN', name: 'Administrateur', description: 'Acces complet' },
    { code: 'CLIENT', name: 'Client', description: 'Consultation et gestion metier' },
    { code: 'TECHNICIAN', name: 'Technicien', description: 'Maintenance et operationnel' }
  ];

  for (const role of requiredRoles) {
    await Role.findOrCreate({
      where: { code: role.code },
      defaults: { ...role, isSystemRole: true }
    });
  }
}

function toPublicUser(user) {
  const j = user.toJSON ? user.toJSON() : user;
  delete j.passwordHash;
  return j;
}

function slugifyTenantKey(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function loadMemberships(userId) {
  const rows = await CompanyUser.findAll({
    where: { userId, membershipStatus: 'ACTIVE' },
    include: [
      { model: Company, as: 'company' },
      { model: Role, as: 'roles', through: { attributes: [] } }
    ]
  });

  return rows.map((row) => {
    const j = row.toJSON();
    return {
      companyUserId: j.id,
      companyId: j.companyId,
      company: j.company,
      roles: (j.roles || []).map((r) => r.code)
    };
  });
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function normalizeRequestedRole(inputRole) {
  const value = String(inputRole || '').trim().toUpperCase();
  if (['ADMIN', 'TECHNICIAN', 'CLIENT'].includes(value)) return value;
  if (value === 'TECHNICIEN' || value === 'TECH') return 'TECHNICIAN';
  if (value === 'USER' || value === 'UTILISATEUR') return 'CLIENT';
  return 'CLIENT';
}

async function register({ email, password, name, companyName, tenantKey, role }) {
  assertMysqlForAuth();
  await ensureSystemRoles();
  if (!email || typeof email !== 'string') {
    throw new HttpError(400, 'email requis', 'VALIDATION_ERROR');
  }
  if (!password || String(password).length < 8) {
    throw new HttpError(400, 'mot de passe requis (min 8 caracteres)', 'VALIDATION_ERROR');
  }

  const normalized = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);

  let user;
  try {
    user = await User.create({
      email: normalized,
      passwordHash,
      name: name ? String(name).trim() : null
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'Email deja utilise', 'CONFLICT');
    }
    throw err;
  }

  const baseName = (companyName && String(companyName).trim()) || `${normalized.split('@')[0]}-company`;
  const tenantBase = slugifyTenantKey(tenantKey || baseName) || `tenant-${Date.now()}`;
  const company = await Company.create({
    tenantKey: `${tenantBase}-${Date.now().toString().slice(-6)}`,
    legalName: baseName,
    displayName: baseName,
    status: 'ACTIVE'
  });

  const membership = await CompanyUser.create({
    companyId: company.id,
    userId: user.id,
    membershipStatus: 'ACTIVE',
    joinedAt: new Date()
  });

  const requestedRoleCode = normalizeRequestedRole(role);
  const requestedRole = await Role.findOne({ where: { code: requestedRoleCode } });
  if (!requestedRole) {
    throw new HttpError(500, `RBAC non initialise (role ${requestedRoleCode} manquant)`, 'RBAC_NOT_READY');
  }

  await CompanyUserRole.create({
    companyUserId: membership.id,
    roleId: requestedRole.id,
    assignedAt: new Date()
  });

  const memberships = await loadMemberships(user.id);
  const active = memberships[0];

  const token = signToken({
    sub: user.id,
    email: user.email,
    activeCompanyId: active?.companyId || null,
    roles: active?.roles || [],
    memberships: memberships.map((m) => ({ companyId: m.companyId, roles: m.roles }))
  });

  return {
    token,
    user: toPublicUser(user),
    memberships
  };
}

async function login({ email, password, companyId }) {
  assertMysqlForAuth();
  await ensureSystemRoles();
  if (!email || !password) {
    throw new HttpError(400, 'email et mot de passe requis', 'VALIDATION_ERROR');
  }
  const normalized = email.trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalized } });
  if (!user) {
    throw new HttpError(401, 'Identifiants invalides', 'UNAUTHORIZED');
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    throw new HttpError(401, 'Identifiants invalides', 'UNAUTHORIZED');
  }

  await user.update({ lastLoginAt: new Date() });

  const memberships = await loadMemberships(user.id);
  if (!memberships.length) {
    throw new HttpError(403, 'Aucune entreprise associee a cet utilisateur', 'NO_COMPANY_ACCESS');
  }

  const forcedCompanyId = companyId !== undefined && companyId !== null ? Number(companyId) : null;
  const active =
    (forcedCompanyId && memberships.find((m) => Number(m.companyId) === forcedCompanyId)) || memberships[0];

  const token = signToken({
    sub: user.id,
    email: user.email,
    activeCompanyId: active.companyId,
    roles: active.roles,
    memberships: memberships.map((m) => ({ companyId: m.companyId, roles: m.roles }))
  });

  const plain = await User.findByPk(user.id);
  return { token, user: toPublicUser(plain), memberships, activeCompanyId: active.companyId };
}

async function updateProfile(userId, { name, email, currentPassword, newPassword }) {
  assertMysqlForAuth();
  const user = await User.findByPk(userId);
  if (!user) {
    throw new HttpError(404, 'Utilisateur introuvable', 'NOT_FOUND');
  }

  const patch = {};
  if (name !== undefined) {
    patch.name = String(name).trim();
  }
  if (email !== undefined) {
    patch.email = String(email).trim().toLowerCase();
  }
  if (newPassword !== undefined) {
    const validCurrent = await bcrypt.compare(String(currentPassword || ''), user.passwordHash);
    if (!validCurrent) {
      throw new HttpError(401, 'Mot de passe actuel incorrect', 'UNAUTHORIZED');
    }
    patch.passwordHash = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
    patch.passwordChangedAt = new Date();
  }

  try {
    await user.update(patch);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'Email deja utilise', 'CONFLICT');
    }
    throw err;
  }

  const refreshed = await User.findByPk(userId);
  const memberships = await loadMemberships(userId);
  const active = memberships[0];
  const token = signToken({
    sub: refreshed.id,
    email: refreshed.email,
    activeCompanyId: active?.companyId || null,
    roles: active?.roles || [],
    memberships: memberships.map((m) => ({ companyId: m.companyId, roles: m.roles }))
  });

  return {
    token,
    user: toPublicUser(refreshed),
    memberships
  };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = {
  register,
  login,
  updateProfile,
  verifyToken,
  signToken,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
