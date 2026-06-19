import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminRatingsPage() {
  return (
    <div>
      <PageHeader
        title="Ratings"
        description="Customer ratings and feedback for cleaners."
      />
      <div
        className="rounded-2xl mt-6"
        style={{
          background: "var(--surface-card)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <EmptyState
          icon={<StarIcon />}
          heading="No ratings yet"
          message="Ratings will appear here after customers complete their first bookings."
        />
      </div>
    </div>
  );
}

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
        {title}
      </h1>
      <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
    </div>
  );
}

function StarIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
    </svg>
  );
}
