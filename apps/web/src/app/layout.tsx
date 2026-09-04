import type {
  Metadata,
  Viewport,
} from "next";

import {
  Inter,
  Inter_Tight,
  JetBrains_Mono,
} from "next/font/google";

import { Toaster } from "sonner";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";

import "leaflet/dist/leaflet.css";

import "./globals.css";
import "./legacy-ui.css";


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});


const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});


const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: {
    default:
      "ADRESSE GN — Un lieu, un numéro, un itinéraire",

    template:
      "%s | ADRESSE GN",
  },

  description:
    "Trouvez ou partagez n'importe quelle adresse en Guinée grâce à un numéro unique associé à une position géographique.",

  applicationName:
    "ADRESSE GN",

  authors: [
    {
      name: "Adresse GN",
    },
  ],

  openGraph: {
    type: "website",

    locale: "fr_GN",

    siteName:
      "ADRESSE GN",

    title:
      "ADRESSE GN — Votre adresse, enfin facile à trouver",

    description:
      "Un numéro unique pour localiser, partager et rejoindre facilement chaque adresse.",
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "ADRESSE GN",

    description:
      "Un numéro unique pour localiser, partager et rejoindre facilement chaque adresse.",
  },
};


export const viewport: Viewport = {
  width: "device-width",

  initialScale: 1,

  viewportFit: "cover",

  themeColor:
    "#2E4A7B",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`
          ${inter.variable}
          ${interTight.variable}
          ${jetBrainsMono.variable}
          min-h-screen
          bg-background
          font-sans
          text-foreground
          antialiased
        `}
      >
        <TooltipProvider
          delayDuration={150}
        >
          <div className="flex min-h-screen flex-col">
            <SiteHeader />

            <main className="flex-1">
              {children}
            </main>

            <SiteFooter />
          </div>

          <Toaster
            richColors
            position="top-center"
          />
        </TooltipProvider>
      </body>
    </html>
  );
}