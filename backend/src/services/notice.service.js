const noticeRepository = require('../repositories/notice.repository');
const AppError = require('../utils/AppError');
const { auditLog } = require('../utils/auditLog');
const { hasLength } = require('../utils/validators');

const noticeService = {
  async createNotice(payload, requester) {
    const { title, content, expiryDays = 7 } = payload;
    if (!title || !content) throw new AppError('Title and content are required', 400);
    if (!hasLength(title, 3, 200)) throw new AppError('Title must be 3–200 characters', 400);
    if (!hasLength(content, 10, 10000)) throw new AppError('Content must be 10–10000 characters', 400);

    const days = Number(expiryDays);
    if (!Number.isInteger(days) || days < 1 || days > 365)
      throw new AppError('expiryDays must be 1–365', 400);
    if (!requester?.societyId) throw new AppError('User must belong to a society to create notices', 400);

    const isChairman = requester.role === 'chairman';
    const wingId = isChairman ? requester.wingId : payload.wingId;
    if (isChairman && !wingId) throw new AppError('Chairman must belong to a wing to create notices', 400);

    const notice = await noticeRepository.create({
      title: title.trim(), content: content.trim(),
      createdBy: requester._id, societyId: requester.societyId, wingId,
      expiryDays: days, expiresAt: new Date(Date.now() + days * 86400000),
    });
    await auditLog({ actorId: requester._id, action: 'NOTICE_CREATED', entityType: 'notice', entityId: notice.id });
    return notice;
  },

  async getAllNotices(user) {
    return noticeRepository.findForUser(user);
  },

  // NEW: edit notice
  async editNotice(noticeId, payload, requester) {
    const notice = await noticeRepository.findById(noticeId);
    if (!notice) throw new AppError('Notice not found', 404);

    // Only admin of same society or notice creator can edit
    const isCreator = String(notice.createdBy?.id) === String(requester._id);
    const isAdmin = requester.role === 'admin' && String(notice.societyId) === String(requester.societyId);
    if (!isCreator && !isAdmin) throw new AppError('You do not have permission to edit this notice', 403);

    const update = {};
    if (payload.title !== undefined) {
      if (!hasLength(payload.title, 3, 200)) throw new AppError('Title must be 3–200 characters', 400);
      update.title = payload.title.trim();
    }
    if (payload.content !== undefined) {
      if (!hasLength(payload.content, 10, 10000)) throw new AppError('Content must be 10–10000 characters', 400);
      update.content = payload.content.trim();
    }
    if (payload.expiryDays !== undefined) {
      const days = Number(payload.expiryDays);
      if (!Number.isInteger(days) || days < 1 || days > 365)
        throw new AppError('expiryDays must be 1–365', 400);
      update.expiryDays = days;
      update.expiresAt = new Date(Date.now() + days * 86400000);
    }
    return noticeRepository.updateById(noticeId, update);
  },

  // NEW: delete notice
  async deleteNotice(noticeId, requester) {
    const notice = await noticeRepository.findById(noticeId);
    if (!notice) throw new AppError('Notice not found', 404);

    const isCreator = String(notice.createdBy?.id) === String(requester._id);
    const isAdmin = requester.role === 'admin' && String(notice.societyId) === String(requester.societyId);
    if (!isCreator && !isAdmin) throw new AppError('You do not have permission to delete this notice', 403);

    const deleted = await noticeRepository.deleteById(noticeId, requester.societyId);
    if (!deleted) throw new AppError('Notice not found or already deleted', 404);
    await auditLog({ actorId: requester._id, action: 'NOTICE_DELETED', entityType: 'notice', entityId: noticeId });
    return { deleted: true };
  },
};

module.exports = noticeService;
