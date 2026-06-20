import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'pharmacy_cloud',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_cloud_key_1234',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_key_5678',
    expiresIn: '1h',
    refreshExpiresIn: '7d',
  },
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};
