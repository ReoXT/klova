import type { Metadata } from "next";
import { LegalShell, Section, ReviewNote, Ul } from "../_legal";
import { SUPPORT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Cancellation & Refunds | Klova",
  description: "Klova's cancellation windows, refund timelines, and what to do if you have a problem with your clean.",
};

export default function CancellationPage() {
  const emailDisplay = SUPPORT_EMAIL || "[email not set, update lib/contact.ts]";
  const emailHref = SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : "#";

  return (
    <LegalShell title="Cancellation & Refunds" lastUpdated="June 2026">

      <Section heading="1. Cancellation windows">
        <p>
          You can cancel any confirmed booking directly through the platform or by contacting us
          by email. The refund you receive depends on how much notice you give.
        </p>

        {/* Timeline cards */}
        <div className="space-y-3 pt-1">
          <div
            className="flex gap-4 rounded-2xl px-5 py-4"
            style={{ background: "var(--surface-card)", border: "1px solid var(--color-base-200)" }}
          >
            <div className="pt-0.5 shrink-0">
              <span className="badge badge-success badge-soft text-xs font-semibold px-3">Full refund</span>
            </div>
            <div className="text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
              <p className="font-medium mb-0.5" style={{ color: "var(--text-strong)" }}>More than 24 hours before the scheduled clean</p>
              <p>
                Cancel at any point more than 24 hours before your booking time and you will receive
                a complete refund with no deductions. No questions asked.
              </p>
            </div>
          </div>

          <div
            className="flex gap-4 rounded-2xl px-5 py-4"
            style={{ background: "var(--surface-card)", border: "1px solid var(--color-base-200)" }}
          >
            <div className="pt-0.5 shrink-0">
              <span className="badge badge-warning badge-soft text-xs font-semibold px-3">50% refund</span>
            </div>
            <div className="text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
              <p className="font-medium mb-0.5" style={{ color: "var(--text-strong)" }}>Within 24 hours of the scheduled clean</p>
              <p>
                If you cancel within 24 hours of your booking time, you will receive a 50% refund.
                The remaining 50% compensates your assigned cleaner for the time they have reserved
                and cannot rebook.
              </p>
            </div>
          </div>

          <div
            className="flex gap-4 rounded-2xl px-5 py-4"
            style={{ background: "var(--surface-card)", border: "1px solid var(--color-base-200)" }}
          >
            <div className="pt-0.5 shrink-0">
              <span className="badge badge-error badge-soft text-xs font-semibold whitespace-nowrap px-3">No refund</span>
            </div>
            <div className="text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
              <p className="font-medium mb-0.5" style={{ color: "var(--text-strong)" }}>After the cleaner has been dispatched</p>
              <p>
                Once your cleaner is on their way to your property, we are unable to issue a refund.
                The cleaner&apos;s time, travel, and effort are committed at this point.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section heading="2. How refunds are processed">
        <p>
          Refunds are returned to the original payment method used at checkout (your debit or credit
          card via Paystack). Processing times depend on your bank:
        </p>
        <Ul items={[
          "Most Nigerian banks: 1 to 3 business days",
          "Some cards may take up to 5 business days",
        ]} />
        <p>
          We initiate every refund on our end within 24 hours of the cancellation being confirmed.
          If you have not received your refund after 5 business days, email us with your booking
          reference and we will follow up with Paystack directly.
        </p>
        <ReviewNote>
          Confirm the exact Paystack refund processing timeline before launch, as it may vary
          depending on the card network (Verve, Mastercard, Visa) and the issuing bank.
        </ReviewNote>
      </Section>

      <Section heading="3. Order protection refunds">
        <p>
          The ₦1,300 order protection fee is non-refundable once a booking is confirmed, regardless
          of when the cancellation is made. If you cancel and receive a refund on the cleaning fee,
          the order protection fee will not be included in the refund.
        </p>
      </Section>

      <Section heading="4. No-shows and access problems">
        <p>
          If your cleaner cannot access the property at the agreed time because:
        </p>
        <Ul items={[
          "No one is home and no access instructions were provided",
          "The address provided was incorrect",
          "Access was denied after the cleaner arrived",
        ]} />
        <p>
          This is treated the same as a cancellation after dispatch. No refund will be issued.
          Please make sure your address is accurate and that access is arranged before your
          booking time.
        </p>
        <p>
          When the cleaner arrives at your property, they notify Klova directly. We then send
          you a message to let you know your cleaner has arrived. The cleaner will wait up to 15
          minutes from that notification. If we cannot reach you or access cannot be arranged
          within that window, the booking will be marked as a no-show.
        </p>
        <p>
          To protect both parties, Klova does not share customer phone numbers with cleaners.
          All communication goes through us.
        </p>
      </Section>

      <Section heading="5. If the clean does not meet your expectations">
        <p>
          We want every Klova clean to be excellent. If yours falls short, here is what to do:
        </p>
        <Ul items={[
          "Email us within 24 hours of the service completing",
          "Tell us clearly what the problem is, and send photos where possible",
          "We will review the case and aim to respond within 1 business day",
        ]} />
        <p>Where a valid complaint is confirmed, we will either:</p>
        <Ul items={[
          "Arrange a complimentary re-clean of the affected areas at no cost to you, or",
          "Issue a partial refund, at our discretion based on the nature of the issue",
        ]} />
        <p>
          Complaints raised more than 24 hours after the service cannot be considered, as it is
          not possible to verify the state of the property at that point.
        </p>
      </Section>

      <Section heading="6. Cancellations initiated by Klova">
        <p>
          In rare cases, Klova may need to cancel a booking. This can happen if:
        </p>
        <Ul items={[
          "No cleaner is available for your area or date at the time of booking",
          "Your assigned cleaner reports an emergency and no replacement can be found",
          "We detect fraudulent activity on the booking",
        ]} />
        <p>
          If we cancel your booking for any of these reasons, you will receive a full refund
          regardless of the timing. We will contact you immediately by email to explain
          and, where possible, suggest alternative dates.
        </p>
      </Section>

      <Section heading="7. Get in touch">
        <p>
          For cancellation requests or refund questions, email us at{" "}
          <a
            href={emailHref}
            className="underline underline-offset-2"
            style={{ color: "var(--color-primary)" }}
          >
            {emailDisplay}
          </a>
          . Please include your booking reference in your message.
        </p>
      </Section>

    </LegalShell>
  );
}
