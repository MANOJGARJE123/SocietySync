const maintenanceRepository = require('../repositories/maintenance.repository');
const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/AppError');
const { isValidMonth } = require('../utils/validators');
const { auditLog } = require('../utils/auditLog');

const VALID_METHODS = ['online','cash','cheque','upi','neft','bank_transfer'];

const maintenanceService = {
  async createDue(payload, adminUser) {
    const { userId, month, amountDue, dueDate } = payload;
    if (!userId || !month || amountDue === undefined || !dueDate)
      throw new AppError('userId, month, amountDue and dueDate are required', 400);

    // FIX: validate month format strictly
    if (!isValidMonth(month))
      throw new AppError('month must be in YYYY-MM format (e.g. 2026-01)', 400);

    if (Number(amountDue) < 0) throw new AppError('amountDue cannot be negative', 400);
    if (Number(amountDue) === 0) throw new AppError('amountDue must be greater than zero', 400);

    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    // Admin can only create dues for users in their own society
    if (adminUser && adminUser.role === 'admin' &&
        String(user.societyId || '') !== String(adminUser.societyId || ''))
      throw new AppError('You can only create dues for residents in your society', 403);

    try {
      return await maintenanceRepository.create({
        userId, month, amountDue: Number(amountDue), dueDate,
        societyId: user.societyId || null,
      });
    } catch (e) {
      if (e.code === '23505') throw new AppError('Maintenance due already exists for this user and month', 409);
      throw e;
    }
  },

  // FIX: society-scoped
  async getAllDues(requester) {
    if (!requester.societyId) return [];
    return maintenanceRepository.findBySociety(requester.societyId);
  },

  async getMyDues(userId) {
    return maintenanceRepository.findByUserId(userId);
  },

  async addPayment(maintenanceId, { amount, method = 'online', reference }, requester) {
    if (!amount || Number(amount) <= 0) throw new AppError('Payment amount must be greater than zero', 400);

    // FIX: validate method
    if (!VALID_METHODS.includes(method))
      throw new AppError(`Payment method must be one of: ${VALID_METHODS.join(', ')}`, 400);

    const maintenance = await maintenanceRepository.findById(maintenanceId);
    if (!maintenance) throw new AppError('Maintenance record not found', 404);

    // FIX: block payment on already-paid record
    if (maintenance.status === 'paid')
      throw new AppError('This due is already fully paid', 400);

    if (['resident','chairman'].includes(requester.role) &&
        String(maintenance.userId._id) !== String(requester._id))
      throw new AppError('You can only pay your own maintenance dues', 403);

    const remaining = Number(maintenance.amountDue) - Number(maintenance.paidAmount);

    // FIX: cap payment at remaining balance — no overpayment
    const payAmount = Math.min(Number(amount), remaining);
    if (payAmount <= 0) throw new AppError('No outstanding balance to pay', 400);

    const updatedPaid = Number(maintenance.paidAmount) + payAmount;
    const status = updatedPaid >= Number(maintenance.amountDue) ? 'paid'
      : updatedPaid > 0 ? 'partial' : 'due';

    const paymentRecords = [
      ...(maintenance.paymentRecords || []),
      { amount: payAmount, paidAt: new Date(), method, reference: reference || null },
    ];

    const result = await maintenanceRepository.updateById(maintenanceId, { paidAmount: updatedPaid, status, paymentRecords });
    await auditLog({
      actorId: requester._id, action: 'PAYMENT_RECORDED', entityType: 'maintenance',
      entityId: maintenanceId, meta: { amount: payAmount, method, status },
    });
    return result;
  },

  async notifyResident(maintenanceId) {
    const maintenance = await maintenanceRepository.findById(maintenanceId);
    if (!maintenance) throw new AppError('Maintenance record not found', 404);
    if (maintenance.status === 'paid') throw new AppError('Cannot notify resident for fully paid dues', 400);
    return maintenanceRepository.updateById(maintenanceId, {
      lastReminderAt: new Date(),
      reminderCount: Number(maintenance.reminderCount || 0) + 1,
    });
  },
};

module.exports = maintenanceService;
