const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const wingRepository = require('../repositories/wing.repository');
const AppError = require('../utils/AppError');
const { auditLog } = require('../utils/auditLog');
const { isValidEmail, isStrongPassword, hasLength } = require('../utils/validators');

const userService = {
  // FIX: society-scoped for admin, system-wide only for super_admin
  async getAllUsers(requester) {
    if (requester.role === 'super_admin') return userRepository.findAll();
    if (requester.role === 'admin') {
      if (!requester.societyId) return [];
      return userRepository.findBySociety(requester.societyId);
    }
    throw new AppError('Only admins can view users', 403);
  },

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    return user;
  },

  async updateProfile(userId, payload) {
    const allowed = {};
    if (payload.name !== undefined) {
      if (!hasLength(payload.name, 2, 100)) throw new AppError('Name must be 2–100 chars', 400);
      allowed.name = payload.name.trim();
    }
    if (payload.phone !== undefined) allowed.phone = payload.phone?.trim() || null;
    if (payload.flatNumber !== undefined) allowed.flatNumber = payload.flatNumber?.trim() || null;
    if (!Object.keys(allowed).length) throw new AppError('No valid fields provided', 400);
    const updated = await userRepository.updateById(userId, allowed);
    if (!updated) throw new AppError('User not found', 404);
    await auditLog({ actorId: userId, action: 'PROFILE_UPDATED', entityType: 'user', entityId: userId });
    return updated;
  },

  async registerResident(adminUser, payload) {
    const { name, email, password, wingId, phone, flatNumber } = payload;
    const isAdmin = adminUser.role === 'admin';
    const isChairman = adminUser.role === 'chairman';

    if (!name || !email || !password) throw new AppError('name, email and password are required', 400);
    if (!isValidEmail(email)) throw new AppError('Valid email is required', 400);
    if (!isStrongPassword(password)) throw new AppError('Password must be at least 8 chars with a letter and a number', 400);
    if (!isAdmin && !isChairman) throw new AppError('Only admins or chairmen can add residents', 403);
    if (!adminUser.societyId) throw new AppError('You must belong to a society before adding residents', 400);

    const targetWingId = isChairman ? adminUser.wingId : wingId;
    if (!targetWingId) throw new AppError('wingId is required', 400);
    if (isChairman && wingId && String(wingId) !== String(targetWingId))
      throw new AppError('Chairman can only add residents to their own wing', 403);

    const wing = await wingRepository.findById(targetWingId);
    if (!wing) throw new AppError('Wing not found', 404);
    if (String(wing.societyId) !== String(adminUser.societyId))
      throw new AppError('Wing does not belong to your society', 403);

    const existing = await userRepository.findByEmail(email);
    if (existing) throw new AppError('Email is already registered', 409);

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await userRepository.create({
      name: name.trim(), email: email.toLowerCase().trim(),
      password: hashedPassword, role: 'resident',
      phone: phone?.trim() || null, flatNumber: flatNumber?.trim() || null,
      societyId: adminUser.societyId, wingId: targetWingId, wingStatus: 'approved',
    });
    await auditLog({ actorId: adminUser._id, action: 'RESIDENT_REGISTERED', entityType: 'user', entityId: user._id });
    return user;
  },

  // FIX: admin cannot assign super_admin — only super_admin can
  async updateRole(requester, targetUserId, role) {
    if (!role) throw new AppError('Role is required', 400);

    const adminRoles = ['admin','chairman','resident'];
    const superRoles = ['super_admin','admin','chairman','resident'];
    const allowedRoles = requester.role === 'super_admin' ? superRoles : adminRoles;

    if (!['admin','super_admin'].includes(requester.role))
      throw new AppError('Only admins can change roles', 403);
    if (!allowedRoles.includes(role))
      throw new AppError(`Role must be one of: ${allowedRoles.join(', ')}`, 400);

    const target = await userRepository.findById(targetUserId);
    if (!target) throw new AppError('User not found', 404);

    if (requester.role === 'admin' && String(target.societyId || '') !== String(requester.societyId || ''))
      throw new AppError('You can only change roles for users in your society', 403);

    if (target.role === 'admin' && role !== 'admin') {
      const others = await userRepository.countAdminsExcluding(targetUserId, requester.societyId);
      if (others === 0) throw new AppError('Assign another admin before removing the last admin role', 409);
    }
    if (target.role === 'chairman' && role !== 'chairman') {
      await wingRepository.clearChairmanByUserId(targetUserId);
    }

    const updated = await userRepository.updateById(targetUserId, { role });
    await auditLog({ actorId: requester._id, action: 'ROLE_UPDATED', entityType: 'user', entityId: targetUserId, meta: { oldRole: target.role, newRole: role } });
    return updated;
  },

  async deleteUser(requester, targetUserId) {
    if (!['admin','super_admin'].includes(requester.role))
      throw new AppError('Only admins can delete users', 403);
    const target = await userRepository.findById(targetUserId);
    if (!target) throw new AppError('User not found', 404);
    if (requester.role === 'admin' && String(target.societyId||'') !== String(requester.societyId||''))
      throw new AppError('You can only delete users in your society', 403);
    if (String(targetUserId) === String(requester._id))
      throw new AppError('You cannot delete your own account', 400);
    if (target.role === 'admin') {
      const others = await userRepository.countAdminsExcluding(targetUserId, requester.societyId);
      if (others === 0) throw new AppError('Cannot delete the last admin of a society', 409);
    }
    await userRepository.deleteById(targetUserId);
    await auditLog({ actorId: requester._id, action: 'USER_DELETED', entityType: 'user', entityId: targetUserId });
    return { deleted: true };
  },

  async getActiveUsersCount() { return userRepository.countAllUsers(); },
  async getAllSystemUsers(requester) {
    if (!['super_admin','admin'].includes(requester.role))
      throw new AppError('Only admins can view all users', 403);
    if (requester.role === 'admin') return userRepository.findBySociety(requester.societyId);
    return userRepository.findAll();
  },
};

module.exports = userService;
