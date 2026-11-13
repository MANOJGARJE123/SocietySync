const maintenanceService = require('../services/maintenance.service');
const maintenanceController = {
  async createDue(req, res) {
    const due = await maintenanceService.createDue(req.body, req.user);
    return res.status(201).json({ success: true, message: 'Maintenance due created', data: due });
  },
  async getAllDues(req, res) {
    return res.status(200).json({ success: true, data: await maintenanceService.getAllDues(req.user) });
  },
  async getMyDues(req, res) {
    return res.status(200).json({ success: true, data: await maintenanceService.getMyDues(req.user._id) });
  },
  async addPayment(req, res) {
    const data = await maintenanceService.addPayment(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: 'Payment recorded', data });
  },
  async notifyResident(req, res) {
    const data = await maintenanceService.notifyResident(req.params.id);
    return res.status(200).json({ success: true, message: 'Resident notified', data });
  },
};
module.exports = maintenanceController;
