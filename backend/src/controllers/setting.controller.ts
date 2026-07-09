import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../db/pool';
import { AuthenticatedRequest } from '../middleware/auth';
import { sanitizeString } from '../middleware/validate';

// Setup multer storage in root uploads/ directory
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique name for the uploaded logo
    const ext = path.extname(file.originalname);
    cb(null, `logo_${Date.now()}${ext}`);
  },
});

export const logoUpload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit (Security Fix)
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, png, gif, webp) are allowed'));
  },
});

export class SettingController {
  /**
   * GET /api/v1/settings
   * Public
   */
  public static async getSettings(req: Request, res: Response) {
    try {
      const rows = await query('SELECT id, name, address, phone, email, logo_url, created_at, updated_at FROM settings WHERE id = 1');
      if (rows.length === 0) {
        // Fallback default
        return res.status(200).json({
          name: 'Imana Pharmacy',
          address: 'Addis Ababa, Ethiopia',
          phone: '+251 11 123 4567',
          email: 'info@imanapharma.com',
          logo_url: '/uploads/logo.png',
        });
      }
      return res.status(200).json(rows[0]);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * PUT /api/v1/settings
   * Manager restricted
   */
  public static async updateSettings(req: AuthenticatedRequest, res: Response) {
    const { name, address, phone, email } = req.body;
    try {
      const result = await query(
        `UPDATE settings
         SET name = COALESCE($1, name),
             address = COALESCE($2, address),
             phone = COALESCE($3, phone),
             email = COALESCE($4, email),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1
         RETURNING id, name, address, phone, email, logo_url, updated_at`,
        [
          name ? sanitizeString(name) : null,
          address ? sanitizeString(address) : null,
          phone ? sanitizeString(phone) : null,
          email ? sanitizeString(email) : null
        ]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Settings row not initialized' });
      }

      // Audit Log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'UPDATE_SETTINGS', JSON.stringify({ name, email }), req.ip]
      );

      return res.status(200).json(result[0]);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * POST /api/v1/settings/logo
   * Manager restricted
   */
  public static async uploadLogo(req: AuthenticatedRequest, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'No file uploaded or file exceeded 2MB limit' });
    }

    const relativeUrl = `/uploads/${req.file.filename}`;

    try {
      const result = await query(
        `UPDATE settings
         SET logo_url = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1
         RETURNING id, name, address, phone, email, logo_url, updated_at`,
        [relativeUrl]
      );

      // Audit Log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'UPLOAD_SETTINGS_LOGO', JSON.stringify({ logo_url: relativeUrl }), req.ip]
      );

      return res.status(200).json({
        message: 'Logo uploaded successfully',
        settings: result[0],
      });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }
}
