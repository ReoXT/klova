import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cancellation & Refunds — Klova",
};

export default function CancellationPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20">
      <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest mb-4">Legal</p>
      <h1 className="text-4xl mb-6">Cancellation &amp; Refunds</h1>
      <div className="space-y-6 text-sm text-base-content/70 leading-relaxed">
        <p>Our cancellation policy is designed to be fair to both customers and cleaners.</p>
        <div className="space-y-3">
          <div className="flex gap-4">
            <span className="badge badge-success badge-soft shrink-0 mt-0.5">Free</span>
            <p>Cancel more than 24 hours before your scheduled clean — full refund, no questions asked.</p>
          </div>
          <div className="flex gap-4">
            <span className="badge badge-warning badge-soft shrink-0 mt-0.5">50%</span>
            <p>Cancel within 24 hours of the scheduled clean — 50% refund. The rest compensates the cleaner for the reserved time.</p>
          </div>
          <div className="flex gap-4">
            <span className="badge badge-error badge-soft shrink-0 mt-0.5">No refund</span>
            <p>Cancel after the cleaner has been dispatched — no refund can be issued.</p>
          </div>
        </div>
        <p>
          Refunds are returned to your original payment method within 3–5 business days.
          For help, reach us on{" "}
          <a href="https://wa.me/2348000000000" className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>.
        </p>
      </div>
    </div>
  );
}
