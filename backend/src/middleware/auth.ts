import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db/pool';

export type UserRole = 'MANAGER' | 'PHARMACIST';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
    must_change_password?: boolean;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = req.cookies?.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid token format' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      sub: string;
      username: string;
      role: string;
      must_change_password?: boolean;
    };

    // Check if token is blacklisted
    const blacklisted = await query('SELECT id FROM token_blacklist WHERE token = $1', [token]);
    if (blacklisted.length > 0) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token has been invalidated' });
    }

    req.user = {
      id: decoded.sub,
      username: decoded.username,
      role: decoded.role as UserRole,
      must_change_password: decoded.must_change_password || false,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token is expired or invalid' });
  }
}

/**
 * Enforce RBAC rules at the controller level
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Role ${req.user.role} does not have permission to perform this action.`,
      });
    }

    return next();
  };
}

/**
 * Require that the user does NOT need to change their password to proceed.
 * If must_change_password is true, only the change-password route should be allowed.
 */
export function requirePasswordChangeComplete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.must_change_password) {
    return res.status(403).json({
      error: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must change your password before you can access this resource.',
    });
  }
  return next();
}
