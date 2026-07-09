import dotenv from 'dotenv';
import path from 'path';

// Load .env (works for ts-node dev and compiled dist/)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') }); // fallback

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'imanapharma',
  },
  jwt: {
    secret:        requireEnv('JWT_SECRET', 'CHANGE_ME_IN_PRODUCTION_jwt_secret_64chars'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET', 'CHANGE_ME_IN_PRODUCTION_refresh_secret_64chars'),
    expiresIn:     (process.env.JWT_EXPIRES_IN || '30m') as string,
  },
  security: {
    maxLoginAttempts:      parseInt(process.env.MAX_LOGIN_ATTEMPTS       || '5',  10),
    lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
                      .split(',')
                      .map(o => o.trim())
                      .filter(Boolean),
  },
};
