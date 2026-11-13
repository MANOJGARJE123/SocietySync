export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
};

export const minLength = (value, length) => String(value || '').trim().length >= length;

export const isNumber = (value) => !Number.isNaN(Number(value));

export const required = (value) => String(value || '').trim().length > 0;