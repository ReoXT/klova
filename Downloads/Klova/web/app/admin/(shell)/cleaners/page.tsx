import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminCleanersPage() {
  return (
    <div>
      <PageHeader
        title="Cleaners"
        description="Manage vetted cleaners and their profiles."
      />
      <div
        className="rounded-2xl mt-6"
        style={{
          background: "var(--surface-card)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <EmptyState
          icon={<PeopleIcon />}
          heading="No cleaners yet"
          message="Add cleaners to the database via Supabase. They'll appear here once seeded."
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

function PeopleIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}
