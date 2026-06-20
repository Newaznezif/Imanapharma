import { Request, Response } from 'express';
import { AuthService } from '../../application/services/auth.service';

export class AuthController {
  public static async login(req: Request, res: Response) {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Username and password are required' });
    }

    try {
      const result = await AuthService.login(username, password);
      if (!result) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid username or password' });
      }

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  public static async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Refresh token is required' });
    }

    try {
      const result = await AuthService.refresh(refreshToken);
      if (!result) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
      }

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }

  public static async register(req: Request, res: Response) {
    const { username, password, role, branchId } = req.body;
    if (!username || !password || !role || !branchId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'username, password, role, and branchId are required' });
    }

    try {
      const user = await AuthService.register(username, password, role, branchId);
      return res.status(201).json(user);
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'CONFLICT', message: 'Username is already taken' });
      }
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
}
