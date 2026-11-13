const authService = require('../services/auth.service');
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/AppError');
const { isStrongPassword } = require('../utils/validators');
const { auditLog } = require('../utils/auditLog');

const authController = {
  async register(req, res) {
    const data = await authService.register(req.body);
    return res.status(201).json({ success: true, message: 'User registered successfully', data });
  },
  async login(req, res) {
    const data = await authService.login(req.body);
    return res.status(200).json({ success: true, message: 'Login successful', data });
  },
  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      throw new AppError('currentPassword and newPassword are required', 400);
    if (!isStrongPassword(newPassword))
      throw new AppError('New password must be at least 8 characters with a letter and a number', 400);
    // Get user with password
    const userWithPw = await userRepository.findByEmail(req.user.email, { includePassword: true });
    const valid = await bcrypt.compare(currentPassword, userWithPw.password);
    if (!valid) throw new AppError('Current password is incorrect', 401);
    const hashed = await bcrypt.hash(newPassword, 12);
    await userRepository.updateById(req.user._id, { password: hashed });
    await auditLog({ actorId: req.user._id, action: 'PASSWORD_CHANGED', entityType: 'user', entityId: req.user._id });
    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  },
};
module.exports = authController;
