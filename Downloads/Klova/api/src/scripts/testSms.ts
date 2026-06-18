// One-shot script to verify Termii is wired up correctly.
// Usage:
//   cd api
//   TERMII_API_KEY=xxx TERMII_SENDER_ID=Klova TEST_PHONE=08012345678 tsx src/scripts/testSms.ts

import { sendSms, normalizePhone } from '../lib/termiiClient';

void (async () => {
  const raw = process.env.TEST_PHONE;
  if (!raw) {
    console.error('Set TEST_PHONE=<your Nigerian number> before running this script.');
    process.exit(1);
  }

  const normalised = normalizePhone(raw);
  console.log(`Sending test SMS to ${raw} (normalised: ${normalised}) …`);

  await sendSms(raw, 'Klova test SMS — if you received this, notifications are wired up correctly!');
  console.log('Done.');
})();
