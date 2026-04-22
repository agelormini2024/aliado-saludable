import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";

/**
 * Fraunces — fuente de display.
 * Variable serif con personalidad old-style; cálida y distintiva.
 * Referenciada en globals.css como --font-heading via la variable CSS --font-fraunces.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  weight: ["300", "400", "600", "700", "900"],
  display: "swap",
});

/**
 * DM Sans — fuente de texto.
 * Humanista geométrica; amigable, legible, moderna sin ser estéril.
 * Referenciada en globals.css como --font-sans via la variable CSS --font-dm-sans.
 */
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aliado Saludable — Tu compañero en el proceso",
  description:
    "Seguí tu progreso, registrá tus comidas y consultá a tu IA personal. Sin juicios, a tu ritmo.",
  openGraph: {
    title: "Aliado Saludable",
    description: "Tu compañero en el camino hacia una vida más saludable",
    siteName: "Aliado Saludable",
    locale: "es_AR",
  },
};

/**
 * RootLayout — wrapper raíz de toda la aplicación.
 *
 * Inyecta las variables CSS de fuentes en <html> para que Tailwind pueda
 * resolverlas vía las utilidades `font-heading` y `font-sans`.
 * El body aplica la fuente base, el fondo crema y antialiasing.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${dmSans.variable}`}
    >
      <body className="font-sans bg-cream text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
