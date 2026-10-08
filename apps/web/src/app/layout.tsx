import type { Metadata } from "next";
import { Radio_Canada, Radio_Canada_Big } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCReactProvider } from "@/trpc/client";

import "./globals.css";

// Text face. The width axis is what `timecode` narrows for timestamps and lengths.
const sans = Radio_Canada({
  variable: "--font-sans",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Display face: titles only.
const display = Radio_Canada_Big({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Meet AI",
    template: "%s · Meet AI",
  },
  description: "Voice calls with AI agents you design, with transcripts and summaries afterwards.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NuqsAdapter>
          <TRPCReactProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </TRPCReactProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
