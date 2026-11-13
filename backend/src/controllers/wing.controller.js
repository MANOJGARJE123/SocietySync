const wingService = require('../services/wing.service');
const wingController = {
  async getWingsBySociety(req, res) {
    return res.status(200).json({ success: true, data: await wingService.getWingsBySociety(req.params.id) });
  },
  async assignChairman(req, res) {
    const data = await wingService.assignChairman(req.params.id, req.body.chairmanId, req.user);
    return res.status(200).json({ success: true, message: 'Chairman assigned', data });
  },
  async assignChairmanByContact(req, res) {
    const data = await wingService.assignChairmanByContact(req.params.id, req.body.contact, req.user);
    return res.status(200).json({ success: true, message: 'Chairman assigned', data });
  },
  async requestJoinWing(req, res) {
    const data = await wingService.requestJoinWing(req.user, req.params.id);
    return res.status(200).json({ success: true, message: 'Join request sent', data });
  },
  async listPendingRequests(req, res) {
    return res.status(200).json({ success: true, data: await wingService.listPendingRequests(req.user, req.params.id) });
  },
  async listMembers(req, res) {
    return res.status(200).json({ success: true, data: await wingService.listMembers(req.user, req.params.id) });
  },
  async approveRequest(req, res) {
    const data = await wingService.approveRequest(req.user, req.params.id, req.params.userId);
    return res.status(200).json({ success: true, message: 'Request approved', data });
  },
  async rejectRequest(req, res) {
    const data = await wingService.rejectRequest(req.user, req.params.id, req.params.userId);
    return res.status(200).json({ success: true, message: 'Request rejected', data });
  },
  async removeMember(req, res) {
    const data = await wingService.removeMember(req.user, req.params.id, req.params.userId);
    return res.status(200).json({ success: true, message: 'Member removed', data });
  },
};
module.exports = wingController;
