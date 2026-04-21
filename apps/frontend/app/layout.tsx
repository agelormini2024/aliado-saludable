import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aliado Saludable",
  description: "Tu compañero en el camino hacia una vida más saludable",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
