const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/AppError');
const { verifyToken } = require('../utils/jwt');

const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return next(new AppError('Authorization token is missing', 401));
  const token = auth.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    const user = await userRepository.findById(decoded.userId);
    if (!user) return next(new AppError('User no longer exists', 401));
    req.user = user;
    return next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role))
    return next(new AppError('You are not allowed to perform this action', 403));
  return next();
};

const requireApprovedResident = (req, res, next) => {
  if (req.user?.role === 'resident' && req.user.wingStatus !== 'approved')
    return next(new AppError('Your wing membership is pending approval', 403));
  return next();
};

module.exports = { protect, authorize, requireApprovedResident };
