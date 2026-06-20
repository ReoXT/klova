import dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

// Strip trailing slash so CORS matches what browsers send (origin never has a slash)
function cleanOrigin(raw: string): string {
  return raw.replace(/\/+$/, '');
}

export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  frontendOrigin: cleanOrigin(process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000'),
  commissionRate: parseFloat(process.env.COMMISSION_RATE ?? '0.22'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
  // Termii — optional locally; notifications silently skip if unset
  termiiApiKey: process.env.TERMII_API_KEY,
  termiiSenderId: process.env.TERMII_SENDER_ID,
  // Phone to receive the admin confirmation SMS per paid booking
  adminPhone: process.env.ADMIN_PHONE,
  // Static bearer token required on all /admin/* routes
  adminApiKey: process.env.ADMIN_API_KEY,
  // Highest transport fare the system will accept without rejecting as a fat-finger (NGN)
  transportFareCeilingNgn: parseInt(process.env.TRANSPORT_FARE_CEILING_NGN ?? '15000', 10),
};

// Startup diagnostics — visible in Railway logs immediately after deploy
console.log('[config] CORS origin:', config.frontendOrigin);
console.log('[config] Paystack key present:', config.paystackSecretKey.startsWith('sk_live_') ? 'LIVE ✓' : config.paystackSecretKey.startsWith('sk_test_') ? 'TEST (switch to live!)' : 'MISSING ✗');
console.log('[config] Termii:', config.termiiApiKey ? 'configured ✓' : 'not set — SMS disabled');
console.log('[config] Admin phone:', config.adminPhone ? 'set ✓' : 'not set — admin SMS disabled');
