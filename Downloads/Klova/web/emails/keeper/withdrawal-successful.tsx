import { Layout } from "../components/Layout";
import { EmailButton, EmailDetailRow, EmailHeading, EmailMuted, EmailText } from "../components/Elements";

export interface WithdrawalSuccessfulEmailProps {
  firstName: string;
  amountNaira: string;
  bankName: string;
  accountLast4: string;
  walletUrl: string;
}

// Fires from handleTransferWebhook (api/src/services/payoutService.ts) on a
// transfer.success event for a keeper-initiated withdrawal.
export function WithdrawalSuccessfulEmail({
  firstName,
  amountNaira,
  bankName,
  accountLast4,
  walletUrl,
}: WithdrawalSuccessfulEmailProps) {
  return (
    <Layout previewText={`Your withdrawal of ₦${amountNaira} is on its way`}>
      <EmailHeading>Withdrawal successful</EmailHeading>
      <EmailText>
        Hi {firstName}, your withdrawal was successful.
      </EmailText>

      <EmailDetailRow label="Amount" value={`₦${amountNaira}`} />
      <EmailDetailRow label="Sent to" value={`${bankName} ****${accountLast4}`} />

      <EmailButton href={walletUrl}>View wallet</EmailButton>

      <EmailMuted>
        This is an automated message. No need to reply.
      </EmailMuted>
    </Layout>
  );
}

WithdrawalSuccessfulEmail.PreviewProps = {
  firstName: "Tobi",
  amountNaira: "12,000",
  bankName: "Kuda Bank",
  accountLast4: "4959",
  walletUrl: "https://klova-nine.vercel.app/keeper/wallet",
} satisfies WithdrawalSuccessfulEmailProps;

export default WithdrawalSuccessfulEmail;
