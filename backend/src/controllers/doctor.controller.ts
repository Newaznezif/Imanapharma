import { Response } from 'express';
import { query } from '../db/pool';
import { AuthenticatedRequest } from '../middleware/auth';
import { sanitizeString } from '../middleware/validate';

export class DoctorController {
  public static async getDoctors(req: AuthenticatedRequest, res: Response) {
    try {
      const doctors = await query('SELECT * FROM doctors ORDER BY name ASC');
      return res.status(200).json(doctors);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  public static async createDoctor(req: AuthenticatedRequest, res: Response) {
    const { name, license_number, phone, specialty } = req.body;
    if (!name || !license_number) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Name and license number are required' });
    }

    try {
      const result = await query(
        `INSERT INTO doctors (name, license_number, phone, specialty) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [sanitizeString(name), sanitizeString(license_number), phone || null, specialty || null]
      );
      return res.status(201).json(result[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Doctor with this license number already exists' });
      }
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
}
