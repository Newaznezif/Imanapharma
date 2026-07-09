import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db/pool';
import { config } from '../config';
import { AuthenticatedRequest } from '../middleware/auth';
import { validatePassword, validateUsername, validateRole } from '../middleware/validate';

export class AuthController {
  /**
   * POST /api/v1/auth/logout
   */
  public static async logout(req: AuthenticatedRequest, res: Response) {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : req.cookies?.token;

    if (token) {
      try {
        const decoded = jwt.decode(token) as { exp: number } | null;
        const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 60 * 60 * 1000);
        
        await query(
          'INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [token, expiresAt]
        );
        
        // Log action
        if (req.user) {
          await query(
            'INSERT INTO audit_logs (user_id, action_type, table_name, record_id, payload, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
            [req.user.id, 'USER_LOGOUT', 'users', req.user.id, JSON.stringify({ message: 'User logged out and token blacklisted' }), req.ip]
          );
        }
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    
    // Clear the secure cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
    });
    
    return res.status(200).json({ message: 'Logged out successfully' });
  }

  /**
   * POST /api/v1/auth/login
   */
  public static async login(req: AuthenticatedRequest, res: Response) {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Username and password are required' });
    }

    try {
      const rows = await query(
        'SELECT id, username, password_hash, role, is_active, must_change_password, failed_login_count, locked_until FROM users WHERE username = $1',
        [username]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }

      const userRow = rows[0];

      if (!userRow.is_active) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Account has been deactivated' });
      }

      // Check lockout
      if (userRow.locked_until && new Date(userRow.locked_until) > new Date()) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Account is temporarily locked due to too many failed login attempts.' });
      }

      const passwordValid = await bcrypt.compare(password, userRow.password_hash);
      
      if (!passwordValid) {
        const newFailedCount = userRow.failed_login_count + 1;
        let lockedUntil = null;
        if (newFailedCount >= config.security.maxLoginAttempts) {
          lockedUntil = new Date(Date.now() + config.security.lockoutDurationMinutes * 60 * 1000);
        }

        await query('UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3', [newFailedCount, lockedUntil, userRow.id]);
        
        // Audit log for failed login
        await query(
          'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
          [userRow.id, 'FAILED_LOGIN', JSON.stringify({ reason: 'Invalid password', attempt: newFailedCount }), req.ip]
        );

        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }

      // Reset failed login count if successful
      if (userRow.failed_login_count > 0 || userRow.locked_until) {
        await query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1', [userRow.id]);
      }

      const token = jwt.sign(
        { 
          sub: userRow.id, 
          username: userRow.username, 
          role: userRow.role,
          must_change_password: userRow.must_change_password 
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn as any }
      );

      // Audit log for successful login
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [userRow.id, 'SUCCESSFUL_LOGIN', '{}', req.ip]
      );

      // Set JWT in HTTP-Only Cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: 30 * 60 * 1000, // 30 minutes
      });

      return res.status(200).json({
        token, // Optionally keep this for mobile app clients that don't use cookies
        user: {
          id: userRow.id,
          username: userRow.username,
          role: userRow.role,
          must_change_password: userRow.must_change_password,
        },
      });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  public static async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      const rows = await query('SELECT id, username, role, is_active, must_change_password, created_at FROM users WHERE id = $1', [req.user?.id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      }
      return res.status(200).json(rows[0]);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * GET /api/v1/auth/users
   * Restricted to: MANAGER
   */
  public static async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await query('SELECT id, username, role, is_active, must_change_password, failed_login_count, locked_until, created_at FROM users ORDER BY username');
      return res.status(200).json(users);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * POST /api/v1/auth/users
   * Restricted to: MANAGER
   */
  public static async createUser(req: AuthenticatedRequest, res: Response) {
    const { username, role } = req.body;
    let { password } = req.body;
    
    const userVal = validateUsername(username);
    if (!userVal.valid) return res.status(400).json({ error: 'BAD_REQUEST', message: userVal.message });
    
    const roleVal = validateRole(role);
    if (!roleVal.valid) return res.status(400).json({ error: 'BAD_REQUEST', message: roleVal.message });

    if (!password) {
      // Generate a strong random temporary password
      password = crypto.randomBytes(12).toString('base64');
    }

    const pwdVal = validatePassword(password);
    if (!pwdVal.valid) return res.status(400).json({ error: 'BAD_REQUEST', message: pwdVal.message });

    try {
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(password, salt);

      const result = await query(
        `INSERT INTO users (username, password_hash, role, is_active, must_change_password)
         VALUES ($1, $2, $3, true, true)
         RETURNING id, username, role, is_active, must_change_password, created_at`,
        [username, hash, role]
      );
      const newUser = result[0];

      // Add to password history
      await query(
        'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
        [newUser.id, hash]
      );

      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'CREATE_USER', JSON.stringify({ createdUser: username, role }), req.ip]
      );

      // Only return generated password in the API response once, for the manager to securely convey it.
      return res.status(201).json({ ...newUser, generatedPassword: req.body.password ? undefined : password });
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'CONFLICT', message: 'Username is already taken' });
      }
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * PUT /api/v1/auth/users/:id
   * Restricted to: MANAGER
   */
  public static async updateUser(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { role, is_active } = req.body;

    if (role) {
      const roleVal = validateRole(role);
      if (!roleVal.valid) return res.status(400).json({ error: 'BAD_REQUEST', message: roleVal.message });
    }

    try {
      const result = await query(
        `UPDATE users
         SET role = COALESCE($1, role),
             is_active = COALESCE($2, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, username, role, is_active, updated_at`,
        [role, is_active, id]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      }

      // If deactivated, we could optionally clear sessions if stored in DB.
      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'UPDATE_USER', JSON.stringify({ targetUserId: id, role, is_active }), req.ip]
      );

      return res.status(200).json(result[0]);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * POST /api/v1/auth/users/:id/reset-password
   * Restricted to: MANAGER
   */
  public static async resetPassword(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'New password is required' });
    }
    
    const pwdVal = validatePassword(password);
    if (!pwdVal.valid) return res.status(400).json({ error: 'BAD_REQUEST', message: pwdVal.message });

    try {
      // Password history check (last 3 passwords)
      const historyRows = await query(
        'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3',
        [id]
      );
      for (const row of historyRows) {
        if (await bcrypt.compare(password, row.password_hash)) {
          return res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot reuse any of your last 3 passwords' });
        }
      }

      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(password, salt);

      const result = await query(
        `UPDATE users SET password_hash = $1, must_change_password = true, failed_login_count = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username`,
        [hash, id]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      }

      // Add to history
      await query(
        'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
        [id, hash]
      );

      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'RESET_PASSWORD', JSON.stringify({ targetUserId: id, username: result[0].username }), req.ip]
      );

      return res.status(200).json({ message: 'Password reset successful' });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * POST /api/v1/auth/users/:id/unlock
   * Restricted to: MANAGER
   */
  public static async unlockUser(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    try {
      const result = await query(
        'UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, username',
        [id]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      }

      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'UNLOCK_USER', JSON.stringify({ targetUserId: id, username: result[0].username }), req.ip]
      );

      return res.status(200).json({ message: 'User account unlocked successfully' });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * POST /api/v1/auth/change-password
   * Self-service password change
   */
  public static async changePassword(req: AuthenticatedRequest, res: Response) {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Old and new passwords are required' });
    }

    const pwdVal = validatePassword(newPassword);
    if (!pwdVal.valid) return res.status(400).json({ error: 'BAD_REQUEST', message: pwdVal.message });

    try {
      const userRows = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      if (userRows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      }

      const passwordValid = await bcrypt.compare(oldPassword, userRows[0].password_hash);
      if (!passwordValid) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Incorrect old password' });
      }

      // Password history check (last 3 passwords)
      const historyRows = await query(
        'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3',
        [userId]
      );
      for (const row of historyRows) {
        if (await bcrypt.compare(newPassword, row.password_hash)) {
          return res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot reuse any of your last 3 passwords' });
        }
      }

      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(newPassword, salt);

      await query(
        'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hash, userId]
      );

      // Add to history
      await query(
        'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
        [userId, hash]
      );

      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [userId, 'CHANGE_PASSWORD', '{}', req.ip]
      );

      return res.status(200).json({ message: 'Password changed successfully' });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * DELETE /api/v1/auth/users/:id
   * Restricted to: MANAGER
   */
  public static async deleteUser(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    if (req.user?.id === id) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot delete your own account' });
    }

    try {
      // Prevent deleting the last active MANAGER
      const mgrRows = await query(`SELECT COUNT(*) as count FROM users WHERE role = 'MANAGER' AND is_active = true`);
      const targetUser = await query(`SELECT role FROM users WHERE id = $1`, [id]);
      
      if (targetUser.length > 0 && targetUser[0].role === 'MANAGER' && mgrRows[0].count <= 1) {
          return res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot delete the last active MANAGER account' });
      }

      const result = await query('DELETE FROM users WHERE id = $1 RETURNING username', [id]);
      if (result.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      }

      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'DELETE_USER', JSON.stringify({ deletedUsername: result[0].username }), req.ip]
      );

      return res.status(200).json({ message: `User ${result[0].username} deleted` });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }
}
