import type { Metadata } from "next";
import { LegalShell, Section, ReviewNote, Ul } from "../_legal";
import { SUPPORT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Terms of Service | Klova",
  description: "The terms that govern your use of Klova, the on-demand home cleaning platform for Lagos.",
};

export default function TermsPage() {
  const emailDisplay = SUPPORT_EMAIL || "[email not set, update lib/contact.ts]";
  const emailHref = SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : "#";

  return (
    <LegalShell title="Terms of Service" lastUpdated="June 2026">

      <Section heading="1. About Klova">
        <p>
          Klova is an online platform that connects customers in Lagos with independent professional
          cleaners. We are registered in Nigeria.
        </p>
        <ReviewNote>
          Insert the full registered company name and RC number here before launch. A lawyer should
          confirm that this structure (platform connecting independent contractors) does not create an
          employment relationship under Nigerian labour law.
        </ReviewNote>
        <p>
          When you book through Klova, you are entering into an agreement directly with your assigned
          cleaner for the cleaning work itself. Klova acts as the platform and payment facilitator, not
          as the cleaner&apos;s employer. That said, we take responsibility for the quality of the vetting
          and matching process, and we stand behind every booking.
        </p>
      </Section>

      <Section heading="2. What Klova provides">
        <p>We provide:</p>
        <Ul items={[
          "A platform to browse, book, and pay for cleaning services",
          "NIN-verified, rated cleaners matched to your booking",
          "Secure payment processing through Paystack",
          "Optional order protection (see section 6)",
          "Customer support by email",
        ]} />
        <p>
          Klova does not supply cleaning equipment or products. Unless you have separately agreed
          otherwise with your cleaner, you are responsible for ensuring the basic supplies needed are
          available at the property.
        </p>
      </Section>

      <Section heading="3. Eligibility">
        <p>
          You must be at least 18 years old to use Klova. By placing a booking you confirm that you
          are the legal owner or occupant of the property, or that you have clear authority from the
          owner or occupant to allow a cleaner to enter and work there.
        </p>
      </Section>

      <Section heading="4. Booking and payment">
        <p>
          When you complete a booking on Klova:
        </p>
        <Ul items={[
          "A cleaner is matched and assigned before you pay",
          "You see the cleaner's name, photo, rating, and verification status before checkout",
          "Full payment is collected at the time of booking through Paystack",
          "Your booking is confirmed only once payment clears successfully",
        ]} />
        <p>
          Prices shown during checkout are final and inclusive of all fees. We do not add charges after
          a booking is placed.
        </p>
      </Section>

      <Section heading="5. Pricing">
        <p>
          All prices are set by Klova and displayed clearly during the booking process. The price
          includes a platform fee that covers cleaner vetting, matching, insurance management, and
          customer support. The specific split between the cleaner&apos;s earnings and Klova&apos;s fee is not
          disclosed to customers, but no amount beyond the price shown at checkout will ever be charged.
        </p>
      </Section>

      <Section heading="6. Order protection">
        <p>
          Order protection is an optional add-on available at checkout. When selected, it covers you
          against accidental damage to your property and missing items that are directly caused by your
          assigned cleaner during the booking.
        </p>
        <ReviewNote>
          Before launch, have a Nigerian lawyer confirm whether this product is legally classified as
          insurance under the Insurance Act 2003, and if so, what registration and disclosure obligations
          apply. If it is not classified as insurance, the copy should still be accurate about what
          protection it actually provides and what the claims process looks like.
        </ReviewNote>
        <p>
          To make a claim, email us within 24 hours of the service completing with photographic
          evidence. We will investigate and, where a claim is upheld, arrange compensation up to the
          stated limit.
        </p>
        <p>Order protection does not cover:</p>
        <Ul items={[
          "Pre-existing damage or wear and tear",
          "Cash, jewellery, artwork, or items of extraordinary value unless separately disclosed in writing before the booking",
          "Damage caused by the customer, other occupants, or third parties",
          "Losses arising after the cleaner has left the property",
        ]} />
      </Section>

      <Section heading="7. Cancellations and refunds">
        <p>
          Please read our <a href="/cancellation" className="underline underline-offset-2" style={{ color: "var(--color-primary)" }}>Cancellation and Refunds</a> page
          for the full policy. In summary:
        </p>
        <Ul items={[
          "More than 24 hours before the scheduled clean: full refund",
          "Within 24 hours of the scheduled clean: 50% refund",
          "After the cleaner has been dispatched: no refund",
        ]} />
      </Section>

      <Section heading="8. Service quality">
        <p>
          If you are not satisfied with a clean, email us within 24 hours of the service completing.
          We will review the situation and, where the issue is validated, either:
        </p>
        <Ul items={[
          "Arrange a complimentary re-clean of the affected areas at no cost, or",
          "Issue a partial refund at our discretion",
        ]} />
        <p>
          Complaints raised more than 24 hours after the service cannot be considered, as it is not
          possible to verify the condition of the property at that point.
        </p>
      </Section>

      <Section heading="9. Your responsibilities">
        <p>As a customer you agree to:</p>
        <Ul items={[
          "Provide an accurate address and clear access instructions",
          "Be present, or arrange access for the cleaner, at the agreed time",
          "Ensure the property is reasonably safe for a person to work in",
          "Treat cleaners with respect. Harassment, threats, or unsafe working conditions are grounds for immediate cancellation without refund and removal from the platform",
          "Not request services, or ask the cleaner to perform tasks, beyond what was booked and paid for",
        ]} />
      </Section>

      <Section heading="10. Our liability to you">
        <p>
          Klova is responsible for direct losses caused by our platform failing to perform as described
          in these terms. We are not responsible for:
        </p>
        <Ul items={[
          "The cleaner's performance beyond what is covered by order protection",
          "Indirect or consequential losses (such as loss of income or loss of enjoyment)",
          "Events outside our reasonable control (including power cuts, flooding, or road closures)",
          "Losses arising from information you provided that turned out to be inaccurate",
        ]} />
        <ReviewNote>
          This limitation of liability clause needs to be reviewed against the Federal Competition and
          Consumer Protection Act (FCCPA) 2018 and the Consumer Protection Council Act to ensure it is
          enforceable under Nigerian consumer protection law.
        </ReviewNote>
      </Section>

      <Section heading="11. Cleaners are independent contractors">
        <p>
          All cleaners on the Klova platform are independent contractors, not employees of Klova. Klova
          vets and rates them, but we are not their employer. If a cleaner behaves inappropriately,
          report it to us by email immediately. We investigate every report and take conduct
          seriously, including removing cleaners from the platform where warranted.
        </p>
      </Section>

      <Section heading="12. Platform rules">
        <p>
          You may not use the Klova platform to:
        </p>
        <Ul items={[
          "Arrange or pay for cleaning services directly with a cleaner you were matched with through Klova, bypassing the platform and its payment system",
          "Solicit a cleaner for work outside the platform, whether during, before, or after a booking",
          "Submit false reviews or complaints",
          "Attempt to access systems or data you are not authorised to access",
          "Use the platform for any unlawful purpose",
        ]} />
        <p>
          The non-circumvention rule exists to protect the integrity of the platform and the
          livelihoods of cleaners who depend on it. Customers who are found to have arranged
          off-platform work with a Klova cleaner will be permanently removed and may be liable
          for the platform fees that would have applied to those bookings.
        </p>
        <p>
          Cleaners are bound by an equivalent obligation in their Cleaner Agreement. Both parties
          benefit from using the platform: customers retain accountability, insurance coverage, and
          dispute resolution; cleaners retain ratings, verified income records, and payment
          protection.
        </p>
      </Section>

      <Section heading="13. Intellectual property">
        <p>
          All content on the Klova website, including the brand name, logo, copy, and design, belongs
          to Klova. You may not copy, reproduce, or use any of it without written permission from us.
        </p>
      </Section>

      <Section heading="14. Changes to these terms">
        <p>
          We may update these terms from time to time. If we make material changes, we will let you
          know by email before the changes take effect. Continued use of Klova after the effective date
          of any update means you accept the revised terms.
        </p>
      </Section>

      <Section heading="15. Governing law">
        <p>
          These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes that
          cannot be resolved informally will be subject to the exclusive jurisdiction of the courts
          of Lagos State.
        </p>
        <ReviewNote>
          Consider whether to include an arbitration or mediation clause as an alternative to
          litigation. This is common in Nigerian commercial contracts and can be faster and cheaper
          for both parties.
        </ReviewNote>
      </Section>

      <Section heading="16. Contact us">
        <p>
          For questions about these terms, email us at{" "}
          <a href={emailHref} className="underline underline-offset-2" style={{ color: "var(--color-primary)" }}>
            {emailDisplay}
          </a>.
        </p>
      </Section>

    </LegalShell>
  );
}
