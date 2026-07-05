import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email";
import { klovaTailwindConfig } from "../theme";
import { KlovaEmailFonts } from "../fonts";
import { SUPPORT_EMAIL } from "@/lib/contact";

export interface LayoutProps {
  /** Shows as the inbox preview snippet; never rendered visibly in the body. */
  previewText: string;
  children: ReactNode;
}

// Shared shell for every Klova transactional email: header wordmark, a
// rounded card for the actual message (passed as children), and a footer.
// Ported from the react.email "Barebone" gallery template's structure
// (header / card / footer), restyled with Klova's brand tokens from
// ../theme.ts. Individual email templates own everything inside the card;
// this component only owns what's shared across all of them.
export function Layout({ previewText, children }: LayoutProps) {
  return (
    <Tailwind config={klovaTailwindConfig}>
      <Html>
        <Head>
          <KlovaEmailFonts />
        </Head>
        <Body className="bg-bg-2 m-0 font-sans">
          <Preview>{previewText}</Preview>
          <Container className="mobile:mt-0 mobile:px-4 mx-auto mt-10 w-full max-w-[560px]">
            {/* Header */}
            <Section className="pb-6 text-center">
              <Text
                className="font-28 m-0 font-serif"
                style={{ color: "#113E28" }}
              >
                Klova
              </Text>
            </Section>

            {/* Card */}
            <Section
              className="bg-bg mobile:px-6 mobile:py-8 rounded-[16px] px-10 py-12"
              style={{ border: "1px solid #ECE8DF" }}
            >
              {children}
            </Section>

            {/* Footer */}
            <Section className="pt-8 pb-10 text-center">
              <Text className="font-13 text-fg-3 m-0 text-center font-sans">
                Home cleaning for Lagos.
              </Text>
              {SUPPORT_EMAIL && (
                <Text className="font-13 text-fg-3 m-0 mt-1.5 text-center font-sans">
                  Need help?{" "}
                  <Link href={`mailto:${SUPPORT_EMAIL}`} className="text-fg-3 underline">
                    {SUPPORT_EMAIL}
                  </Link>
                </Text>
              )}
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}
