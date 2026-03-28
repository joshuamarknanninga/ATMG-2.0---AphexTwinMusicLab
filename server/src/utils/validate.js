import { HttpError } from './errors.js';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const ensureObject = (value, label = 'payload') => {
  if (!isObject(value)) {
    throw new HttpError(400, `Expected ${label} to be an object`);
  }

  return value;
};

export const asString = (value, field, { min = 1, max = 200, fallback } = {}) => {
  if (value == null && fallback !== undefined) {
    return fallback;
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpError(400, `${field} must contain between ${min} and ${max} characters`);
  }

  return trimmed;
};

export const asNumber = (value, field, { min = -Infinity, max = Infinity, integer = false, fallback } = {}) => {
  if (value == null && fallback !== undefined) {
    return fallback;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new HttpError(400, `${field} must be a number`);
  }

  if (integer && !Number.isInteger(value)) {
    throw new HttpError(400, `${field} must be an integer`);
  }

  if (value < min || value > max) {
    throw new HttpError(400, `${field} must be between ${min} and ${max}`);
  }

  return value;
};

export const asEnum = (value, field, options, fallback) => {
  if (value == null && fallback !== undefined) {
    return fallback;
  }

  if (typeof value !== 'string' || !options.includes(value)) {
    throw new HttpError(400, `${field} must be one of: ${options.join(', ')}`);
  }

  return value;
};

export const asArray = (value, field, { max = Infinity, fallback } = {}) => {
  if (value == null && fallback !== undefined) {
    return fallback;
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an array`);
  }

  if (value.length > max) {
    throw new HttpError(400, `${field} must have at most ${max} items`);
  }

  return value;
};
