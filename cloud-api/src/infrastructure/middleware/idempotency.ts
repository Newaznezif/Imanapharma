import { Request, Response, NextFunction } from 'express';
import { query } from '../db/pg-client';

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only apply idempotency constraints to mutating actions (POST/PUT/PATCH)
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  // We enforce idempotency keys on sales, inventory updates, and transfers
  const path = req.originalUrl;
  const isTargetRoute = 
    path.includes('/sales') || 
    path.includes('/inventory') || 
    path.includes('/transfers');

  if (!isTargetRoute) {
    return next();
  }

  const key = req.headers['x-idempotency-key'] as string;
  if (!key) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Idempotency validation failure: Header X-Idempotency-Key is required for this endpoint.'
    });
  }

  try {
    // Check if key already exists
    const cached = await query(
      'SELECT response_status, response_body FROM idempotency_keys WHERE key = $1',
      [key]
    );

    if (cached.length > 0) {
      const responseBody = JSON.parse(cached[0].response_body);
      const status = cached[0].response_status;
      return res.status(status).json(responseBody);
    }

    // Hijack res.json to cache response upon completion
    const originalJson = res.json;
    res.json = function (body: any): Response {
      // Store the result asynchronously
      const status = res.statusCode;
      query(
        `INSERT INTO idempotency_keys (key, response_status, response_body)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`,
        [key, status, JSON.stringify(body)]
      ).catch(err => {
        console.error(`Error saving idempotency key ${key}:`, err);
      });

      return originalJson.call(this, body);
    };

    return next();
  } catch (error) {
    console.error('Idempotency middleware error:', error);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Failed to process idempotency keys' });
  }
}
