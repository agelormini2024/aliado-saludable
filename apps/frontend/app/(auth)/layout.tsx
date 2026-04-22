/**
 * AuthLayout — contenedor para las páginas de autenticación (login y registro).
 *
 * Server Component puro. Centra el contenido en pantalla completa sobre
 * fondo crema con dos blobs de color difuminados (bosque y ámbar) que
 * crean profundidad sin distracción.
 *
 * El logo en la esquina superior izquierda es un link que lleva de vuelta
 * a la landing pública (/). No necesita router del cliente.
 */
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cream">
      {/* Blob decorativo superior izquierdo */}
      <div
        aria-hidden="true"
        className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-forest-pale opacity-60 blur-3xl"
      />
      {/* Blob decorativo inferior derecho */}
      <div
        aria-hidden="true"
        className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-amber-pale opacity-70 blur-3xl"
      />

      {/* Logo / link a la landing */}
      <Link
        href="/"
        className="absolute left-8 top-7 font-heading italic text-xl font-semibold tracking-tight text-forest transition-colors hover:text-forest-mid"
      >
        Aliado Saludable
      </Link>

      {children}
    </div>
  );
}
