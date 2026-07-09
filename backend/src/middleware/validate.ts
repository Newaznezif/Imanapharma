/**
 * Input validation and password policy enforcement utilities.
 * All validation is centralized here to ensure consistency across controllers.
 */

// ── Password Policy ────────────────────────────────────────────────────────────
const PASSWORD_MIN_LENGTH    = 8;
const PASSWORD_REGEX         = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])(.{8,})$/;

export interface ValidationResult {
  valid:   boolean;
  message: string;
}

/**
 * Validates a password against the pharmacy security policy:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long` };
  }
  if (!PASSWORD_REGEX.test(password)) {
    return {
      valid:   false,
      message: 'Password must contain at least one uppercase letter, one number, and one special character',
    };
  }
  return { valid: true, message: 'OK' };
}

/**
 * Validates a username:
 * - 3–50 characters
 * - Alphanumeric + underscore + hyphen only
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { valid: false, message: 'Username is required' };
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 50) {
    return { valid: false, message: 'Username must be between 3 and 50 characters' };
  }
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) {
    return { valid: false, message: 'Username may only contain letters, numbers, underscores, and hyphens' };
  }
  return { valid: true, message: 'OK' };
}

/**
 * Validates a UUID v4 string.
 */
export function validateUUID(value: string): ValidationResult {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!value || !uuidRegex.test(value)) {
    return { valid: false, message: 'Invalid ID format' };
  }
  return { valid: true, message: 'OK' };
}

/**
 * Validates a role value.
 */
export function validateRole(role: string): ValidationResult {
  const allowed = ['MANAGER', 'PHARMACIST'];
  if (!allowed.includes(role)) {
    return { valid: false, message: `Role must be one of: ${allowed.join(', ')}` };
  }
  return { valid: true, message: 'OK' };
}

/**
 * Validates a decimal price (>= 0, max 2 decimal places).
 */
export function validatePrice(price: any): ValidationResult {
  const n = parseFloat(price);
  if (isNaN(n) || n < 0) {
    return { valid: false, message: 'Price must be a non-negative number' };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(String(price))) {
    return { valid: false, message: 'Price must have at most 2 decimal places' };
  }
  return { valid: true, message: 'OK' };
}

/**
 * Sanitizes a string to prevent XSS (encode HTML entities).
 * Note: Express + JSON API is not vulnerable to reflected XSS by default,
 * but this adds defense in depth for values stored and returned.
 */
export function sanitizeString(value: string, maxLength = 255): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, maxLength);
}
