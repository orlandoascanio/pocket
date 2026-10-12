import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { DESCRIPTION, SITE_URL } from "@/lib/site";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--display-font",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Pocket for Mac: your balance in the menubar",
  description: DESCRIPTION,
  applicationName: "Pocket",
  alternates: { canonical: "/" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Pocket",
    title: "Pocket for Mac",
    description: "Your balance in the menubar, and how long it will last. Your money stays on your Mac.",
    images: [{ url: "/screenshot-overview.png", width: 1600, height: 1283, alt: "Pocket's main window on a Mac" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
