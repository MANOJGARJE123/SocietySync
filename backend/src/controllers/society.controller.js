const societyService = require('../services/society.service');
const societyController = {
  async listSocieties(req, res) {
    return res.status(200).json({ success: true, data: await societyService.listSocieties() });
  },
  async createSociety(req, res) {
    const data = await societyService.createSociety(req.user, req.body);
    return res.status(201).json({ success: true, message: 'Society created', data });
  },
  async getSocietyDetails(req, res) {
    const data = await societyService.getSocietyDetails(req.params.id);
    return res.status(200).json({ success: true, data });
  },
  async addWing(req, res) {
    const data = await societyService.addWing(req.params.id, req.body, req.user);
    return res.status(201).json({ success: true, message: 'Wing added', data });
  },
  async deleteSociety(req, res) {
    const data = await societyService.deleteSociety(req.user, req.params.id);
    return res.status(200).json({ success: true, message: 'Society deleted', data });
  },
};
module.exports = societyController;
