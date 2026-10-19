import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brukiz AMS | Ficohsa Seguros",
  description: "Plataforma de gestión para agentes y agencias de seguros.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
