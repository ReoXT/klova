"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/keeper/dashboard", label: "Home", icon: HomeIcon },
  { href: "/keeper/jobs", label: "Jobs", icon: JobsIcon },
  { href: "/keeper/wallet", label: "Wallet", icon: WalletIcon },
  { href: "/keeper/profile", label: "Profile", icon: ProfileIcon },
];

export default function KeeperShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--surface-section)" }}
    >
      <main className="flex-1 pb-24">{children}</main>

      {/* ── Bottom tab bar — fixed, thumb-reachable, safe-area aware ──── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-4"
        style={{
          background: "var(--surface-card)",
          borderTop: "1px solid var(--border-default)",
          boxShadow: "0 -4px 20px oklch(0.18 0.007 85 / 0.06)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] active:scale-95 transition-transform"
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <span
                  className="absolute top-0 h-0.5 w-8 rounded-full"
                  style={{ background: "var(--klova-primary)" }}
                  aria-hidden="true"
                />
              )}
              <Icon
                className="w-6 h-6 transition-colors"
                style={{ color: active ? "var(--klova-primary)" : "var(--text-subtle)" }}
              />
              <span
                className="text-[11px] font-medium transition-colors"
                style={{ color: active ? "var(--klova-primary)" : "var(--text-subtle)" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ── Tab icons ────────────────────────────────────────────────── */

type IconProps = { className?: string; style?: React.CSSProperties };

function HomeIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 0 1 2.122 0L22.28 12M4.5 9.75V19.5a1.5 1.5 0 0 0 1.5 1.5h3.75a.75.75 0 0 0 .75-.75V15a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v5.25c0 .414.336.75.75.75H18a1.5 1.5 0 0 0 1.5-1.5V9.75" />
    </svg>
  );
}

function JobsIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function WalletIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1 0-6h3.75M21 12v3.75A2.25 2.25 0 0 1 18.75 18H5.25A2.25 2.25 0 0 1 3 15.75V6a2.25 2.25 0 0 1 2.25-2.25h9.5M21 12h-4.5a1.5 1.5 0 0 0 0 3H21" />
    </svg>
  );
}

function ProfileIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}
