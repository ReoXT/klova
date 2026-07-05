import { Layout } from "../components/Layout";
import { EmailButton, EmailDetailRow, EmailHeading, EmailMuted, EmailText } from "../components/Elements";

export interface WithdrawalFailedEmailProps {
  firstName: string;
  amountNaira: string;
  walletUrl: string;
}

// Fires from handleTransferWebhook (api/src/services/payoutService.ts) on a
// transfer.failed or transfer.reversed event for a keeper-initiated
// withdrawal. The amount is always returned to the keeper's available
// balance the moment this fires (see handleTransferWebhook), so the email's
// job is just to say that plainly.
export function WithdrawalFailedEmail({
  firstName,
  amountNaira,
  walletUrl,
}: WithdrawalFailedEmailProps) {
  return (
    <Layout previewText={`Your withdrawal of ₦${amountNaira} did not go through`}>
      <EmailHeading>Withdrawal failed</EmailHeading>
      <EmailText>
        Hi {firstName}, your withdrawal of ₦{amountNaira} did not go through. The money is back in your available balance.
      </EmailText>

      <EmailDetailRow label="Amount" value={`₦${amountNaira}`} />

      <EmailButton href={walletUrl}>View wallet</EmailButton>

      <EmailMuted>
        This is an automated message. No need to reply.
      </EmailMuted>
    </Layout>
  );
}

WithdrawalFailedEmail.PreviewProps = {
  firstName: "Tobi",
  amountNaira: "12,000",
  walletUrl: "https://klova-nine.vercel.app/keeper/wallet",
} satisfies WithdrawalFailedEmailProps;

export default WithdrawalFailedEmail;
