const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const wingRepository = require('../repositories/wing.repository');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/jwt');
const { isValidEmail, isStrongPassword } = require('../utils/validators');
const { auditLog } = require('../utils/auditLog');

const buildUser = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role,
  phone: u.phone, flatNumber: u.flatNumber, societyId: u.societyId,
  wingId: u.wingId, requestedWingId: u.requestedWingId, wingStatus: u.wingStatus,
});

const authService = {
  async register(payload) {
    const { name, email, password, phone, flatNumber, wingId } = payload;

    if (!name?.trim() || !email || !password)
      throw new AppError('Name, email and password are required', 400);
    if (!isValidEmail(email))
      throw new AppError('Please provide a valid email address', 400);
    if (!isStrongPassword(password))
      throw new AppError('Password must be at least 8 characters and contain a letter and a number', 400);
    if (!name.trim() || name.trim().length < 2 || name.trim().length > 100)
      throw new AppError('Name must be 2–100 characters', 400);

    const existing = await userRepository.findByEmail(email);
    if (existing) throw new AppError('Email is already registered', 409);

    const hashedPassword = await bcrypt.hash(password, 12);

    // SECURITY FIX: role is ALWAYS 'resident' on public registration.
    const role = 'resident';

    let societyId, requestedWingId, wingStatus = 'none';
    if (wingId) {
      const wing = await wingRepository.findById(wingId);
      if (!wing) throw new AppError('Wing not found', 404);
      societyId = wing.societyId;
      requestedWingId = wingId;
      wingStatus = 'pending';
    }

    const user = await userRepository.create({
      name: name.trim(), email: email.toLowerCase().trim(),
      password: hashedPassword, role, phone: phone?.trim() || null,
      flatNumber: flatNumber?.trim() || null, societyId, requestedWingId, wingStatus,
    });

    await auditLog({ actorId: user._id, action: 'USER_REGISTERED', entityType: 'user', entityId: user._id });
    const token = signToken({ userId: user._id, role: user.role });
    return { token, user: buildUser(user) };
  },

  async login({ email, password }) {
    if (!email || !password) throw new AppError('Email and password are required', 400);

    const user = await userRepository.findByEmail(email, { includePassword: true });
    if (!user) throw new AppError('Invalid email or password', 401);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError('Invalid email or password', 401);

    await auditLog({ actorId: user._id, action: 'USER_LOGIN', entityType: 'user', entityId: user._id });
    const token = signToken({ userId: user._id, role: user.role });
    return { token, user: buildUser(user) };
  },
};

module.exports = authService;
