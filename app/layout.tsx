import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import { PostHogProvider } from "@/lib/observability/posthog-client";
import { postHogConfig } from "@/lib/observability/posthog-config";
import "./globals.css";

// Three families, three jobs. Inter is the product's own voice, Source Serif 4
// is quoted or verbatim material only, IBM Plex Mono is data. The variable names
// are the ones app/globals.css references from its @theme block.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "EviBrief",
  description:
    "Policy intelligence and brief generation for Tropenbos Ghana — forest-policy signals matched to verified evidence, drafted for review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const analyticsConfig = postHogConfig();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <PostHogProvider config={analyticsConfig}>{children}</PostHogProvider>
      </body>
    </html>
  );
}
