const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { CompanyUser, CompanyUserRole, Role, User, sequelize } = require('../models');
const { successResponse } = require('../utils/apiResponse');
const { HttpError } = require('../utils/httpError');

const SALT_ROUNDS = 10;

function normalizeRole(role) {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'TECHNICIAN' || value === 'TECHNICIEN' || value === 'TECH') return 'TECHNICIAN';
  if (value === 'CLIENT' || value === 'USER' || value === 'UTILISATEUR') return 'CLIENT';
  return 'CLIENT';
}

function pickRole(req) {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  return normalizeRole(roles[0] || '');
}

function resolveCompanyId(req) {
  const companyId = req.user?.activeCompanyId ? Number(req.user.activeCompanyId) : null;
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new HttpError(400, 'companyId requis (token)', 'VALIDATION_ERROR');
  }
  return companyId;
}

function choosePrimaryRole(roleCodes = []) {
  const set = new Set(roleCodes.map(normalizeRole));
  if (set.has('ADMIN')) return 'ADMIN';
  if (set.has('TECHNICIAN')) return 'TECHNICIAN';
  return 'CLIENT';
}

async function list(req, res, next) {
  try {
    if (pickRole(req) !== 'ADMIN') throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    const companyId = resolveCompanyId(req);

    const memberships = await CompanyUser.findAll({
      where: { companyId },
      include: [
        { model: User, as: 'user' },
        { model: Role, as: 'roles', through: { attributes: [] } }
      ],
      order: [['id', 'DESC']]
    });

    const out = memberships.map((m) => {
      const roles = Array.isArray(m.roles) ? m.roles.map((r) => r.code) : [];
      return {
        companyUserId: m.id,
        userId: m.userId,
        name: m.user?.name || m.user?.email || '—',
        email: m.user?.email || '—',
        role: choosePrimaryRole(roles),
        roles
      };
    });

    return res.json(successResponse(out));
  } catch (err) {
    return next(err);
  }
}

async function invite(req, res, next) {
  try {
    if (pickRole(req) !== 'ADMIN') throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    const companyId = resolveCompanyId(req);
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const roleCode = normalizeRole(req.body?.role);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'email invalide', 'VALIDATION_ERROR');
    }

    const role = await Role.findOne({ where: { code: roleCode } });
    if (!role) throw new HttpError(500, `RBAC non initialise (role ${roleCode})`, 'RBAC_NOT_READY');

    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    const created = await sequelize.transaction(async (t) => {
      let user = await User.findOne({ where: { email }, transaction: t, lock: t.LOCK.UPDATE });
      if (!user) {
        user = await User.create(
          {
            email,
            passwordHash,
            name: name || null
          },
          { transaction: t }
        );
      }

      let membership = await CompanyUser.findOne({
        where: { companyId, userId: user.id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!membership) {
        membership = await CompanyUser.create(
          {
            companyId,
            userId: user.id,
            membershipStatus: 'ACTIVE',
            joinedAt: new Date()
          },
          { transaction: t }
        );
      }

      // Remplacer les roles existants par 1 role “principal”
      await CompanyUserRole.destroy({ where: { companyUserId: membership.id }, transaction: t });
      await CompanyUserRole.create(
        { companyUserId: membership.id, roleId: role.id, assignedAt: new Date() },
        { transaction: t }
      );

      return { membership, user };
    });

    // Note: dans une appli réelle, ce mot de passe temporaire est envoyé par email, jamais renvoyé au client.
    return res.json(
      successResponse({
        companyUserId: created.membership.id,
        userId: created.user.id,
        name: created.user.name || created.user.email,
        email: created.user.email,
        role: roleCode,
        tempPassword
      })
    );
  } catch (err) {
    return next(err);
  }
}

async function updateRole(req, res, next) {
  try {
    if (pickRole(req) !== 'ADMIN') throw new HttpError(403, 'Accès interdit', 'FORBIDDEN');
    const companyId = resolveCompanyId(req);
    const companyUserId = Number(req.params.id);
    const roleCode = normalizeRole(req.body?.role);

    const role = await Role.findOne({ where: { code: roleCode } });
    if (!role) throw new HttpError(500, `RBAC non initialise (role ${roleCode})`, 'RBAC_NOT_READY');

    const updated = await sequelize.transaction(async (t) => {
      const membership = await CompanyUser.findOne({
        where: { id: companyUserId, companyId },
        transaction: t,
        lock: t.LOCK.UPDATE,
        include: [{ model: User, as: 'user' }]
      });
      if (!membership) throw new HttpError(404, 'Utilisateur introuvable', 'NOT_FOUND');

      await CompanyUserRole.destroy({ where: { companyUserId: membership.id }, transaction: t });
      await CompanyUserRole.create(
        { companyUserId: membership.id, roleId: role.id, assignedAt: new Date() },
        { transaction: t }
      );

      return membership;
    });

    return res.json(
      successResponse({
        companyUserId: updated.id,
        userId: updated.userId,
        name: updated.user?.name || updated.user?.email || '—',
        email: updated.user?.email || '—',
        role: roleCode
      })
    );
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  invite,
  updateRole
};

