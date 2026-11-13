const validator = require('validator');

const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return validator.isEmail(email.trim());
};

const isStrongPassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (!/[a-zA-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

const isValidMonth = (month) => /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month);

const sanitize = (text, max = 10000) =>
  typeof text === 'string' ? text.trim().slice(0, max) : '';

const hasLength = (value, min, max) => {
  const s = String(value || '').trim();
  return s.length >= min && s.length <= max;
};

module.exports = { isValidEmail, isStrongPassword, isValidMonth, sanitize, hasLength };
