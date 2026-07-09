import { Response } from 'express';
import { query } from '../db/pool';
import { AuthenticatedRequest } from '../middleware/auth';
import { sanitizeString } from '../middleware/validate';

export class PatientController {
  /**
   * GET /api/v1/patients
   */
  public static async getPatients(req: AuthenticatedRequest, res: Response) {
    const { q } = req.query;
    try {
      let patients;
      if (q) {
        patients = await query(
          `SELECT id, name, phone, allergy_flags, emergency_contact_name, emergency_contact_phone, 
                  insurance_policy_number, insurance_provider, medical_history, created_at, updated_at 
           FROM patients 
           WHERE name ILIKE $1 ORDER BY name ASC`, 
          [`%${String(q)}%`]
        );
      } else {
        patients = await query(
          `SELECT id, name, phone, allergy_flags, emergency_contact_name, emergency_contact_phone, 
                  insurance_policy_number, insurance_provider, medical_history, created_at, updated_at 
           FROM patients ORDER BY name ASC`
        );
      }
      return res.status(200).json(patients);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * POST /api/v1/patients
   */
  public static async createPatient(req: AuthenticatedRequest, res: Response) {
    const { 
      name, phone, allergy_flags, 
      emergency_contact_name, emergency_contact_phone,
      insurance_policy_number, insurance_provider, medical_history 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Patient name is required' });
    }

    if (allergy_flags && !Array.isArray(allergy_flags)) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'allergy_flags must be an array' });
    }

    try {
      const allergyJson = allergy_flags ? JSON.stringify(allergy_flags) : '[]';
      const result = await query(
        `INSERT INTO patients (
            name, phone, allergy_flags, 
            emergency_contact_name, emergency_contact_phone,
            insurance_policy_number, insurance_provider, medical_history
         ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [
          sanitizeString(name), 
          phone ? sanitizeString(phone) : null, 
          allergyJson,
          emergency_contact_name || null,
          emergency_contact_phone || null,
          insurance_policy_number || null,
          insurance_provider || null,
          medical_history || null
        ]
      );
      
      // Audit log
      await query(
        'INSERT INTO audit_logs (user_id, action_type, payload, ip_address) VALUES ($1, $2, $3, $4)',
        [req.user?.id, 'CREATE_PATIENT', JSON.stringify({ patientId: result[0].id, name }), req.ip]
      );

      return res.status(201).json(result[0]);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }

  /**
   * PUT /api/v1/patients/:id
   */
  public static async updatePatient(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { 
      name, phone, allergy_flags, 
      emergency_contact_name, emergency_contact_phone,
      insurance_policy_number, insurance_provider, medical_history 
    } = req.body;

    if (allergy_flags && !Array.isArray(allergy_flags)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'allergy_flags must be an array' });
    }

    try {
      const allergyJson = allergy_flags ? JSON.stringify(allergy_flags) : null;
      const result = await query(
        `UPDATE patients
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone),
             allergy_flags = COALESCE($3::jsonb, allergy_flags),
             emergency_contact_name = COALESCE($4, emergency_contact_name),
             emergency_contact_phone = COALESCE($5, emergency_contact_phone),
             insurance_policy_number = COALESCE($6, insurance_policy_number),
             insurance_provider = COALESCE($7, insurance_provider),
             medical_history = COALESCE($8, medical_history),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9 RETURNING *`,
        [
          name ? sanitizeString(name) : null,
          phone ? sanitizeString(phone) : null,
          allergyJson,
          emergency_contact_name,
          emergency_contact_phone,
          insurance_policy_number,
          insurance_provider,
          medical_history,
          id
        ]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Patient not found' });
      }

      return res.status(200).json(result[0]);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  /**
   * GET /api/v1/patients/:id/history
   */
  public static async getPatientHistory(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    try {
      const patientResult = await query(
        `SELECT id, name, phone, allergy_flags, emergency_contact_name, emergency_contact_phone, 
                insurance_policy_number, insurance_provider, medical_history, created_at, updated_at 
         FROM patients WHERE id = $1`, 
        [id]
      );
      if (patientResult.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Patient not found' });
      }
      const patient = patientResult[0];

      // Fetch patient orders and items
      const orders = await query(
        `SELECT o.id, o.order_number, o.rx_number, o.doctor_name, o.total_amount, o.status, o.created_at, o.completed_at,
                u1.username as pharmacist_name
         FROM orders o
         LEFT JOIN users u1 ON o.pharmacist_id = u1.id
         WHERE o.patient_id = $1
         ORDER BY o.created_at DESC`,
        [id]
      );

      // Fetch items for all these orders
      const orderIds = orders.map(o => o.id);
      let items: any[] = [];
      if (orderIds.length > 0) {
        items = await query(
          `SELECT id, order_id, medicine_id, drug_name, quantity, price, total_price 
           FROM order_items 
           WHERE order_id = ANY($1)`,
          [orderIds]
        );
      }

      // Group items under each order
      const ordersWithItems = orders.map(order => ({
        ...order,
        items: items.filter(item => item.order_id === order.id),
      }));

      // Find prescriptions matching patient name or rx_number from this patient
      const prescriptions = await query(
        `SELECT p.id, p.patient_name, p.doctor_name, p.rx_number, p.is_validated, p.validated_at,
                u.username as pharmacist_name, p.created_at, p.refills_authorized, p.refills_remaining
         FROM prescriptions p
         LEFT JOIN users u ON p.validated_by_pharmacist_id = u.id
         WHERE p.patient_name ILIKE $1
         ORDER BY p.created_at DESC`,
        [`%${patient.name}%`]
      );

      return res.status(200).json({
        patient,
        orders: ordersWithItems,
        prescriptions,
      });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred' });
    }
  }
}
