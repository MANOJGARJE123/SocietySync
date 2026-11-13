const wingRepository = require('../repositories/wing.repository');
const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/AppError');
const { auditLog } = require('../utils/auditLog');

const wingService = {
  async getWingsBySociety(societyId) {
    return wingRepository.findBySociety(societyId);
  },

  async assignChairman(wingId, chairmanId, adminUser) {
    const wing = await wingRepository.findById(wingId);
    if (!wing) throw new AppError('Wing not found', 404);
    if (String(adminUser.societyId) !== String(wing.societyId))
      throw new AppError('Wing does not belong to your society', 403);
    const chairman = await userRepository.findById(chairmanId);
    if (!chairman) throw new AppError('User not found', 404);
    if (chairman.role !== 'chairman') throw new AppError('User must have chairman role first', 400);
    if (chairman.societyId && String(chairman.societyId) !== String(wing.societyId))
      throw new AppError('Chairman belongs to a different society', 403);
    const existing = await wingRepository.findByChairman(chairmanId);
    if (existing && String(existing._id) !== String(wingId))
      throw new AppError('This chairman is already assigned to another wing', 409);
    if (wing.chairmanId && String(wing.chairmanId) !== String(chairmanId)) {
      await userRepository.updateById(String(wing.chairmanId), { wingId: null });
    }
    const updatedWing = await wingRepository.updateById(wingId, { chairmanId });
    await userRepository.updateById(chairmanId, { wingId, societyId: wing.societyId, wingStatus: 'approved' });
    await auditLog({ actorId: adminUser._id, action: 'CHAIRMAN_ASSIGNED', entityType: 'wing', entityId: wingId, meta: { chairmanId } });
    return updatedWing;
  },

  async assignChairmanByContact(wingId, contact, adminUser) {
    const wing = await wingRepository.findById(wingId);
    if (!wing) throw new AppError('Wing not found', 404);
    if (String(adminUser.societyId) !== String(wing.societyId))
      throw new AppError('Wing does not belong to your society', 403);
    const chairman = contact.includes('@')
      ? await userRepository.findByEmail(contact)
      : await userRepository.findByPhone(contact);
    if (!chairman) throw new AppError('User not found with that email/phone', 404);
    if (chairman.role !== 'chairman') throw new AppError('User must have chairman role first', 400);
    return wingService.assignChairman(wingId, chairman._id, adminUser);
  },

  // FIX: prevent duplicate pending join requests
  async requestJoinWing(requester, wingId) {
    if (!wingId) throw new AppError('Wing ID is required', 400);
    if (requester.role !== 'resident') throw new AppError('Only residents can request to join a wing', 403);
    // FIXED: block if already pending or already approved
    if (requester.wingStatus === 'approved')
      throw new AppError('You are already an approved member of a wing', 409);
    if (requester.wingStatus === 'pending')
      throw new AppError('You already have a pending join request. Wait for approval.', 409);
    const wing = await wingRepository.findById(wingId);
    if (!wing) throw new AppError('Wing not found', 404);
    const updated = await userRepository.updateById(requester._id, {
      societyId: wing.societyId,
      wingId: null,
      requestedWingId: wingId,
      wingStatus: 'pending',
    });
    await auditLog({ actorId: requester._id, action: 'WING_JOIN_REQUESTED', entityType: 'wing', entityId: wingId });
    return updated;
  },

  async listPendingRequests(requester, wingId) {
    if (requester.role !== 'chairman') throw new AppError('Only chairmen can view pending requests', 403);
    if (!requester.wingId || String(requester.wingId) !== String(wingId))
      throw new AppError('You can only view requests for your own wing', 403);
    return userRepository.findPendingByWing(wingId);
  },

  async listMembers(requester, wingId) {
    if (!['chairman','admin'].includes(requester.role))
      throw new AppError('Only chairmen and admins can view wing members', 403);
    const wing = await wingRepository.findById(wingId);
    if (!wing) throw new AppError('Wing not found', 404);
    if (requester.role === 'chairman' && String(requester.wingId) !== String(wingId))
      throw new AppError('You can only view members of your own wing', 403);
    if (requester.role === 'admin' && String(requester.societyId) !== String(wing.societyId))
      throw new AppError('Wing does not belong to your society', 403);
    return userRepository.findApprovedByWing(wingId);
  },

  async approveRequest(requester, wingId, userId) {
    if (requester.role !== 'chairman') throw new AppError('Only chairmen can approve requests', 403);
    if (!requester.wingId || String(requester.wingId) !== String(wingId))
      throw new AppError('You can only approve requests for your own wing', 403);
    const resident = await userRepository.findById(userId);
    if (!resident) throw new AppError('User not found', 404);
    if (resident.wingStatus !== 'pending')
      throw new AppError('No pending request found for this user', 400);
    if (String(resident.requestedWingId) !== String(wingId))
      throw new AppError('User did not request to join this wing', 400);
    const wing = await wingRepository.findById(wingId);
    const updated = await userRepository.updateById(userId, {
      wingId, societyId: wing.societyId, requestedWingId: null, wingStatus: 'approved',
    });
    await auditLog({ actorId: requester._id, action: 'WING_REQUEST_APPROVED', entityType: 'wing', entityId: wingId, meta: { userId } });
    return updated;
  },

  async rejectRequest(requester, wingId, userId) {
    if (requester.role !== 'chairman') throw new AppError('Only chairmen can reject requests', 403);
    if (!requester.wingId || String(requester.wingId) !== String(wingId))
      throw new AppError('You can only reject requests for your own wing', 403);
    const resident = await userRepository.findById(userId);
    if (!resident) throw new AppError('User not found', 404);
    if (resident.wingStatus !== 'pending')
      throw new AppError('No pending request found for this user', 400);
    const updated = await userRepository.updateById(userId, {
      requestedWingId: null, wingStatus: 'rejected',
    });
    await auditLog({ actorId: requester._id, action: 'WING_REQUEST_REJECTED', entityType: 'wing', entityId: wingId, meta: { userId } });
    return updated;
  },

  async removeMember(requester, wingId, userId) {
    if (!['chairman','admin'].includes(requester.role))
      throw new AppError('Only chairmen and admins can remove members', 403);
    if (requester.role === 'chairman' && String(requester.wingId) !== String(wingId))
      throw new AppError('You can only remove members from your own wing', 403);
    const resident = await userRepository.findById(userId);
    if (!resident) throw new AppError('User not found', 404);
    if (String(resident.wingId) !== String(wingId))
      throw new AppError('User does not belong to this wing', 400);
    const updated = await userRepository.updateById(userId, { wingId: null, wingStatus: 'none' });
    await auditLog({ actorId: requester._id, action: 'MEMBER_REMOVED', entityType: 'wing', entityId: wingId, meta: { userId } });
    return updated;
  },
};

module.exports = wingService;
