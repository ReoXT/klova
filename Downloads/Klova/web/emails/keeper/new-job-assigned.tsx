import { Layout } from "../components/Layout";
import { EmailButton, EmailDetailRow, EmailHeading, EmailMuted, EmailText } from "../components/Elements";

export interface NewJobAssignedEmailProps {
  firstName: string;
  serviceName: string;
  zoneName: string;
  bookingDate: string;
  jobUrl: string;
}

// Fires from notifyCleanerNewJobEmail (api/src/services/notificationService.ts)
// when a booking's payment is confirmed and the assigned keeper is notified.
export function NewJobAssignedEmail({
  firstName,
  serviceName,
  zoneName,
  bookingDate,
  jobUrl,
}: NewJobAssignedEmailProps) {
  return (
    <Layout previewText={`New job: ${serviceName} on ${bookingDate}`}>
      <EmailHeading>New job assigned</EmailHeading>
      <EmailText>
        Hi {firstName}, you have a new job.
      </EmailText>

      <EmailDetailRow label="Service" value={serviceName} />
      <EmailDetailRow label="Date" value={bookingDate} />
      <EmailDetailRow label="Area" value={zoneName} />

      <EmailButton href={jobUrl}>View job</EmailButton>

      <EmailMuted>
        This is an automated message. No need to reply.
      </EmailMuted>
    </Layout>
  );
}

NewJobAssignedEmail.PreviewProps = {
  firstName: "Tobi",
  serviceName: "Standard Clean",
  zoneName: "Lekki Phase 1",
  bookingDate: "Tuesday, 8 July",
  jobUrl: "https://klova-nine.vercel.app/keeper/jobs/example",
} satisfies NewJobAssignedEmailProps;

export default NewJobAssignedEmail;
