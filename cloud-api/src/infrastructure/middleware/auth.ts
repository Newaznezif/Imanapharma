import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UserRole } from '../../../../shared/src/types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
    branchId: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      sub: string;
      username: string;
      role: string;
      branchId: string;
    };

    req.user = {
      id: decoded.sub,
      username: decoded.username,
      role: decoded.role as UserRole,
      branchId: decoded.branchId,
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
