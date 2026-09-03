import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ADRESSE GN — Un lieu, un numéro, un itinéraire",
    template: "%s | ADRESSE GN",
  },
  description:
    "Trouvez ou partagez n'importe quelle adresse en Guinée grâce à un numéro unique associé à une position géographique.",
  applicationName: "ADRESSE GN",
  authors: [{ name: "Adresse GN" }],
  openGraph: {
    type: "website",
    locale: "fr_GN",
    siteName: "ADRESSE GN",
    title: "ADRESSE GN — Un lieu, un numéro, un itinéraire",
    description:
      "Un numéro unique pour localiser, partager et rejoindre facilement chaque adresse.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ADRESSE GN",
    description:
      "Un numéro unique pour localiser, partager et rejoindre facilement chaque adresse.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2E4A7B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <SiteHeader />

          <main className="flex-1">{children}</main>

          <SiteFooter />
        </div>
      </body>
    </html>
  );
}