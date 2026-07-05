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
  // Termii is optional locally; notifications silently skip if unset
  termiiApiKey: process.env.TERMII_API_KEY,
  termiiSenderId: process.env.TERMII_SENDER_ID,
  // Phone to receive the admin confirmation SMS per paid booking
  adminPhone: process.env.ADMIN_PHONE,
  // Static bearer token required on all /admin/* routes
  adminApiKey: process.env.ADMIN_API_KEY,
  // Highest transport fare the system will accept without rejecting as a fat-finger (NGN)
  transportFareCeilingNgn: parseInt(process.env.TRANSPORT_FARE_CEILING_NGN ?? '5000', 10),
  // How long a customer has to pay an outstanding transport invoice before the booking
  // is considered overdue in the admin cockpit. The hard deadline is always the booking
  // date itself, whichever comes first governs.
  transportPaymentDeadlineHours: parseInt(process.env.TRANSPORT_PAYMENT_DEADLINE_HOURS ?? '24', 10),
  // Shared secret required on web/'s POST /api/internal/notify-keeper. Lets
  // this Express backend trigger keeper emails (new job, withdrawal paid/
  // failed) without duplicating the React Email templates, which live only
  // in web/emails/. Must match the same value set in web/'s environment.
  internalNotifySecret: process.env.INTERNAL_NOTIFY_SECRET ?? '',
};

// Startup diagnostics, visible in Railway logs immediately after deploy
console.log('[config] CORS origin:', config.frontendOrigin);
console.log('[config] Paystack key present:', config.paystackSecretKey.startsWith('sk_live_') ? 'LIVE ✓' : config.paystackSecretKey.startsWith('sk_test_') ? 'TEST (switch to live!)' : 'MISSING ✗');
console.log('[config] Termii:', config.termiiApiKey ? 'configured ✓' : 'not set, SMS disabled');
console.log('[config] Admin phone:', config.adminPhone ? 'set ✓' : 'not set, admin SMS disabled');
console.log('[config] Internal notify secret:', config.internalNotifySecret ? 'set ✓' : 'not set, keeper emails disabled');
