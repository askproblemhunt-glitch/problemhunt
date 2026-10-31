import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteShell from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "ProblemHunt — Check any link, number, UPI ID or message for scams",
  description: "Free scam checker in English, Hindi, Tamil, Telugu, Bengali and Marathi. Check links, phone numbers, UPI IDs, emails, QR codes and messages before you click, pay or reply.",
  manifest: "/manifest.json",
  applicationName: "ProblemHunt",
  appleWebApp: { capable: true, title: "ProblemHunt", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#03050a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><SiteShell>{children}</SiteShell></body>
    </html>
  );
}
