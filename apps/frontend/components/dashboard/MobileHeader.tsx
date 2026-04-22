/**
 * MobileHeader — barra superior visible solo en pantallas pequeñas (< lg).
 *
 * En desktop el sidebar ya está siempre visible, por lo que este header
 * solo se muestra en mobile y tablet con `lg:hidden`.
 *
 * Contiene:
 * - Botón de hamburguesa: abre/cierra el cajón del Sidebar
 * - Logo: link al dashboard
 * - Avatar: inicial del usuario para contexto visual rápido
 */
"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { useUIStore } from "@/stores/ui.store";

const IconMenu = () => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-6 w-6"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

export function MobileHeader() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const usuario = useAuthStore((s) => s.usuario);
  const inicial = usuario?.nombre?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-forest px-4 lg:hidden">
      <button
        onClick={toggleSidebar}
        className="rounded-lg p-1.5 text-cream/70 transition-colors hover:bg-white/10 hover:text-cream"
        aria-label="Abrir menú de navegación"
      >
        <IconMenu />
      </button>

      <Link
        href="/dashboard"
        className="font-heading italic text-lg text-cream"
      >
        Aliado Saludable
      </Link>

      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/20">
        <span className="font-sans text-sm font-semibold text-amber-light">
          {inicial}
        </span>
      </div>
    </header>
  );
}
