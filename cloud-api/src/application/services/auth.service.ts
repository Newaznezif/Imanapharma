import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../../infrastructure/db/pg-client';
import { config } from '../../config';
import { User, UserRole } from '../../../../shared/src/types';

export class AuthService {
  /**
   * Validates username and password. Returns access token, refresh token, and user model on success.
   */
  public static async login(username: string, passwordPlain: string): Promise<{ accessToken: string; refreshToken: string; user: Omit<User, 'password_hash'> } | null> {
    const rows = await query(
      'SELECT id, username, password_hash, role_id, branch_id FROM users WHERE username = $1',
      [username]
    );

    if (rows.length === 0) {
      return null;
    }

    const userRow = rows[0];
    const passwordValid = await bcrypt.compare(passwordPlain, userRow.password_hash);
    if (!passwordValid) {
      return null;
    }

    const user: Omit<User, 'password_hash'> = {
      id: userRow.id,
      username: userRow.username,
      role: userRow.role_id as UserRole,
      branch_id: userRow.branch_id,
      created_at: new Date().toISOString(),
    };

    const accessToken = jwt.sign(
      { sub: user.id, username: user.username, role: user.role, branchId: user.branch_id },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any }
    );

    const refreshToken = jwt.sign(
      { sub: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as any }
    );

    return { accessToken, refreshToken, user };
  }

  /**
   * Refreshes the access token using a valid refresh token.
   */
  public static async refresh(token: string): Promise<{ accessToken: string } | null> {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret) as { sub: string };
      const rows = await query(
        'SELECT id, username, role_id, branch_id FROM users WHERE id = $1',
        [decoded.sub]
      );

      if (rows.length === 0) {
        return null;
      }

      const userRow = rows[0];
      const accessToken = jwt.sign(
        { sub: userRow.id, username: userRow.username, role: userRow.role_id, branchId: userRow.branch_id },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn as any }
      );

      return { accessToken };
    } catch {
      return null;
    }
  }

  /**
   * Registers a new user.
   */
  public static async register(username: string, passwordPlain: string, role: UserRole, branchId: string): Promise<Omit<User, 'password_hash'>> {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    const result = await query(
      `INSERT INTO users (username, password_hash, role_id, branch_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role_id, branch_id, created_at`,
      [username, passwordHash, role, branchId]
    );

    const newUser = result[0];
    return {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role_id as UserRole,
      branch_id: newUser.branch_id,
      created_at: newUser.created_at,
    };
  }
}
