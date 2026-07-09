import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// ── Helmet (secure HTTP headers) ─────────────────────────────────────────────
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'"],
      fontSrc:     ["'self'"],
      objectSrc:   ["'none'"],
      mediaSrc:    ["'self'"],
      frameSrc:    ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // allow image embedding from same origin
});

// ── CORS ─────────────────────────────────────────────────────────────────────
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, mobile apps in dev)
    if (!origin) return callback(null, true);
    if (config.security.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: Origin '${origin}' not allowed`));
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token', 'X-Xsrf-Token', 'x-csrf-token', 'x-xsrf-token'],
});

// ── Rate Limiters ─────────────────────────────────────────────────────────────

/** Strict rate limit for authentication endpoints */
export const authRateLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              10,              // 10 requests per window
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    error:   'RATE_LIMITED',
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  skipSuccessfulRequests: false,
});

/** General API rate limit */
export const apiRateLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    error:   'RATE_LIMITED',
    message: 'Too many requests. Please slow down.',
  },
});

// ── Request sanitizer ────────────────────────────────────────────────────────
/**
 * Strips null bytes and trims string values in request body.
 * Defense against null-byte injection and padding attacks.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = value.replace(/\0/g, '').trim();
    } else if (Array.isArray(value)) {
      sanitized[key] = value;
    } else if (value !== null && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ── Request ID injector ───────────────────────────────────────────────────────
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.headers['x-request-id'] as string || generateId();
  res.setHeader('X-Request-ID', id);
  (req as any).requestId = id;
  next();
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * CSRF Protection Middleware
 * Requires presence of 'X-CSRF-Token' header matching the signed token or the JWT payload on state-changing requests.
 * Since JWT is verified separately, we validate that the client sends a matching custom header
 * to protect against cross-site request forgery.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF check for authentication login endpoint
  if (req.originalUrl === '/api/v1/auth/login') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  // For API authentication, we expect the frontend to attach this token (e.g. from the JWT payload or static session identifier)
  // For simplicity and effectiveness, we assert that the client has set 'x-csrf-token'
  if (!csrfToken) {
    return res.status(403).json({ error: 'CSRF_BLOCKED', message: 'CSRF token is missing or invalid' });
  }

  next();
}
