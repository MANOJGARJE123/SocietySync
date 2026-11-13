const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
  // Postgres constraint violations
  if (err.code === '23505') { err.statusCode = 409; err.message = 'Duplicate value — this record already exists.'; }
  if (err.code === '23503') { err.statusCode = 400; err.message = 'Referenced record does not exist.'; }
  if (err.code === '23514') { err.statusCode = 400; err.message = 'Value violates a data constraint.'; }
  if (err.code === '22P02') { err.statusCode = 400; err.message = 'Invalid ID format.'; }

  // JWT errors
  if (err.name === 'JsonWebTokenError') { err.statusCode = 401; err.message = 'Invalid token.'; }
  if (err.name === 'TokenExpiredError') { err.statusCode = 401; err.message = 'Token has expired.'; }

  const statusCode = err.statusCode || 500;
  const isProd = env.nodeEnv === 'production';

  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}`, err.message, isProd ? '' : err.stack);
  }

  // Never leak stack traces or raw DB details to clients in production
  const message = (statusCode === 500 && isProd) ? 'Internal Server Error' : (err.message || 'Internal Server Error');

  res.status(statusCode).json({ success: false, message });
};

module.exports = errorHandler;
