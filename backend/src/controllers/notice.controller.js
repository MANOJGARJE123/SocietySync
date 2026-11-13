const noticeService = require('../services/notice.service');
const noticeController = {
  async createNotice(req, res) {
    const data = await noticeService.createNotice(req.body, req.user);
    return res.status(201).json({ success: true, message: 'Notice created', data });
  },
  async getAllNotices(req, res) {
    return res.status(200).json({ success: true, data: await noticeService.getAllNotices(req.user) });
  },
  async editNotice(req, res) {
    const data = await noticeService.editNotice(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: 'Notice updated', data });
  },
  async deleteNotice(req, res) {
    const data = await noticeService.deleteNotice(req.params.id, req.user);
    return res.status(200).json({ success: true, message: 'Notice deleted', data });
  },
};
module.exports = noticeController;
