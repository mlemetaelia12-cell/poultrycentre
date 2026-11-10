import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/i18n/server";

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-plus-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "POULTRY CENTRE", template: "%s | POULTRY CENTRE" },
  description: "Secure veterinary shop management for POULTRY CENTRE.",
  applicationName: "POULTRY CENTRE",
  icons: { icon: "/poultry-farm-icon-192.png", shortcut: "/poultry-farm-icon-192.png", apple: "/poultry-farm-icon-192.png" },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#14532d", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return <html lang={locale}><body className={plusJakarta.className}>{children}</body></html>;
}
