const complaintRepository = require('../repositories/complaint.repository');
const AppError = require('../utils/AppError');
const { auditLog } = require('../utils/auditLog');
const { hasLength } = require('../utils/validators');

const VALID_STATUSES = ['pending','in_progress','resolved','rejected'];

const complaintService = {
  async createComplaint({ title, description }, userId, imageUrl, societyId) {
    if (!title || !description) throw new AppError('Title and description are required', 400);
    if (!hasLength(title, 3, 200)) throw new AppError('Title must be 3–200 characters', 400);
    if (!hasLength(description, 10, 5000)) throw new AppError('Description must be 10–5000 characters', 400);
    const complaint = await complaintRepository.create({
      title: title.trim(), description: description.trim(),
      imageUrl, createdBy: userId, societyId: societyId || null,
    });
    await auditLog({ actorId: userId, action: 'COMPLAINT_CREATED', entityType: 'complaint', entityId: complaint.id });
    return complaint;
  },

  // FIX: admin sees only their society's complaints
  async getAllComplaints(requester) {
    if (requester.role === 'admin') {
      if (!requester.societyId) return [];
      return complaintRepository.findBySociety(requester.societyId);
    }
    if (requester.role === 'chairman') {
      if (!requester.wingId) throw new AppError('Chairman must belong to a wing', 400);
      return complaintRepository.findByWingId(requester.wingId);
    }
    throw new AppError('You are not allowed to view these complaints', 403);
  },

  async getMyComplaints(userId) {
    return complaintRepository.findByUserId(userId);
  },

  async updateComplaintStatus(complaintId, status, requester) {
    if (!VALID_STATUSES.includes(status))
      throw new AppError(`Status must be one of: ${VALID_STATUSES.join(', ')}`, 400);

    const complaint = await complaintRepository.findById(complaintId);
    if (!complaint) throw new AppError('Complaint not found', 404);

    if (requester.role === 'chairman') {
      if (!requester.wingId) throw new AppError('Chairman must belong to a wing', 400);
      if (String(complaint.createdBy?.wingId) !== String(requester.wingId))
        throw new AppError('You can only update complaints from your wing', 403);
    }
    if (requester.role === 'admin') {
      if (complaint.societyId && String(complaint.societyId) !== String(requester.societyId))
        throw new AppError('You can only update complaints from your society', 403);
    }

    const updated = await complaintRepository.updateById(complaintId, {
      status,
      resolvedAt: status === 'resolved' ? new Date() : (status === 'pending' ? null : undefined),
    });
    await auditLog({ actorId: requester._id, action: 'COMPLAINT_STATUS_UPDATED', entityType: 'complaint', entityId: complaintId, meta: { status } });
    return updated;
  },

  // NEW: edit complaint (owner only)
  async editComplaint(complaintId, payload, userId) {
    const complaint = await complaintRepository.findById(complaintId);
    if (!complaint) throw new AppError('Complaint not found', 404);
    if (String(complaint.createdBy?.id) !== String(userId))
      throw new AppError('You can only edit your own complaints', 403);
    if (complaint.status === 'resolved')
      throw new AppError('Cannot edit a resolved complaint', 400);

    const update = {};
    if (payload.title !== undefined) {
      if (!hasLength(payload.title, 3, 200)) throw new AppError('Title must be 3–200 characters', 400);
      update.title = payload.title.trim();
    }
    if (payload.description !== undefined) {
      if (!hasLength(payload.description, 10, 5000)) throw new AppError('Description must be 10–5000 characters', 400);
      update.description = payload.description.trim();
    }
    return complaintRepository.updateById(complaintId, update);
  },

  // NEW: delete complaint (owner or admin)
  async deleteComplaint(complaintId, requester) {
    const complaint = await complaintRepository.findById(complaintId);
    if (!complaint) throw new AppError('Complaint not found', 404);

    const isOwner = String(complaint.createdBy?.id) === String(requester._id);
    const isAdmin = requester.role === 'admin' &&
      (!complaint.societyId || String(complaint.societyId) === String(requester.societyId));

    if (!isOwner && !isAdmin)
      throw new AppError('You do not have permission to delete this complaint', 403);

    await complaintRepository.deleteById(complaintId);
    await auditLog({ actorId: requester._id, action: 'COMPLAINT_DELETED', entityType: 'complaint', entityId: complaintId });
    return { deleted: true };
  },
};

module.exports = complaintService;
