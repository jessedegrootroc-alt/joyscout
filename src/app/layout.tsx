import type { Metadata } from "next";
import { Google_Sans_Flex, JetBrains_Mono, Caveat } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Google_Sans_Flex({ variable: "--font-sans", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const hand = Caveat({ variable: "--font-hand", subsets: ["latin"], weight: ["600"], display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
const ogTitle = "Vindt lokale leads met een verouderde website";
const ogDescription = "Joyscrape vindt lokale bedrijven met een slechte of verouderde website, scoort de kans en schrijft de eerste outreach voor je.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "Joyscrape", template: "%s · Joyscrape" },
  description: "Find local businesses with an underperforming online presence.",
  openGraph: {
    type: "website",
    siteName: "Joyscrape",
    title: ogTitle,
    description: ogDescription,
    locale: "nl_NL",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Joyscrape: vindt lokale leads met een verouderde website" }],
  },
  twitter: { card: "summary_large_image", title: ogTitle, description: ogDescription, images: ["/og.png"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${hand.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border-border !bg-card !text-foreground !shadow-flyout !font-sans",
              description: "!text-muted-foreground",
              actionButton: "!rounded-full !bg-primary !text-primary-foreground",
              cancelButton: "!rounded-full",
            },
          }}
        />
      </body>
    </html>
  );
}
