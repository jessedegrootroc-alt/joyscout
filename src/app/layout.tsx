import type { Metadata } from "next";
import { Google_Sans_Flex, JetBrains_Mono, Caveat } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Google_Sans_Flex({ variable: "--font-sans", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const hand = Caveat({ variable: "--font-hand", subsets: ["latin"], weight: ["600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "LeadLens", template: "%s · LeadLens" },
  description: "Find local businesses with an underperforming online presence.",
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
