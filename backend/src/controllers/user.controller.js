const userService = require('../services/user.service');
const userController = {
  async getAllUsers(req, res) {
    const users = await userService.getAllUsers(req.user);
    return res.status(200).json({ success: true, data: users });
  },
  async getProfile(req, res) {
    return res.status(200).json({ success: true, data: await userService.getProfile(req.user._id) });
  },
  async updateProfile(req, res) {
    const data = await userService.updateProfile(req.user._id, req.body);
    return res.status(200).json({ success: true, message: 'Profile updated', data });
  },
  async registerResident(req, res) {
    const data = await userService.registerResident(req.user, req.body);
    return res.status(201).json({ success: true, message: 'Resident registered', data });
  },
  async updateRole(req, res) {
    const data = await userService.updateRole(req.user, req.params.id, req.body.role);
    return res.status(200).json({ success: true, message: 'Role updated', data });
  },
  async deleteUser(req, res) {
    const data = await userService.deleteUser(req.user, req.params.id);
    return res.status(200).json({ success: true, message: 'User deleted', data });
  },
  async getActiveUsersCount(req, res) {
    return res.status(200).json({ success: true, data: await userService.getActiveUsersCount() });
  },
  async getAllSystemUsers(req, res) {
    return res.status(200).json({ success: true, data: await userService.getAllSystemUsers(req.user) });
  },
};
module.exports = userController;
