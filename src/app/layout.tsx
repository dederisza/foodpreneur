import type { Metadata } from "next";
import "./globals.css";

// NOTE: intentionally using system fonts (no next/font/google) so the
// project builds in fully offline / restricted-network environments
// without requiring a fonts.googleapis.com fetch at build time.

export const metadata: Metadata = {
  title: "Foodpreneur BI — Business Intelligence & Growth System",
  description:
    "AI-powered business intelligence and growth assistant for food UMKM.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
