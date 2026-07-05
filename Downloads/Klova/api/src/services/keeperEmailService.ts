import { config } from '../config';

// Triggers a keeper notification email by calling web/'s
// POST /api/internal/notify-keeper. Email templates and the send dispatcher
// live only in web/emails/ + web/lib/keeperNotify.ts. This backend can't
// import them directly (separate deployment, separate package.json), so it
// reaches them over HTTP instead of duplicating them.
//
// Never throws. A failed or unreachable notify call is logged and otherwise
// ignored: sending a keeper an email must never roll back a booking,
// earning, or withdrawal operation that already succeeded.
async function notifyKeeper(
  email: string | null,
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!email) {
    console.log(`[keeper-email] Skipping ${type}: no email on file`);
    return;
  }
  if (!config.internalNotifySecret) {
    console.warn(`[keeper-email] INTERNAL_NOTIFY_SECRET not set, skipping ${type}`);
    return;
  }

  try {
    const res = await fetch(`${config.frontendOrigin}/api/internal/notify-keeper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': config.internalNotifySecret,
      },
      body: JSON.stringify({ email, type, data }),
    });

    if (!res.ok) {
      console.error(`[keeper-email] notify-keeper returned ${res.status} for type=${type}`);
    }
  } catch (err) {
    console.error(
      `[keeper-email] notify-keeper request failed for type=${type}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export async function notifyKeeperNewJob(params: {
  email: string | null;
  firstName: string;
  serviceName: string;
  zoneName: string;
  bookingDate: string;
  jobUrl: string;
}): Promise<void> {
  const { email, ...data } = params;
  await notifyKeeper(email, 'new_job', data);
}

export async function notifyKeeperWithdrawalPaid(params: {
  email: string | null;
  firstName: string;
  amountNaira: string;
  bankName: string;
  accountLast4: string;
  walletUrl: string;
}): Promise<void> {
  const { email, ...data } = params;
  await notifyKeeper(email, 'withdrawal_paid', data);
}

export async function notifyKeeperWithdrawalFailed(params: {
  email: string | null;
  firstName: string;
  amountNaira: string;
  walletUrl: string;
}): Promise<void> {
  const { email, ...data } = params;
  await notifyKeeper(email, 'withdrawal_failed', data);
}
