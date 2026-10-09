import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

// Serif fina y espaciada, parecida a la del logo, para los títulos de cada página.
const titulo = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-titulo" });

export const metadata: Metadata = {
  title: "Veragua — Operaciones",
  description: "App interna de operaciones de Veragua",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Veragua",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#263521",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${titulo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
