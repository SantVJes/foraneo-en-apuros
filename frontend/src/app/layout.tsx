import type { Metadata, Viewport } from "next";

import { Toaster } from "@/components/ui/sonner";
import { SCRIPT_LECTURA } from "@/lib/lectura";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foráneo en apuros",
  description: "La app del que vive lejos de casa: arma tu semana de comidas, revisa tu alacena y sabe en qué súper cerca de ti te sale más barato.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#131f24",
};

// La app arranca en oscuro antes de pintar (sin parpadeo). Cada quien lo cambia en Yo, Estilo.
const tema = `try{document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: tema }} />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_LECTURA }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </head>
      <body className="min-h-dvh">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-background">
          Saltar al contenido
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
