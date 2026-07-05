import { sendEmail } from "./resend";

// Frontend origin used to build links inside keeper emails. CLAUDE.md treats
// this as a fixed value for this project, not something that varies by
// environment, so it's a plain constant rather than a new env var.
export const APP_URL = "https://klova-nine.vercel.app";
import { NewJobAssignedEmail, type NewJobAssignedEmailProps } from "@/emails/keeper/new-job-assigned";
import { EarningsCreditedEmail, type EarningsCreditedEmailProps } from "@/emails/keeper/earnings-credited";
import { WithdrawalInitiatedEmail, type WithdrawalInitiatedEmailProps } from "@/emails/keeper/withdrawal-initiated";
import { WithdrawalSuccessfulEmail, type WithdrawalSuccessfulEmailProps } from "@/emails/keeper/withdrawal-successful";
import { WithdrawalFailedEmail, type WithdrawalFailedEmailProps } from "@/emails/keeper/withdrawal-failed";

export type KeeperNotification =
  | { type: "new_job"; data: NewJobAssignedEmailProps }
  | { type: "earnings_credited"; data: EarningsCreditedEmailProps }
  | { type: "withdrawal_initiated"; data: WithdrawalInitiatedEmailProps }
  | { type: "withdrawal_paid"; data: WithdrawalSuccessfulEmailProps }
  | { type: "withdrawal_failed"; data: WithdrawalFailedEmailProps };

// Single place mapping a keeper-notification type to its email template and
// subject line. Two callers share this:
//   - web/'s own routes (POST /api/keeper/withdraw, admin's mark-complete
//     route) call it directly, no network hop needed.
//   - api/'s Express backend triggers the events it owns (new job assigned,
//     withdrawal paid/failed) via POST /api/internal/notify-keeper, which
//     just authenticates the request then calls this same function.
// Never throws. sendEmail already swallows and logs its own failures, so a
// failed notification email can never roll back the wallet/withdrawal
// operation that triggered it.
export async function sendKeeperEmail(
  email: string | null,
  notification: KeeperNotification,
): Promise<void> {
  if (!email) {
    console.log(`[keeper-notify] Skipping ${notification.type}: no email on file`);
    return;
  }

  switch (notification.type) {
    case "new_job":
      await sendEmail({
        to: email,
        subject: "New job assigned",
        react: NewJobAssignedEmail(notification.data),
      });
      return;
    case "earnings_credited":
      await sendEmail({
        to: email,
        subject: "Earnings credited",
        react: EarningsCreditedEmail(notification.data),
      });
      return;
    case "withdrawal_initiated":
      await sendEmail({
        to: email,
        subject: "Withdrawal started",
        react: WithdrawalInitiatedEmail(notification.data),
      });
      return;
    case "withdrawal_paid":
      await sendEmail({
        to: email,
        subject: "Withdrawal successful",
        react: WithdrawalSuccessfulEmail(notification.data),
      });
      return;
    case "withdrawal_failed":
      await sendEmail({
        to: email,
        subject: "Withdrawal failed",
        react: WithdrawalFailedEmail(notification.data),
      });
      return;
  }
}
