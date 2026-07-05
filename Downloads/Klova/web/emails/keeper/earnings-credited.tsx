import { Layout } from "../components/Layout";
import { EmailButton, EmailDetailRow, EmailHeading, EmailMuted, EmailText } from "../components/Elements";

export interface EarningsCreditedEmailProps {
  firstName: string;
  amountNaira: string;
  serviceName: string;
  walletUrl: string;
}

// Fires when a booking is marked complete and the keeper's share of the
// cleaning fee is credited (web/app/api/admin/bookings/[id]/complete/route.ts).
export function EarningsCreditedEmail({
  firstName,
  amountNaira,
  serviceName,
  walletUrl,
}: EarningsCreditedEmailProps) {
  return (
    <Layout previewText={`₦${amountNaira} credited to your wallet`}>
      <EmailHeading>Earnings credited</EmailHeading>
      <EmailText>
        Hi {firstName}, your earnings from this job have been credited.
      </EmailText>

      <EmailDetailRow label="Job" value={serviceName} />
      <EmailDetailRow label="Amount" value={`₦${amountNaira}`} />

      <EmailButton href={walletUrl}>View wallet</EmailButton>

      <EmailMuted>
        This is an automated message. No need to reply.
      </EmailMuted>
    </Layout>
  );
}

EarningsCreditedEmail.PreviewProps = {
  firstName: "Tobi",
  amountNaira: "7,410",
  serviceName: "Standard Clean",
  walletUrl: "https://klova-nine.vercel.app/keeper/wallet",
} satisfies EarningsCreditedEmailProps;

export default EarningsCreditedEmail;
