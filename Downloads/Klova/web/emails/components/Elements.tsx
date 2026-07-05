import type { ReactNode } from "react";
import { Button, Heading, Text } from "react-email";

// Shared content-block primitives for inside <Layout>'s card. Keeps every
// template's typography/spacing consistent without re-deriving Tailwind
// class strings per email. The email equivalent of components/ui/*.tsx.

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Heading as="h1" className="font-24 text-fg m-0 mb-3 font-serif">
      {children}
    </Heading>
  );
}

export function EmailText({ children }: { children: ReactNode }) {
  return (
    <Text className="font-16 text-fg-2 m-0 mb-4 font-sans">
      {children}
    </Text>
  );
}

export function EmailMuted({ children }: { children: ReactNode }) {
  return (
    <Text className="font-13 text-fg-3 m-0 mt-4 font-sans">
      {children}
    </Text>
  );
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      className="bg-brand text-brand-content font-16 mt-2 inline-block rounded-lg px-7 py-3.5 text-center font-sans font-semibold leading-6"
    >
      {children}
    </Button>
  );
}

// A bordered key/value row, useful for receipts (withdrawal amount, job
// details, etc.) without building a full table each time.
export function EmailDetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
      <tbody>
        <tr>
          <td
            className="font-14 text-fg-3 font-sans"
            style={{ padding: "8px 0", borderBottom: "1px solid #ECE8DF" }}
          >
            {label}
          </td>
          <td
            className="font-14 text-fg font-sans"
            style={{ padding: "8px 0", textAlign: "right", borderBottom: "1px solid #ECE8DF", fontWeight: 600 }}
          >
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
