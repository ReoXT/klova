import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Klova",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20">
      <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest mb-4">Legal</p>
      <h1 className="text-4xl mb-6">Privacy Policy</h1>
      <div className="prose prose-sm text-base-content/70 space-y-4">
        <p>Full privacy policy will be published before launch.</p>
        <p>
          For questions, reach us on{" "}
          <a href="https://wa.me/2348000000000" className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>.
        </p>
      </div>
    </div>
  );
}
