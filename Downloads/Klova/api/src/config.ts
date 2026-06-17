import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  commissionRate: parseFloat(process.env.COMMISSION_RATE ?? '0.22'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
