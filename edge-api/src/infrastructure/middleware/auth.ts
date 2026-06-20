import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../../../shared/src/types';

// Use same secret for local verification simplicity
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_cloud_key_1234';

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
    // If running fully local and bypassed, we fallback
    if (process.env.NODE_ENV === 'development') {
      req.user = {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        username: 'cashier_north',
        role: 'CASHIER',
        branchId: '22222222-2222-2222-2222-222222222222',
      };
      return next();
    }
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
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
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid local session token' });
  }
}
