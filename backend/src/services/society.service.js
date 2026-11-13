const societyRepository = require('../repositories/society.repository');
const wingRepository = require('../repositories/wing.repository');
const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/AppError');
const { auditLog } = require('../utils/auditLog');

const societyService = {
  async listSocieties() {
    return societyRepository.findAll();
  },
  async createSociety(adminUser, { name, wings = [] }) {
    if (!name?.trim()) throw new AppError('Society name is required', 400);
    const existing = await societyRepository.findByAdmin(adminUser._id);
    if (existing || adminUser.societyId) throw new AppError('This admin already manages a society', 409);
    const society = await societyRepository.create({ name: name.trim(), createdBy: adminUser._id });
    let createdWings = [];
    if (Array.isArray(wings) && wings.length > 0) {
      const names = [...new Set(wings.map(w => String(w).trim()).filter(Boolean))];
      if (names.length) createdWings = await wingRepository.createMany(names, society._id);
    }
    await userRepository.updateById(adminUser._id, { societyId: society._id });
    await auditLog({ actorId: adminUser._id, action: 'SOCIETY_CREATED', entityType: 'society', entityId: society._id });
    return { ...society, wings: createdWings };
  },
  async getSocietyDetails(societyId) {
    const society = await societyRepository.findById(societyId);
    if (!society) throw new AppError('Society not found', 404);
    const wings = await wingRepository.findBySociety(societyId);
    return { ...society, wings };
  },
  async addWing(societyId, { name }, adminUser) {
    if (!name?.trim()) throw new AppError('Wing name is required', 400);
    const society = await societyRepository.findById(societyId);
    if (!society) throw new AppError('Society not found', 404);
    // Ensure admin owns this society
    if (adminUser && adminUser.role === 'admin' && String(adminUser.societyId) !== String(societyId))
      throw new AppError('You can only add wings to your own society', 403);
    try {
      return await wingRepository.create({ name: name.trim(), societyId });
    } catch (e) {
      if (e.code === '23505') throw new AppError('Wing name already exists in this society', 409);
      throw e;
    }
  },
  async deleteSociety(requester, societyId) {
    if (!['super_admin','admin'].includes(requester.role))
      throw new AppError('Only admins can delete societies', 403);
    const society = await societyRepository.findById(societyId);
    if (!society) throw new AppError('Society not found', 404);
    if (requester.role === 'admin' && String(society.createdBy) !== String(requester._id))
      throw new AppError('You can only delete societies you manage', 403);
    await wingRepository.deleteBySociety(societyId);
    await societyRepository.deleteById(societyId);
    await userRepository.updateById(requester._id, { societyId: null });
    await auditLog({ actorId: requester._id, action: 'SOCIETY_DELETED', entityType: 'society', entityId: societyId });
    return { id: societyId };
  },
};
module.exports = societyService;
