import type { Metadata, Viewport } from "next";
import { SCRIPT_TEMA } from "@/components/tema";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ReportIQ · Ambienciq Ingenieros", template: "%s · ReportIQ" },
  description: "Informes ambientales automáticos: ruido (Res. 0627 de 2006), calidad del aire (Res. 2254 de 2017) y vertimientos (Res. 0631 de 2015).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // El script de tema agrega la clase "dark" antes de hidratar.
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
