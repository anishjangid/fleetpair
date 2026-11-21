import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "fleetpair · morning handover for EV rental hubs",
  description:
    "Match delivery riders with scooters and batteries using usage patterns, pack range and vehicle health.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@1,300,400,500,700,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full antialiased">
        <TooltipProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-center" />
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
