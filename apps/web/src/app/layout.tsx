import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCReactProvider } from "@/trpc/client";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
