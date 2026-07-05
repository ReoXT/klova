import { Layout } from "../components/Layout";
import { EmailButton, EmailDetailRow, EmailHeading, EmailMuted, EmailText } from "../components/Elements";

export interface WithdrawalInitiatedEmailProps {
  firstName: string;
  amountNaira: string;
  bankName: string;
  accountLast4: string;
  walletUrl: string;
}

// Fires from POST /api/keeper/withdraw right after a Paystack transfer is
// initiated (payout row moves to 'processing').
export function WithdrawalInitiatedEmail({
  firstName,
  amountNaira,
  bankName,
  accountLast4,
  walletUrl,
}: WithdrawalInitiatedEmailProps) {
  return (
    <Layout previewText={`Your withdrawal of ₦${amountNaira} is processing`}>
      <EmailHeading>Withdrawal started</EmailHeading>
      <EmailText>
        Hi {firstName}, your withdrawal is processing.
      </EmailText>

      <EmailDetailRow label="Amount" value={`₦${amountNaira}`} />
      <EmailDetailRow label="Sending to" value={`${bankName} ****${accountLast4}`} />

      <EmailButton href={walletUrl}>View wallet</EmailButton>

      <EmailMuted>
        This is an automated message. No need to reply.
      </EmailMuted>
    </Layout>
  );
}

WithdrawalInitiatedEmail.PreviewProps = {
  firstName: "Tobi",
  amountNaira: "12,000",
  bankName: "Kuda Bank",
  accountLast4: "4959",
  walletUrl: "https://klova-nine.vercel.app/keeper/wallet",
} satisfies WithdrawalInitiatedEmailProps;

export default WithdrawalInitiatedEmail;
