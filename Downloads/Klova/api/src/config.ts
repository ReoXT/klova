import dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  commissionRate: parseFloat(process.env.COMMISSION_RATE ?? '0.22'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
};
